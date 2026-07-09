"use server";

// 기업별 공유 대시보드 제어 액션 — 컨설턴트 전용(인증 세션 + RLS 경유).
// 공개 쪽(대표 입장)은 app/share/[token]/actions.ts 에 분리돼 있다.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assertCompanyAccess,
  DEMO_ERROR,
  requirePermission,
  type ActionResult,
  type Supabase,
} from "@/lib/actions/shared";
import { generateShareToken } from "@/lib/share/crypto";

export interface ShareActionResult extends ActionResult {
  /** 생성/재발급된 링크 토큰 — 성공 시에만 */
  shareToken?: string;
}

async function guard(
  companyId: string,
): Promise<{ supabase: Supabase; tenantId: string; userId: string } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: DEMO_ERROR };
  const member = await requirePermission(supabase, "companies.write");
  if ("error" in member) return { error: member.error };
  const access = await assertCompanyAccess(supabase, companyId, member.tenantId);
  if (!access.ok) return { error: access.error };
  return { supabase, tenantId: member.tenantId, userId: member.userId };
}

/** 공유 켜기 — 행이 없으면 새 토큰으로 생성, 있으면 enabled만 복구. */
export async function enableCompanyShare(
  companyId: string,
): Promise<ShareActionResult> {
  const ctx = await guard(companyId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, tenantId, userId } = ctx;

  const { data: existing, error: readError } = await supabase
    .from("company_share")
    .select("id, token")
    .eq("company_id", companyId)
    .maybeSingle();
  if (readError) {
    console.error("[enableCompanyShare:read]", readError.message);
    return { ok: false, error: `공유 설정 조회에 실패했습니다: ${readError.message}` };
  }

  if (existing) {
    const { error } = await supabase
      .from("company_share")
      .update({ enabled: true })
      .eq("id", existing.id);
    if (error) {
      console.error("[enableCompanyShare:update]", error.message);
      return { ok: false, error: `공유 활성화에 실패했습니다: ${error.message}` };
    }
    revalidatePath(`/app/companies/${companyId}`);
    return { ok: true, error: null, shareToken: existing.token };
  }

  const token = generateShareToken();
  const { error } = await supabase.from("company_share").insert({
    tenant_id: tenantId,
    company_id: companyId,
    token,
    created_by: userId,
  });
  if (error) {
    console.error("[enableCompanyShare:insert]", error.message);
    return { ok: false, error: `공유 생성에 실패했습니다: ${error.message}` };
  }
  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true, error: null, shareToken: token };
}

/** 공유 끄기 — 링크·비밀번호는 유지, 접근만 차단. */
export async function disableCompanyShare(
  companyId: string,
): Promise<ActionResult> {
  const ctx = await guard(companyId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("company_share")
    .update({ enabled: false })
    .eq("company_id", companyId);
  if (error) {
    console.error("[disableCompanyShare]", error.message);
    return { ok: false, error: `공유 중지에 실패했습니다: ${error.message}` };
  }
  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true, error: null };
}

/** rotate/reset 공통 — 기존 공유 행 조회(id + 세션 무효화용 버전) */
async function readShareForUpdate(
  supabase: Supabase,
  companyId: string,
  label: string,
): Promise<{ id: string; session_version: number } | { error: string }> {
  const { data, error } = await supabase
    .from("company_share")
    .select("id, session_version")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error(`[${label}:read]`, error.message);
    return { error: "공유 설정을 찾을 수 없습니다. 먼저 공유를 활성화해 주세요." };
  }
  return data;
}

/** 링크 재발급 — 기존 링크·세션 즉시 무효(토큰 회전 + session_version+1). 비밀번호는 유지. */
export async function rotateShareLink(
  companyId: string,
): Promise<ShareActionResult> {
  const ctx = await guard(companyId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const existing = await readShareForUpdate(ctx.supabase, companyId, "rotateShareLink");
  if ("error" in existing) return { ok: false, error: existing.error };

  const token = generateShareToken();
  const { error } = await ctx.supabase
    .from("company_share")
    .update({
      token,
      rotated_at: new Date().toISOString(),
      session_version: existing.session_version + 1,
    })
    .eq("id", existing.id);
  if (error) {
    console.error("[rotateShareLink]", error.message);
    return { ok: false, error: `링크 재발급에 실패했습니다: ${error.message}` };
  }
  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true, error: null, shareToken: token };
}

/** 비밀번호 초기화 — 대표가 다음 방문 때 새로 설정. 기존 세션 일괄 무효. */
export async function resetSharePassword(
  companyId: string,
): Promise<ActionResult> {
  const ctx = await guard(companyId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const existing = await readShareForUpdate(ctx.supabase, companyId, "resetSharePassword");
  if ("error" in existing) return { ok: false, error: existing.error };

  const { error } = await ctx.supabase
    .from("company_share")
    .update({
      password_hash: null,
      password_set_at: null,
      failed_attempts: 0,
      locked_until: null,
      session_version: existing.session_version + 1,
    })
    .eq("id", existing.id);
  if (error) {
    console.error("[resetSharePassword]", error.message);
    return { ok: false, error: `비밀번호 초기화에 실패했습니다: ${error.message}` };
  }
  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true, error: null };
}
