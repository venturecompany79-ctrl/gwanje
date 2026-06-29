import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * service_role 키 기반 Supabase 클라이언트 — RLS를 우회한다.
 * ⚠️ 사용자 세션이 없는 백엔드 작업(동기화 워커)에서만, 서버에서만 사용할 것.
 *    절대 클라이언트/미들웨어/일반 서버 액션에서 쓰지 말 것.
 * 환경변수 미설정이면 null(워커가 503으로 응답).
 */
export function createServiceClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
