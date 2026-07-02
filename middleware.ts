import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  isSupabaseDemoAllowed,
} from "@/lib/supabase/env";
import { isBillingEnabled } from "@/lib/billing/config";

// 라우팅 규칙 (CLAUDE.md 4절):
// - 세션 있음 + `/`·`/login`·`/signup` → `/app`
// - 세션 없음 + `/app/*` → `/login?redirect=`
// - 그 외 공개 페이지 통과
// Supabase env 미설정(데모 모드)이면 보호 없이 통과시켜 화면 확인을 허용한다.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  const isConfigGuarded =
    pathname.startsWith("/app") ||
    pathname === "/login" ||
    pathname === "/signup" ||
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
  const isAppPath = pathname.startsWith("/app");

  let profileStatus: string | null = null;
  if (isAuthenticated && (isAuthEntry || isAppPath)) {
    const { data: profile } = await supabase
      .from("profile")
      .select("status")
      .eq("id", claims?.claims.sub)
      .maybeSingle();
    profileStatus = profile?.status ?? null;
  }

  const isActiveMember = profileStatus === "active";

  if (isAuthenticated && isAuthEntry && isActiveMember) {
    return NextResponse.redirect(new URL("/app", request.url));
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
  matcher: ["/", "/login", "/signup", "/reset", "/app/:path*", "/app"],
};
