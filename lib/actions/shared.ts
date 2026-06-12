// 서버 액션 공용 헬퍼 — "use server" 파일은 async 함수만 export 가능하므로 분리
import type { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

export const DEMO_ERROR =
  "데모 모드에서는 저장되지 않습니다. Supabase 연결(.env.local) 후 이용해 주세요.";

export function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

export type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

// RLS insert 정책은 tenant_id 일치를 요구 — 본인 프로필에서 조회해 채운다
export async function getTenantContext(
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
