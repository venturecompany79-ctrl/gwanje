"use server";

// 공유 대시보드 공개 서버 액션 — 인증 세션이 없는 고객사 대표가 호출한다.
// ⚠️ getMemberContext 등 인증 헬퍼 사용 금지. 신뢰 가능한 입력은 URL 토큰뿐이며,
//    모든 스코프는 token → company_share 행에서 도출한다.
//    service role 클라이언트 사용은 이 파일과 lib/data/company-share.ts 로 한정.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/actions/shared";
import type { Database } from "@/lib/database.types";
import { getShareCookieSecret, isCompanyShareConfigured } from "@/lib/share/config";
import {
  SHARE_INVALID_LINK_ERROR,
  SHARE_LOCKED_ERROR,
} from "@/lib/share/constants";
import {
  hashSharePassword,
  SHARE_PASSWORD_MAX,
  SHARE_PASSWORD_MIN,
  verifySharePassword,
} from "@/lib/share/crypto";
import {
  createShareSessionCookieValue,
  SHARE_SESSION_COOKIE,
  shareSessionCookieOptions,
} from "@/lib/share/session";
import { createServiceClient } from "@/lib/supabase/service";

interface ShareAuthRow {
  id: string;
  enabled: boolean;
  password_hash: string | null;
  session_version: number;
  locked_until: string | null;
}

async function loadShareForAuth(token: string): Promise<
  | { row: ShareAuthRow; secret: string; service: SupabaseClient<Database> }
  | { error: string }
> {
  if (!isCompanyShareConfigured()) return { error: SHARE_INVALID_LINK_ERROR };
  const secret = getShareCookieSecret();
  const service = createServiceClient();
  if (!secret || !service) return { error: SHARE_INVALID_LINK_ERROR };

  const { data, error } = await service
    .from("company_share")
    .select("id, enabled, password_hash, session_version, locked_until")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[share:loadShareForAuth]", error.message);
    return { error: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
  // 열거 방지 — 없는 토큰과 중지된 공유를 같은 메시지로
  if (!data || !data.enabled) return { error: SHARE_INVALID_LINK_ERROR };
  return { row: data, secret, service };
}

function validatePassword(formData: FormData):
  | { ok: true; password: string }
  | { ok: false; error: string } {
  const password = String(formData.get("password") ?? "");
  if (
    password.length < SHARE_PASSWORD_MIN ||
    password.length > SHARE_PASSWORD_MAX
  ) {
    return {
      ok: false,
      error: `비밀번호는 ${SHARE_PASSWORD_MIN}자 이상 ${SHARE_PASSWORD_MAX}자 이하로 입력해 주세요.`,
    };
  }
  return { ok: true, password };
}

async function issueSessionCookie(
  secret: string,
  token: string,
  shareId: string,
  sessionVersion: number,
) {
  const cookieStore = await cookies();
  cookieStore.set(
    SHARE_SESSION_COOKIE,
    createShareSessionCookieValue(secret, shareId, sessionVersion),
    shareSessionCookieOptions(token),
  );
}

/** 대표 첫 방문 — 비밀번호 설정 후 즉시 입장. */
export async function setSharePassword(
  token: string,
  formData: FormData,
): Promise<ActionResult> {
  const loaded = await loadShareForAuth(token);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { row, secret, service } = loaded;

  const alreadySetError =
    "이미 비밀번호가 설정되어 있습니다. 새로고침 후 비밀번호로 입장해 주세요.";
  if (row.password_hash !== null) {
    return { ok: false, error: alreadySetError };
  }

  const parsed = validatePassword(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const confirm = String(formData.get("password_confirm") ?? "");
  if (parsed.password !== confirm) {
    return { ok: false, error: "비밀번호 확인이 일치하지 않습니다." };
  }

  // 동시 설정 레이스 방지 — 아직 미설정(null)인 경우에만 갱신
  const { data: updated, error } = await service
    .from("company_share")
    .update({
      password_hash: await hashSharePassword(parsed.password),
      password_set_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .is("password_hash", null)
    .select("id");

  if (error) {
    console.error("[share:setSharePassword]", error.message);
    return { ok: false, error: "비밀번호 설정에 실패했습니다. 다시 시도해 주세요." };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: alreadySetError };
  }

  await issueSessionCookie(secret, token, row.id, row.session_version);
  return { ok: true, error: null };
}

/** 재방문 — 비밀번호 확인 후 입장. 5회 실패 시 10분 잠금(집행: DB 함수). */
export async function enterSharePassword(
  token: string,
  formData: FormData,
): Promise<ActionResult> {
  const loaded = await loadShareForAuth(token);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { row, secret, service } = loaded;

  if (row.password_hash === null) {
    return {
      ok: false,
      error: "비밀번호가 초기화되었습니다. 새로고침 후 비밀번호를 다시 설정해 주세요.",
    };
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { ok: false, error: SHARE_LOCKED_ERROR };
  }

  const password = String(formData.get("password") ?? "");
  const matched =
    password.length > 0 &&
    (await verifySharePassword(password, row.password_hash));

  if (!matched) {
    // 원자적 증가 + 잠금 판정은 DB 함수가 수행 (동시 요청 레이스 방지)
    const { data: failure, error } = await service.rpc(
      "company_share_record_failure",
      { p_share_id: row.id },
    );
    if (error) console.error("[share:enterSharePassword]", error.message);
    const lockedUntil = failure?.[0]?.out_locked_until ?? null;
    const nowLocked = Boolean(
      lockedUntil && new Date(lockedUntil).getTime() > Date.now(),
    );
    // 잠금 임계 잔여 횟수는 노출하지 않는다
    return {
      ok: false,
      error: nowLocked ? SHARE_LOCKED_ERROR : "비밀번호가 올바르지 않습니다.",
    };
  }

  const { error: resetError } = await service
    .from("company_share")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", row.id);
  if (resetError) {
    console.error("[share:enterSharePassword:reset]", resetError.message);
  }

  await issueSessionCookie(secret, token, row.id, row.session_version);
  return { ok: true, error: null };
}
