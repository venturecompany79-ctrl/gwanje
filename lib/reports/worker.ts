import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { COMPANY_DOCUMENTS_BUCKET, storageUrlFromPath } from "@/lib/storage";
import { todayKstDate } from "@/lib/datetime";
import { buildReportDocx } from "@/lib/reports/docx";
import {
  extractDocumentText,
  UnsupportedReportSourceError,
} from "@/lib/reports/extract";
import {
  generateMeetingReport,
  PermanentReportGenerationError,
} from "@/lib/reports/llm";
import type { ReportData } from "@/lib/reports/types";
import { enqueueReportDocumentBackups } from "@/lib/google-drive/report-backup";

type Service = SupabaseClient<Database>;
type ReportJob = Database["public"]["Tables"]["meeting_report"]["Row"];
type MeetingReportUpdate = Database["public"]["Tables"]["meeting_report"]["Update"];
type DocumentRow = Pick<
  Database["public"]["Tables"]["document"]["Row"],
  | "id"
  | "tenant_id"
  | "company_id"
  | "name"
  | "file_type"
  | "storage_url"
  | "size_bytes"
  | "doc_category"
>;

interface ReportSourceDocuments {
  companyInfo: DocumentRow[];
  meetingNote: DocumentRow;
}

interface StoredReportDocument {
  documentId: string;
  storagePath: string;
}

type ReportDocumentKind = "full" | "summary";

const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = [2, 15, 90];
const STALE_PROCESSING_MINUTES = 15;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ReportRunResult {
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
}

class PermanentReportError extends Error {}
class SupersededReportError extends Error {}

function isPermanent(error: unknown): boolean {
  return (
    error instanceof PermanentReportError ||
    error instanceof UnsupportedReportSourceError ||
    error instanceof PermanentReportGenerationError
  );
}

function nextRunAtIso(attempts: number): string {
  const idx = Math.min(Math.max(attempts - 1, 0), BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000).toISOString();
}

function reportSummary(report: ReportData): string {
  return (
    report.executive_summary?.key_takeaway ??
    report.executive_summary?.intro ??
    report.sections[0]?.intro ??
    "보고서가 생성되었습니다."
  ).slice(0, 1000);
}

async function nextDocumentVersion(
  service: Service,
  companyId: string,
  name: string,
): Promise<number> {
  const { data, error } = await service
    .from("document")
    .select("version")
    .eq("company_id", companyId)
    .eq("name", name)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw new Error(`보고서 문서 버전 확인 실패: ${error.message}`);
  return (data?.[0]?.version ?? 0) + 1;
}

function safeReportFileName(title: string, kind: ReportDocumentKind): string {
  const safeTitle =
    title.replace(/[\\/:*?"<>|\n\r\t]+/g, "").trim().slice(0, 160) || "미팅 보고서";
  const suffix = kind === "full" ? "전체" : "요약";
  return `${safeTitle}_${suffix}_${todayKstDate().replaceAll("-", "")}.docx`;
}

async function loadSourceDocuments(
  service: Service,
  job: ReportJob,
): Promise<ReportSourceDocuments> {
  const { data: sources, error: sourceError } = await service
    .from("meeting_report_source")
    .select("role, document_id, created_at")
    .eq("report_id", job.id)
    .order("created_at", { ascending: true });
  if (sourceError) throw new Error(`보고서 소스 조회 실패: ${sourceError.message}`);

  const companyInfoIds = (sources ?? [])
    .filter((source) => source.role === "company_info")
    .map((source) => source.document_id);
  const meetingNoteIds = (sources ?? [])
    .filter((source) => source.role === "meeting_note")
    .map((source) => source.document_id);
  if (companyInfoIds.length < 1 || companyInfoIds.length > 5) {
    throw new PermanentReportError("회사정보 자료는 1~5개가 필요합니다.");
  }
  if (meetingNoteIds.length !== 1) {
    throw new PermanentReportError("회의록 자료는 정확히 1개가 필요합니다.");
  }

  const allIds = [...companyInfoIds, meetingNoteIds[0]];
  if (new Set(allIds).size !== allIds.length) {
    throw new PermanentReportError(
      "회사정보와 회의록에는 서로 다른 자료를 중복 없이 선택해야 합니다.",
    );
  }

  const { data: docs, error: docError } = await service
    .from("document")
    .select(
      "id, tenant_id, company_id, name, file_type, storage_url, size_bytes, doc_category",
    )
    .in("id", allIds);
  if (docError) throw new Error(`보고서 소스 문서 조회 실패: ${docError.message}`);

  const byId = new Map((docs ?? []).map((doc) => [doc.id, doc]));
  if (byId.size !== allIds.length) {
    throw new PermanentReportError("보고서 소스 자료를 찾을 수 없습니다.");
  }
  const orderedDocuments = allIds.map((id) => byId.get(id));
  if (orderedDocuments.some((document) => !document)) {
    throw new PermanentReportError("보고서 소스 자료를 찾을 수 없습니다.");
  }
  const validatedDocuments = orderedDocuments as DocumentRow[];
  for (const document of validatedDocuments) {
    if (document.tenant_id !== job.tenant_id || document.company_id !== job.company_id) {
      throw new PermanentReportError(
        "다른 기업 또는 워크스페이스의 자료는 사용할 수 없습니다.",
      );
    }
    if (document.doc_category === "보고서") {
      throw new PermanentReportError(
        "생성된 보고서 파일은 다시 보고서 소스로 사용할 수 없습니다.",
      );
    }
  }

  return {
    companyInfo: validatedDocuments.slice(0, companyInfoIds.length),
    meetingNote: validatedDocuments[validatedDocuments.length - 1],
  };
}

async function buildCompanyProfile(
  service: Service,
  companyId: string,
): Promise<{ companyName: string; text: string }> {
  const { data: company, error } = await service
    .from("company")
    .select(
      "name, biz_no, industry, business_condition, region, founded_date, revenue, headcount, ceo_name, memo",
    )
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw new Error(`회사 프로파일 조회 실패: ${error.message}`);
  if (!company) throw new PermanentReportError("기업을 찾을 수 없습니다.");

  const [credentials, tasks, schedules] = await Promise.all([
    service
      .from("credential")
      .select("type, issued_date, expires_date, memo")
      .eq("company_id", companyId)
      .limit(20),
    service
      .from("task")
      .select("title, stage, due_date, memo")
      .eq("company_id", companyId)
      .limit(20),
    service
      .from("schedule")
      .select("title, date, type, memo")
      .eq("company_id", companyId)
      .limit(20),
  ]);

  return {
    companyName: company.name,
    text: JSON.stringify(
      {
        company,
        credentials: credentials.data ?? [],
        tasks: tasks.data ?? [],
        schedules: schedules.data ?? [],
      },
      null,
      2,
    ),
  };
}

async function storeReportDocument(
  service: Service,
  job: ReportJob,
  report: ReportData,
  kind: ReportDocumentKind,
): Promise<StoredReportDocument> {
  const buffer = await buildReportDocx(report, { compact: kind === "summary" });
  const fileName = safeReportFileName(job.title, kind);
  const version = await nextDocumentVersion(service, job.company_id, fileName);
  const objectName = `${randomUUID()}.docx`;
  const storagePath = `${job.tenant_id}/${job.company_id}/${objectName}`;

  const { error: uploadError } = await service.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) throw new Error(`보고서 파일 업로드 실패: ${uploadError.message}`);

  const { data: inserted, error: insertError } = await service
    .from("document")
    .insert({
      tenant_id: job.tenant_id,
      company_id: job.company_id,
      name: fileName,
      doc_category: "보고서",
      version,
      uploaded_by: "consultant",
      storage_url: storageUrlFromPath(storagePath),
      file_type: "docx",
      size_bytes: buffer.byteLength,
    })
    .select("id")
    .single();

  if (insertError) {
    const { error: removeError } = await service.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .remove([storagePath]);
    if (removeError) {
      console.error("[storeReportDocument:cleanup]", removeError.message);
    }
    throw new Error(`보고서 문서 등록 실패: ${insertError.message}`);
  }
  return { documentId: inserted.id, storagePath };
}

async function cleanupStoredReportDocuments(
  service: Service,
  documents: StoredReportDocument[],
): Promise<void> {
  for (const document of [...documents].reverse()) {
    const [storageResult, databaseResult] = await Promise.all([
      service.storage.from(COMPANY_DOCUMENTS_BUCKET).remove([document.storagePath]),
      service.from("document").delete().eq("id", document.documentId),
    ]);
    if (storageResult.error) {
      console.error(
        "[cleanupStoredReportDocuments:storage]",
        document.storagePath,
        storageResult.error.message,
      );
    }
    if (databaseResult.error) {
      console.error(
        "[cleanupStoredReportDocuments:database]",
        document.documentId,
        databaseResult.error.message,
      );
    }
  }
}

async function processJob(service: Service, job: ReportJob): Promise<void> {
  const sourceDocuments = await loadSourceDocuments(service, job);
  const [companyProfile, companyTexts, meetingText] = await Promise.all([
    buildCompanyProfile(service, job.company_id),
    Promise.all(
      sourceDocuments.companyInfo.map((document) =>
        extractDocumentText(service, document),
      ),
    ),
    extractDocumentText(service, sourceDocuments.meetingNote),
  ]);

  const { bundle, model } = await generateMeetingReport({
    companyName: companyProfile.companyName,
    companyProfile: companyProfile.text,
    companyDocuments: sourceDocuments.companyInfo.map((document, index) => ({
      fileName: document.name,
      text: companyTexts[index],
    })),
    meetingNote: {
      fileName: sourceDocuments.meetingNote.name,
      text: meetingText,
    },
  });

  const storedDocuments: StoredReportDocument[] = [];
  try {
    const fullDocument = await storeReportDocument(service, job, bundle.full, "full");
    storedDocuments.push(fullDocument);
    const summaryDocument = await storeReportDocument(
      service,
      job,
      bundle.summary,
      "summary",
    );
    storedDocuments.push(summaryDocument);

    const update: MeetingReportUpdate = {
      status: "succeeded",
      model,
      report_json: bundle.full as unknown as MeetingReportUpdate["report_json"],
      summary_report_json:
        bundle.summary as unknown as MeetingReportUpdate["summary_report_json"],
      summary: reportSummary(bundle.summary),
      output_document_id: fullDocument.documentId,
      summary_output_document_id: summaryDocument.documentId,
      generated_at: new Date().toISOString(),
      last_error: null,
    };
    const { data: finalized, error } = await service
      .from("meeting_report")
      .update(update)
      .eq("id", job.id)
      .eq("status", "processing")
      .eq("attempts", job.attempts)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`보고서 상태 업데이트 실패: ${error.message}`);
    if (!finalized) {
      throw new SupersededReportError(
        "더 최신 실행이 이 보고서 생성 작업을 인계했습니다.",
      );
    }

    // Drive는 보조 백업 계층이다. 큐 적재 실패가 생성된 보고서나 성공 상태를
    // 되돌리지 않도록 별도 오류 경계에서 처리한다.
    if (job.requested_by) {
      try {
        await enqueueReportDocumentBackups(service, {
          tenantId: job.tenant_id,
          userId: job.requested_by,
          documentIds: [fullDocument.documentId, summaryDocument.documentId],
        });
      } catch (backupError) {
        console.error("[processJob:drive-backup]", backupError);
      }
    }
  } catch (error) {
    await cleanupStoredReportDocuments(service, storedDocuments);
    throw error;
  }
}

export async function runReportBatch(
  service: Service,
  batchSize = 1,
): Promise<ReportRunResult> {
  const staleBeforeIso = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60_000,
  ).toISOString();
  const { error: reclaimError } = await service
    .from("meeting_report")
    .update({ status: "pending" })
    .eq("status", "processing")
    .lt("updated_at", staleBeforeIso);
  if (reclaimError) {
    console.error("[runReportBatch:reclaim]", reclaimError.message);
  }

  const { data: dueJobs, error } = await service
    .from("meeting_report")
    .select("*")
    .eq("status", "pending")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(`보고서 잡 조회 실패: ${error.message}`);

  const result: ReportRunResult = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
  };
  for (const job of dueJobs ?? []) {
    const attempts = job.attempts + 1;
    const { data: claimed, error: claimError } = await service
      .from("meeting_report")
      .update({ status: "processing", attempts })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (claimError || !claimed) continue;

    result.claimed += 1;
    try {
      await processJob(service, claimed);
      result.succeeded += 1;
    } catch (error) {
      if (error instanceof SupersededReportError) continue;
      const message = error instanceof Error ? error.message : String(error);
      const permanent = isPermanent(error);
      if (permanent || attempts >= MAX_ATTEMPTS) {
        await service
          .from("meeting_report")
          .update({
            status: "failed",
            last_error: message.slice(0, 1000),
          })
          .eq("id", job.id)
          .eq("status", "processing")
          .eq("attempts", attempts);
        result.failed += 1;
      } else {
        await service
          .from("meeting_report")
          .update({
            status: "pending",
            last_error: message.slice(0, 1000),
            next_run_at: nextRunAtIso(attempts),
          })
          .eq("id", job.id)
          .eq("status", "processing")
          .eq("attempts", attempts);
        result.retried += 1;
      }
    }
  }
  return result;
}
