import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { decryptCred } from "@/lib/alimtalk/crypto";
import { isAlimtalkConfigured, isAlimtalkEnabled } from "@/lib/alimtalk/config";
import type { SolapiCredential } from "@/lib/alimtalk/solapi";

// 테넌트별 Solapi 연동 정보 조회 — 서버 전용.
// 복호화한 자격증명은 절대 클라이언트 컴포넌트로 넘기지 말 것.

type Client = SupabaseClient<Database>;

/**
 * 테넌트의 Solapi 자격증명을 복호화해 반환한다.
 * 미연동·비활성이거나 전역 플래그가 꺼져 있으면 null(호출부는 가짜 발송 유지).
 */
export async function getTenantAlimtalkCredential(
  client: Client,
  tenantId: string,
): Promise<SolapiCredential | null> {
  if (!isAlimtalkEnabled() || !isAlimtalkConfigured()) return null;

  const { data, error } = await client
    .from("alimtalk_settings")
    .select("api_key_enc, api_secret_enc, pf_id, sender_phone, sms_fallback, is_active")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[alimtalk:credential]", error.code, error.message);
    return null;
  }
  if (!data || !data.is_active) return null;

  try {
    return {
      apiKey: decryptCred(data.api_key_enc),
      apiSecret: decryptCred(data.api_secret_enc),
      pfId: data.pf_id,
      senderPhone: data.sender_phone,
      smsFallback: data.sms_fallback,
    };
  } catch (err) {
    // 암호화 키가 교체됐거나 손상된 경우 — 연동을 다시 저장해야 한다.
    console.error("[alimtalk:decrypt]", err);
    return null;
  }
}

/**
 * 이 테넌트가 실발송 가능한 상태인지(위저드 분기용).
 * 자격증명 자체가 필요 없는 곳에서 쓰도록 존재 여부만 확인한다.
 */
export async function isTenantAlimtalkLive(
  client: Client,
  tenantId: string,
): Promise<boolean> {
  if (!isAlimtalkEnabled() || !isAlimtalkConfigured()) return false;

  const { data, error } = await client
    .from("alimtalk_settings")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[alimtalk:live]", error.code, error.message);
    return false;
  }
  return Boolean(data);
}

/** 저장된 API 키를 화면에 보여줄 때 쓰는 마스킹(끝 4자리만). */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, apiKey.length - 4))}${apiKey.slice(-4)}`;
}
