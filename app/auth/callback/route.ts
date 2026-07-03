import { NextResponse } from "next/server";
import { isSignupEnabled } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";

// Google OAuth PKCE 콜백 — code를 세션으로 교환한 뒤 profile 유무/상태로 분기한다.
//  - active profile        → next(기존 회원 로그인)
//  - invited/disabled      → signOut 후 /login?status=inactive (초대 수락은 /invite/accept 경로)
//  - profile 없음 + 가입 ON → /signup/complete (온보딩에서 워크스페이스 프로비저닝)
//  - profile 없음 + 가입 OFF→ signOut 후 /login?error=signup_disabled
// middleware matcher에 이 경로를 넣지 않는다(교환 전 세션 검사로 간섭하지 않도록).
export const dynamic = "force-dynamic";

// open redirect 방지 — 내부 절대경로만 허용(LoginForm과 동일 규칙)
function sanitizeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  const loginWith = (params: Record<string, string>) => {
    const login = new URL("/login", request.url);
    for (const [key, value] of Object.entries(params)) {
      login.searchParams.set(key, value);
    }
    return NextResponse.redirect(login);
  };

  if (url.searchParams.get("error") || !code) {
    return loginWith({ error: "oauth" });
  }

  const supabase = await createClient();
  if (!supabase) return loginWith({ error: "oauth" }); // 데모 모드에서는 도달하지 않음

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    // PKCE verifier 쿠키 유실(다른 브라우저에서 열기 등) 포함 — 로그인으로 안전 복귀
    console.error("[auth:callback]", error?.code, error?.message);
    return loginWith({ error: "oauth" });
  }

  // 본인 profile 행은 RLS(self select)로 조회 가능 — service key 불필요
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[auth:callback:profile]", profileError.code, profileError.message);
    return loginWith({ error: "oauth" });
  }

  if (profile?.status === "active") {
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (profile) {
    await supabase.auth.signOut();
    return loginWith({ status: "inactive" });
  }

  if (!isSignupEnabled()) {
    await supabase.auth.signOut();
    return loginWith({ error: "signup_disabled" });
  }

  return NextResponse.redirect(new URL("/signup/complete", request.url));
}
