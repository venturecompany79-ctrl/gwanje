"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  getTenantContext,
  optionalText,
  parseEokToWon,
  parseNonNegativeInt,
  type ActionResult,
} from "@/lib/actions/shared";

export type AddCompanyResult = ActionResult;

export async function addCompany(formData: FormData): Promise<AddCompanyResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "기업명을 입력해 주세요." };

  const revenue = parseEokToWon(formData, "revenue");
  if (!revenue.ok) return { ok: false, error: revenue.error };

  const headcount = parseNonNegativeInt(formData, "headcount", "인원");
  if (!headcount.ok) return { ok: false, error: headcount.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const conditionTags = (optionalText(formData, "condition_tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { error } = await supabase.from("company").insert({
    tenant_id: ctx.tenantId,
    name,
    industry: optionalText(formData, "industry"),
    founded_date: optionalText(formData, "founded_date"),
    revenue: revenue.value,
    headcount: headcount.value,
    ceo_name: optionalText(formData, "ceo_name"),
    condition_tags: conditionTags,
  });
  if (error) {
    console.error("[addCompany]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/companies");
  revalidatePath("/app");
  return { ok: true, error: null };
}
