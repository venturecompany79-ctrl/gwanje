"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assertCompanyAccess,
  DEMO_ERROR,
  getTenantContext,
  requirePermission,
  type ActionResult,
} from "@/lib/actions/shared";
import { isReportSourceSupported, reportSourceHelpText } from "@/lib/reports/file-types";
import { reportGenerationEnabled } from "@/lib/reports/config";
import { triggerReportGenerationAfterResponse } from "@/lib/reports/trigger";

type CreateReportResult = ActionResult & { reportId?: string };

function revalidateCompany(companyId: string) {
  revalidatePath(`/app/companies/${companyId}`);
}

function formText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createMeetingReport(
  companyId: string,
  formData: FormData,
): Promise<CreateReportResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };
  if (!reportGenerationEnabled()) {
    return { ok: false, error: "보고서 생성 AI가 설정되지 않았습니다. 관리자에게 문의해 주세요." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const access = await assertCompanyAccess(supabase, companyId, ctx.tenantId);
  if (!access.ok) return access;

  const companyInfoId = formText(formData, "company_info_document_id");
  const meetingNoteId = formText(formData, "meeting_note_document_id");
  if (!companyInfoId || !meetingNoteId) {
    return { ok: false, error: "회사정보 자료와 회의록 자료를 선택해 주세요." };
  }
  if (companyInfoId === meetingNoteId) {
    return { ok: false, error: "회사정보와 회의록은 서로 다른 자료를 선택해 주세요." };
  }

  const { data: company, error: companyError } = await supabase
    .from("company")
    .select("name")
    .eq("id", companyId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (companyError || !company) {
    return {
      ok: false,
      error: `기업 확인에 실패했습니다: ${companyError?.message ?? "기업 없음"}`,
    };
  }

  const { data: docs, error: docsError } = await supabase
    .from("document")
    .select("id, name, file_type, doc_category")
    .eq("company_id", companyId)
    .eq("tenant_id", ctx.tenantId)
    .in("id", [companyInfoId, meetingNoteId]);
  if (docsError) {
    return { ok: false, error: `자료 확인에 실패했습니다: ${docsError.message}` };
  }
  if ((docs ?? []).length !== 2) {
    return { ok: false, error: "선택한 자료를 찾을 수 없습니다." };
  }
  const unsupported = (docs ?? []).find((doc) => !isReportSourceSupported(doc.file_type));
  if (unsupported) {
    return {
      ok: false,
      error: `'${unsupported.name}'은(는) 지원하지 않는 파일입니다. 지원 형식: ${reportSourceHelpText()}`,
    };
  }
  const generatedReportDoc = (docs ?? []).find((doc) => doc.doc_category === "보고서");
  if (generatedReportDoc) {
    return { ok: false, error: "생성된 보고서 파일은 다시 소스로 사용할 수 없습니다." };
  }

  const title = formText(formData, "title") || `${company.name} 미팅 진단 보고서`;
  const { data: inserted, error: insertError } = await supabase
    .from("meeting_report")
    .insert({
      tenant_id: ctx.tenantId,
      company_id: companyId,
      requested_by: ctx.userId,
      title,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    return { ok: false, error: `보고서 생성 요청에 실패했습니다: ${insertError.message}` };
  }

  const { error: sourceError } = await supabase.from("meeting_report_source").insert([
    {
      tenant_id: ctx.tenantId,
      company_id: companyId,
      report_id: inserted.id,
      document_id: companyInfoId,
      role: "company_info",
    },
    {
      tenant_id: ctx.tenantId,
      company_id: companyId,
      report_id: inserted.id,
      document_id: meetingNoteId,
      role: "meeting_note",
    },
  ]);
  if (sourceError) {
    await supabase.from("meeting_report").delete().eq("id", inserted.id);
    return { ok: false, error: `보고서 소스 저장에 실패했습니다: ${sourceError.message}` };
  }

  triggerReportGenerationAfterResponse();
  revalidateCompany(companyId);
  return { ok: true, error: null, reportId: inserted.id };
}

export async function retryMeetingReport(
  companyId: string,
  reportId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "companies.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };
  if (!reportGenerationEnabled()) {
    return { ok: false, error: "보고서 생성 AI가 설정되지 않았습니다. 관리자에게 문의해 주세요." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: report, error: readError } = await supabase
    .from("meeting_report")
    .select("id, status")
    .eq("id", reportId)
    .eq("company_id", companyId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (readError) {
    return { ok: false, error: `보고서 확인에 실패했습니다: ${readError.message}` };
  }
  if (!report) return { ok: false, error: "보고서를 찾을 수 없습니다." };
  if (report.status === "processing") {
    return { ok: false, error: "이미 생성 중인 보고서입니다." };
  }

  const { error: updateError } = await supabase
    .from("meeting_report")
    .update({
      status: "pending",
      attempts: 0,
      last_error: null,
      next_run_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("tenant_id", ctx.tenantId);
  if (updateError) {
    return { ok: false, error: `재시도 등록에 실패했습니다: ${updateError.message}` };
  }

  triggerReportGenerationAfterResponse();
  revalidateCompany(companyId);
  return { ok: true, error: null };
}
