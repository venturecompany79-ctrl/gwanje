"use server";

import { revalidatePath } from "next/cache";
import {
  assertCompanyAccess,
  optionalText,
  parseOptionalDate,
  requirePermission,
  type ActionResult,
} from "@/lib/actions/shared";
import type { ProgramReviewDecision } from "@/lib/data/company-programs";
import type { MatchProfileSourceKind } from "@/lib/gov-programs/profile-types";
import { safeHttpUrl } from "@/lib/gov-programs/types";
import { createClient } from "@/lib/supabase/server";

export interface ProgramTaskResult extends ActionResult {
  taskId?: string;
  existed?: boolean;
}

const SOURCE_KINDS: MatchProfileSourceKind[] = [
  "credential",
  "ip_right",
  "task",
  "meeting_report",
  "document",
];

function revalidateProgramScreens(companyId: string) {
  revalidatePath(`/app/companies/${companyId}/gov-programs`);
  revalidatePath(`/app/companies/${companyId}`);
  revalidatePath("/app/companies");
  revalidatePath("/app/board");
}

export async function setProgramDecision(
  companyId: string,
  programId: string,
  decision: ProgramReviewDecision | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "데모 모드에서는 검토 상태가 저장되지 않습니다." };
  if (decision !== null && decision !== "saved" && decision !== "excluded") {
    return { ok: false, error: "검토 상태가 올바르지 않습니다." };
  }

  const member = await requirePermission(supabase, "tasks.write");
  if ("error" in member) return { ok: false, error: member.error };
  const access = await assertCompanyAccess(supabase, companyId, member.tenantId);
  if (!access.ok) return access;

  const program = await supabase.from("gov_program").select("id").eq("id", programId).maybeSingle();
  if (program.error || !program.data) {
    return { ok: false, error: "공고를 찾을 수 없습니다." };
  }

  if (decision === null) {
    const { error } = await supabase
      .from("company_gov_program_review")
      .delete()
      .eq("company_id", companyId)
      .eq("gov_program_id", programId);
    if (error) return { ok: false, error: `상태를 변경하지 못했습니다: ${error.message}` };
  } else {
    const { error } = await supabase.from("company_gov_program_review").upsert(
      {
        tenant_id: member.tenantId,
        company_id: companyId,
        gov_program_id: programId,
        decision,
        decided_by: member.userId,
      },
      { onConflict: "tenant_id,company_id,gov_program_id" },
    );
    if (error) return { ok: false, error: `상태를 저장하지 못했습니다: ${error.message}` };
  }

  revalidateProgramScreens(companyId);
  return { ok: true, error: null };
}

async function verifySource(
  companyId: string,
  kind: MatchProfileSourceKind,
  sourceId: string,
): Promise<{ ok: true; label: string; updatedAt: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "데모 모드에서는 변경할 수 없습니다." };

  if (kind === "credential") {
    const result = await supabase.from("credential").select("type, created_at").eq("company_id", companyId).eq("id", sourceId).maybeSingle();
    return result.data ? { ok: true, label: result.data.type, updatedAt: result.data.created_at } : { ok: false, error: "자격·인증 자료를 찾을 수 없습니다." };
  }
  if (kind === "ip_right") {
    const result = await supabase.from("ip_right").select("title, updated_at").eq("company_id", companyId).eq("id", sourceId).maybeSingle();
    return result.data ? { ok: true, label: result.data.title, updatedAt: result.data.updated_at } : { ok: false, error: "특허·상표 자료를 찾을 수 없습니다." };
  }
  if (kind === "task") {
    const result = await supabase.from("task").select("title, updated_at").eq("company_id", companyId).eq("id", sourceId).maybeSingle();
    return result.data ? { ok: true, label: result.data.title, updatedAt: result.data.updated_at } : { ok: false, error: "Task 자료를 찾을 수 없습니다." };
  }
  if (kind === "meeting_report") {
    const result = await supabase.from("meeting_report").select("title, updated_at").eq("company_id", companyId).eq("id", sourceId).maybeSingle();
    return result.data ? { ok: true, label: result.data.title, updatedAt: result.data.updated_at } : { ok: false, error: "미팅 보고서를 찾을 수 없습니다." };
  }
  if (kind === "document") {
    const result = await supabase.from("document").select("name, created_at").eq("company_id", companyId).eq("id", sourceId).maybeSingle();
    return result.data ? { ok: true, label: result.data.name, updatedAt: result.data.created_at } : { ok: false, error: "등록 자료를 찾을 수 없습니다." };
  }
  return { ok: false, error: "기업 기본정보는 매칭에서 제외할 수 없습니다." };
}

export async function setProfileSourceIncluded(
  companyId: string,
  kind: MatchProfileSourceKind,
  sourceId: string,
  included: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "데모 모드에서는 변경할 수 없습니다." };
  if (!SOURCE_KINDS.includes(kind)) return { ok: false, error: "자료 유형이 올바르지 않습니다." };

  const member = await requirePermission(supabase, "companies.write");
  if ("error" in member) return { ok: false, error: member.error };
  const access = await assertCompanyAccess(supabase, companyId, member.tenantId);
  if (!access.ok) return access;
  const source = await verifySource(companyId, kind, sourceId);
  if (!source.ok) return { ok: false, error: source.error };

  const sourceKey = {
    tenant_id: member.tenantId,
    company_id: companyId,
    source_kind: kind,
    source_id: sourceId,
  };
  const updated = await supabase
    .from("company_match_profile_source")
    .update({
      label: source.label,
      included,
      source_updated_at: source.updatedAt,
    })
    .match(sourceKey)
    .select("id")
    .maybeSingle();
  if (updated.error) {
    return { ok: false, error: `자료 설정을 저장하지 못했습니다: ${updated.error.message}` };
  }
  if (!updated.data) {
    const { error } = await supabase.from("company_match_profile_source").insert({
      ...sourceKey,
      label: source.label,
      included,
      source_updated_at: source.updatedAt,
      extraction_status: kind === "document" ? "pending" : "skipped",
    });
    if (error) return { ok: false, error: `자료 설정을 저장하지 못했습니다: ${error.message}` };
  }

  await supabase
    .from("company_match_profile")
    .update({ status: "stale" })
    .eq("company_id", companyId);
  revalidateProgramScreens(companyId);
  return { ok: true, error: null };
}

export async function createTaskFromProgram(
  companyId: string,
  programId: string,
  formData: FormData,
): Promise<ProgramTaskResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "데모 모드에서는 Task를 저장할 수 없습니다." };
  const member = await requirePermission(supabase, "tasks.write");
  if ("error" in member) return { ok: false, error: member.error };
  const access = await assertCompanyAccess(supabase, companyId, member.tenantId);
  if (!access.ok) return access;

  const [company, program, existing, category] = await Promise.all([
    supabase.from("company").select("status").eq("id", companyId).maybeSingle(),
    supabase
      .from("gov_program")
      .select("id, title, org_name, apply_end, detail_url")
      .eq("id", programId)
      .maybeSingle(),
    supabase
      .from("task")
      .select("id")
      .eq("company_id", companyId)
      .eq("source_gov_program_id", programId)
      .maybeSingle(),
    supabase.from("category").select("id").eq("name", "정부지원사업").maybeSingle(),
  ]);
  if (company.data?.status !== "active") {
    return { ok: false, error: "관리 종료 기업에는 Task를 추가할 수 없습니다." };
  }
  if (!program.data) return { ok: false, error: "공고를 찾을 수 없습니다." };
  if (existing.data) return { ok: true, error: null, taskId: existing.data.id, existed: true };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Task명을 입력해 주세요." };
  const dueDate = parseOptionalDate(formData, "due_date", "마감일");
  if (!dueDate.ok) return { ok: false, error: dueDate.error };
  const originalUrl = safeHttpUrl(program.data.detail_url);
  const defaultMemo = [
    `원본 공고: ${program.data.title}`,
    program.data.org_name ? `주관기관: ${program.data.org_name}` : null,
    originalUrl ? `공고 링크: ${originalUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const userMemo = optionalText(formData, "memo");

  const { data: task, error } = await supabase
    .from("task")
    .insert({
      tenant_id: member.tenantId,
      company_id: companyId,
      title,
      category_id: category.data?.id ?? null,
      stage: "application",
      work_status: "planned",
      due_date: dueDate.value ?? program.data.apply_end,
      assignee_id: member.userId,
      source_gov_program_id: programId,
      memo: [defaultMemo, userMemo].filter(Boolean).join("\n\n") || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const duplicate = await supabase
        .from("task")
        .select("id")
        .eq("company_id", companyId)
        .eq("source_gov_program_id", programId)
        .maybeSingle();
      if (duplicate.data) return { ok: true, error: null, taskId: duplicate.data.id, existed: true };
    }
    return { ok: false, error: `Task를 만들지 못했습니다: ${error.message}` };
  }

  revalidateProgramScreens(companyId);
  return { ok: true, error: null, taskId: task.id, existed: false };
}
