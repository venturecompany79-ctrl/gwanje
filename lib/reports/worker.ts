import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { COMPANY_DOCUMENTS_BUCKET, storageUrlFromPath } from "@/lib/storage";
import { todayKstDate } from "@/lib/datetime";
import { buildReportDocx } from "@/lib/reports/docx";
import { extractDocumentText, UnsupportedReportSourceError } from "@/lib/reports/extract";
import { generateMeetingReport, ReportGenerationError } from "@/lib/reports/llm";
import type { MeetingReportSourceRole, ReportData } from "@/lib/reports/types";

type Service = SupabaseClient<Database>;
type ReportJob = Database["public"]["Tables"]["meeting_report"]["Row"];
type DocumentRow = Pick<
  Database["public"]["Tables"]["document"]["Row"],
  "id" | "tenant_id" | "company_id" | "name" | "file_type" | "storage_url" | "size_bytes"
>;

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

function isPermanent(error: unknown): boolean {
  return (
    error instanceof PermanentReportError ||
    error instanceof UnsupportedReportSourceError ||
    error instanceof ReportGenerationError
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

function safeReportFileName(title: string): string {
  const safeTitle = title.replace(/[\\/:*?"<>|\n\r\t]+/g, "").trim() || "미팅 보고서";
  return `${safeTitle}_${todayKstDate().replaceAll("-", "")}.docx`;
}

async function loadSourceDocuments(
  service: Service,
  job: ReportJob,
): Promise<Record<MeetingReportSourceRole, DocumentRow>> {
  const { data: sources, error: sourceError } = await service
    .from("meeting_report_source")
    .select("role, document_id")
    .eq("report_id", job.id);
  if (sourceError) throw new Error(`보고서 소스 조회 실패: ${sourceError.message}`);

  const idsByRole = new Map<MeetingReportSourceRole, string>();
  for (const source of sources ?? []) {
    idsByRole.set(source.role, source.document_id);
  }
  const companyInfoId = idsByRole.get("company_info");
  const meetingNoteId = idsByRole.get("meeting_note");
  if (!companyInfoId || !meetingNoteId) {
    throw new PermanentReportError("회사정보와 회의록 자료가 모두 필요합니다.");
  }

  const { data: docs, error: docError } = await service
    .from("document")
    .select("id, tenant_id, company_id, name, file_type, storage_url, size_bytes")
    .in("id", [companyInfoId, meetingNoteId]);
  if (docError) throw new Error(`보고서 소스 문서 조회 실패: ${docError.message}`);

  const byId = new Map((docs ?? []).map((doc) => [doc.id, doc]));
  const companyInfo = byId.get(companyInfoId);
  const meetingNote = byId.get(meetingNoteId);
  if (!companyInfo || !meetingNote) {
    throw new PermanentReportError("보고서 소스 자료를 찾을 수 없습니다.");
  }
  for (const doc of [companyInfo, meetingNote]) {
    if (doc.tenant_id !== job.tenant_id || doc.company_id !== job.company_id) {
      throw new PermanentReportError("다른 기업 또는 워크스페이스의 자료는 사용할 수 없습니다.");
    }
  }

  return { company_info: companyInfo, meeting_note: meetingNote };
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
): Promise<string> {
  const buffer = await buildReportDocx(report);
  const objectName = `${randomUUID()}.docx`;
  const path = `${job.tenant_id}/${job.company_id}/${objectName}`;
  const fileName = safeReportFileName(job.title);

  const { error: uploadError } = await service.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .upload(path, buffer, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) throw new Error(`보고서 파일 업로드 실패: ${uploadError.message}`);

  const version = await nextDocumentVersion(service, job.company_id, fileName);
  const { data: inserted, error: insertError } = await service
    .from("document")
    .insert({
      tenant_id: job.tenant_id,
      company_id: job.company_id,
      name: fileName,
      doc_category: "보고서",
      version,
      uploaded_by: "consultant",
      storage_url: storageUrlFromPath(path),
      file_type: "docx",
      size_bytes: buffer.byteLength,
    })
    .select("id")
    .single();

  if (insertError) {
    await service.storage.from(COMPANY_DOCUMENTS_BUCKET).remove([path]);
    throw new Error(`보고서 문서 등록 실패: ${insertError.message}`);
  }
  return inserted.id;
}

async function processJob(service: Service, job: ReportJob): Promise<void> {
  const sourceDocs = await loadSourceDocuments(service, job);
  const [companyProfile, companyText, meetingText] = await Promise.all([
    buildCompanyProfile(service, job.company_id),
    extractDocumentText(service, sourceDocs.company_info),
    extractDocumentText(service, sourceDocs.meeting_note),
  ]);

  const { data: report, model } = await generateMeetingReport({
    companyName: companyProfile.companyName,
    companyProfile: companyProfile.text,
    companyText,
    meetingText,
  });
  const outputDocumentId = await storeReportDocument(service, job, report);

  const { error } = await service
    .from("meeting_report")
    .update({
      status: "succeeded",
      model,
      report_json: report as unknown as Database["public"]["Tables"]["meeting_report"]["Update"]["report_json"],
      summary: reportSummary(report),
      output_document_id: outputDocumentId,
      generated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", job.id);
  if (error) throw new Error(`보고서 상태 업데이트 실패: ${error.message}`);
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

  const result: ReportRunResult = { claimed: 0, succeeded: 0, failed: 0, retried: 0 };
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanent = isPermanent(err);
      if (permanent || attempts >= MAX_ATTEMPTS) {
        await service
          .from("meeting_report")
          .update({
            status: "failed",
            last_error: message.slice(0, 1000),
          })
          .eq("id", job.id);
        result.failed += 1;
      } else {
        await service
          .from("meeting_report")
          .update({
            status: "pending",
            last_error: message.slice(0, 1000),
            next_run_at: nextRunAtIso(attempts),
          })
          .eq("id", job.id);
        result.retried += 1;
      }
    }
  }
  return result;
}
