import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  isSupabaseDemoAllowed,
} from "@/lib/supabase/env";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthEntry =
    pathname === "/" || pathname === "/login" || pathname === "/signup";

  if (user && isAuthEntry) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (!user && pathname.startsWith("/app")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/reset", "/app/:path*", "/app"],
};
