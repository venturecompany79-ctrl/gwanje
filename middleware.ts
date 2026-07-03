import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  isSupabaseDemoAllowed,
} from "@/lib/supabase/env";
import { isBillingEnabled } from "@/lib/billing/config";
import { isSignupEnabled } from "@/lib/auth/config";

// 라우팅 규칙 (CLAUDE.md 4절):
// - 세션 있음 + `/`·`/login`·`/signup` → `/app`
// - 세션 없음 + `/app/*` → `/login?redirect=`
// - 세션 있음 + profile 없음(Google OAuth 가입 직후) → `/signup/complete` 온보딩
// - 그 외 공개 페이지 통과
// Supabase env 미설정(데모 모드)이면 보호 없이 통과시켜 화면 확인을 허용한다.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  const isConfigGuarded =
    pathname.startsWith("/app") ||
    pathname === "/login" ||
    pathname.startsWith("/signup") ||
    pathname === "/reset";

  if (!isSupabaseConfigured()) {
    if (isSupabaseDemoAllowed()) return NextResponse.next();

    if (isConfigGuarded) {
      return NextResponse.redirect(
        new URL("/configuration-error", request.url),
      );
    }

    return NextResponse.next();
  }

  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/configuration-error", request.url));
  }

  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose") === "prefetch";
  if (isPrefetch) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: claims } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claims?.claims.sub);
  const isAuthEntry =
    pathname === "/" || pathname === "/login" || pathname === "/signup";
  const isOnboarding = pathname === "/signup/complete";
  const isAppPath = pathname.startsWith("/app");

  // profile "행 없음"(가입 온보딩 전)과 "비활성 상태"(invited/disabled)를 구분한다
  let hasProfile = false;
  let profileStatus: string | null = null;
  if (isAuthenticated && (isAuthEntry || isOnboarding || isAppPath)) {
    const { data: profile } = await supabase
      .from("profile")
      .select("status")
      .eq("id", claims?.claims.sub)
      .maybeSingle();
    hasProfile = Boolean(profile);
    profileStatus = profile?.status ?? null;
  }

  const isActiveMember = profileStatus === "active";

  if (isAuthenticated && isAuthEntry && isActiveMember) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // Google OAuth 가입 직후(세션 O, profile X) — 어디서든 온보딩으로 고정
  if (
    isAuthenticated &&
    !hasProfile &&
    isSignupEnabled() &&
    !isOnboarding &&
    (isAuthEntry || isAppPath)
  ) {
    return NextResponse.redirect(new URL("/signup/complete", request.url));
  }

  if (isOnboarding) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isActiveMember) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    if (hasProfile || !isSignupEnabled()) {
      // invited/disabled 계정이거나 가입이 닫힌 상태 — 온보딩 불가
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("status", "inactive");
      return NextResponse.redirect(loginUrl);
    }
    return response; // 세션 O + profile X + 가입 ON → 온보딩 진행
  }

  if (!isAuthenticated && isAppPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isAppPath && !isActiveMember) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("status", "inactive");
    return NextResponse.redirect(loginUrl);
  }

  // 구독 접근 제어(피처 플래그 ON일 때만 — OFF면 쿼리 없이 기존 동작).
  // expired/미구독이면 /app/billing로 유도. 단 결제·설정 화면은 항상 허용.
  if (
    isAuthenticated &&
    isBillingEnabled() &&
    isAppPath &&
    !pathname.startsWith("/app/billing") &&
    !pathname.startsWith("/app/settings")
  ) {
    const { data: sub } = await supabase
      .from("tenant_subscription")
      .select("status")
      .maybeSingle();
    const status = sub?.status ?? null;
    if (status === null || status === "expired") {
      return NextResponse.redirect(new URL("/app/billing", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/signup/complete",
    "/reset",
    "/app/:path*",
    "/app",
  ],
};
