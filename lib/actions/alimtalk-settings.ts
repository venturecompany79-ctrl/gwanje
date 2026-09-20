"use server";

// 알림톡 연동 설정 서버 액션 — 설정 → 알림톡 화면.
// 각 컨설팅사가 자기 Solapi 계정을 연결한다(발송 요금도 그 계정에서 차감).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  optionalText,
  requirePermission,
  type ActionResult,
} from "@/lib/actions/shared";
import { isAlimtalkConfigured } from "@/lib/alimtalk/config";
import { encryptCred } from "@/lib/alimtalk/crypto";
import { normalizeKoreanMobile } from "@/lib/alimtalk/phone";
import { getBalance } from "@/lib/alimtalk/solapi";

export async function saveAlimtalkSettings(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "campaigns.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (!isAlimtalkConfigured()) {
    return {
      ok: false,
      error: "서버에 알림톡 암호화 키(ALIMTALK_CRED_KEY)가 설정되지 않았습니다.",
    };
  }

  const apiKey = optionalText(formData, "api_key");
  const apiSecret = optionalText(formData, "api_secret");
  const pfId = optionalText(formData, "pf_id");
  const senderPhoneRaw = optionalText(formData, "sender_phone");
  const smsFallback = formData.get("sms_fallback") !== null;

  if (!apiKey || !apiSecret || !pfId || !senderPhoneRaw) {
    return {
      ok: false,
      error: "API 키·시크릿·채널 ID(pfId)·발신번호를 모두 입력해 주세요.",
    };
  }

  const senderPhone = normalizeKoreanMobile(senderPhoneRaw);
  if (!senderPhone) {
    return {
      ok: false,
      error: "발신번호는 Solapi에 사전 등록한 휴대폰 번호 형식으로 입력해 주세요.",
    };
  }

  // 저장 전에 실제로 통하는 키인지 확인한다 — 잘못된 키를 저장하면
  // 발송 시점에야 전건 실패로 드러나기 때문.
  try {
    await getBalance({ apiKey, apiSecret, pfId, senderPhone, smsFallback });
  } catch (err) {
    console.error("[alimtalk:verify]", err);
    return {
      ok: false,
      error: "Solapi 인증에 실패했습니다. API 키와 시크릿을 다시 확인해 주세요.",
    };
  }

  const { error } = await supabase.from("alimtalk_settings").upsert(
    {
      tenant_id: allowed.tenantId,
      api_key_enc: encryptCred(apiKey),
      api_secret_enc: encryptCred(apiSecret),
      pf_id: pfId,
      sender_phone: senderPhone,
      sms_fallback: smsFallback,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    console.error("[saveAlimtalkSettings]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/campaigns");
  return { ok: true, error: null };
}

export async function disconnectAlimtalk(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "campaigns.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const { error } = await supabase
    .from("alimtalk_settings")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", allowed.tenantId);

  if (error) {
    console.error("[disconnectAlimtalk]", error.code, error.message);
    return { ok: false, error: `연동 해제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/campaigns");
  return { ok: true, error: null };
}
