"use server";

// 기업 상세 전용 서버 액션 — 자격·기업 정보.
// 과제(관리포인트) 액션은 보드와 공용이라 lib/actions/tasks.ts에 있다.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  getTenantContext,
  optionalText,
  type ActionResult,
} from "@/lib/actions/shared";

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
