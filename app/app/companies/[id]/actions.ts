"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskStage } from "@/lib/database.types";

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

const DEMO_ERROR =
  "데모 모드에서는 저장되지 않습니다. Supabase 연결(.env.local) 후 이용해 주세요.";

const TASK_STAGES: TaskStage[] = ["diagnosis", "proposal", "application", "result"];

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

// RLS insert 정책은 tenant_id 일치를 요구 — 본인 프로필에서 조회해 채운다
async function getTenantContext(
  supabase: Supabase,
): Promise<{ tenantId: string; userId: string } | { error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "세션이 만료되었습니다. 다시 로그인해 주세요." };
  }
  const { data: profile, error } = await supabase
    .from("profile")
    .select("tenant_id")
    .eq("id", auth.user.id)
    .single();
  if (error || !profile) {
    return { error: "프로필 정보를 찾을 수 없습니다. seed.sql 적용 여부를 확인해 주세요." };
  }
  return { tenantId: profile.tenant_id, userId: auth.user.id };
}

function revalidateCompany(companyId: string) {
  revalidatePath(`/app/companies/${companyId}`);
  revalidatePath("/app/companies");
  revalidatePath("/app");
}

export async function addCredential(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const type = String(formData.get("type") ?? "").trim();
  if (!type) return { ok: false, error: "자격종류를 입력해 주세요." };

  const leadText = optionalText(formData, "renew_lead_days");
  const renewLeadDays = leadText === null ? 60 : Number.parseInt(leadText, 10);
  if (!Number.isFinite(renewLeadDays) || renewLeadDays < 0) {
    return { ok: false, error: "갱신 준비 기간은 0 이상의 숫자(일)로 입력해 주세요." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase.from("credential").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    type,
    category_id: optionalText(formData, "category_id"),
    issued_date: optionalText(formData, "issued_date"),
    expires_date: optionalText(formData, "expires_date"),
    renew_lead_days: renewLeadDays,
    memo: optionalText(formData, "memo"),
  });
  if (error) return { ok: false, error: `저장에 실패했습니다: ${error.message}` };

  revalidateCompany(companyId);
  return { ok: true, error: null };
}

/** 임박 자격 → 갱신 과제 자동 생성 (자격·인증 탭 액션) */
export async function createRenewalTask(
  companyId: string,
  credentialId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: credential, error: credentialError } = await supabase
    .from("credential")
    .select("type, category_id, expires_date")
    .eq("id", credentialId)
    .maybeSingle();
  if (credentialError || !credential) {
    return { ok: false, error: "자격 정보를 찾을 수 없습니다." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("task")
    .select("id")
    .eq("source_credential_id", credentialId)
    .limit(1);
  if (existingError) {
    return { ok: false, error: `확인에 실패했습니다: ${existingError.message}` };
  }
  if (existing && existing.length > 0) {
    return { ok: false, error: "이미 이 자격의 갱신 과제가 있습니다." };
  }

  const { error } = await supabase.from("task").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    title: `${credential.type} 갱신`,
    category_id: credential.category_id,
    stage: "diagnosis",
    due_date: credential.expires_date,
    assignee_id: ctx.userId,
    source_credential_id: credentialId,
  });
  if (error) return { ok: false, error: `생성에 실패했습니다: ${error.message}` };

  revalidateCompany(companyId);
  revalidatePath("/app/board");
  return { ok: true, error: null };
}

export async function addTask(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "과제명을 입력해 주세요." };

  const stage = String(formData.get("stage") ?? "diagnosis") as TaskStage;
  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase.from("task").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    title,
    category_id: optionalText(formData, "category_id"),
    stage,
    due_date: optionalText(formData, "due_date"),
    assignee_id: ctx.userId,
    memo: optionalText(formData, "memo"),
  });
  if (error) return { ok: false, error: `저장에 실패했습니다: ${error.message}` };

  revalidateCompany(companyId);
  revalidatePath("/app/board");
  return { ok: true, error: null };
}

/** 과제 슬라이드오버 [변경 저장] — 단계 + 메모 */
export async function updateTask(
  companyId: string,
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const stage = String(formData.get("stage") ?? "") as TaskStage;
  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const { error } = await supabase
    .from("task")
    .update({
      stage,
      memo: optionalText(formData, "memo"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: `저장에 실패했습니다: ${error.message}` };

  revalidateCompany(companyId);
  revalidatePath("/app/board");
  return { ok: true, error: null };
}

export async function updateCompany(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "기업명을 입력해 주세요." };

  const revenueEok = optionalText(formData, "revenue");
  const revenue =
    revenueEok === null ? null : Math.round(Number(revenueEok) * 100_000_000);
  if (revenue !== null && !Number.isFinite(revenue)) {
    return { ok: false, error: "연 매출은 숫자(억 원)로 입력해 주세요." };
  }

  const headcountText = optionalText(formData, "headcount");
  const headcount =
    headcountText === null ? null : Number.parseInt(headcountText, 10);
  if (headcount !== null && !Number.isFinite(headcount)) {
    return { ok: false, error: "인원은 숫자로 입력해 주세요." };
  }

  const conditionTags = (optionalText(formData, "condition_tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("company")
    .update({
      name,
      biz_no: optionalText(formData, "biz_no"),
      industry: optionalText(formData, "industry"),
      founded_date: optionalText(formData, "founded_date"),
      revenue,
      headcount,
      ceo_name: optionalText(formData, "ceo_name"),
      contact_name: optionalText(formData, "contact_name"),
      contact_phone: optionalText(formData, "contact_phone"),
      contact_email: optionalText(formData, "contact_email"),
      condition_tags: conditionTags,
      memo: optionalText(formData, "memo"),
    })
    .eq("id", companyId);
  if (error) return { ok: false, error: `저장에 실패했습니다: ${error.message}` };

  revalidateCompany(companyId);
  return { ok: true, error: null };
}
