"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AddCompanyResult {
  ok: boolean;
  error: string | null;
}

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

export async function addCompany(formData: FormData): Promise<AddCompanyResult> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      ok: false,
      error: "데모 모드에서는 저장되지 않습니다. Supabase 연결(.env.local) 후 이용해 주세요.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "기업명을 입력해 주세요." };

  const revenueEok = optionalText(formData, "revenue");
  const revenue = revenueEok === null ? null : Math.round(Number(revenueEok) * 100_000_000);
  if (revenue !== null && !Number.isFinite(revenue)) {
    return { ok: false, error: "연 매출은 숫자(억 원)로 입력해 주세요." };
  }

  const headcountText = optionalText(formData, "headcount");
  const headcount = headcountText === null ? null : Number.parseInt(headcountText, 10);
  if (headcount !== null && !Number.isFinite(headcount)) {
    return { ok: false, error: "인원은 숫자로 입력해 주세요." };
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "세션이 만료되었습니다. 다시 로그인해 주세요." };
  }

  // RLS insert 정책은 tenant_id 일치를 요구 — 본인 프로필에서 조회해 채운다
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("tenant_id")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile) {
    return { ok: false, error: "프로필 정보를 찾을 수 없습니다. seed.sql 적용 여부를 확인해 주세요." };
  }

  const conditionTags = (optionalText(formData, "condition_tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { error } = await supabase.from("company").insert({
    tenant_id: profile.tenant_id,
    name,
    industry: optionalText(formData, "industry"),
    founded_date: optionalText(formData, "founded_date"),
    revenue,
    headcount,
    ceo_name: optionalText(formData, "ceo_name"),
    condition_tags: conditionTags,
  });
  if (error) {
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/companies");
  return { ok: true, error: null };
}
