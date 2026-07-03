"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconAlert } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

// Google 공식 "G" 마크 (브랜드 가이드 4색)
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  /** "Google로 가입하기" / "Google로 로그인" */
  label: string;
  /** 인증 완료 후 이동할 내부 경로 — /auth/callback의 ?next=로 전달 */
  next?: string;
}

// Google OAuth 시작 버튼 — /signup(가입)·/login(로그인) 공용.
// PKCE: createBrowserClient가 code_verifier를 쿠키에 저장 → /auth/callback에서 서버가 교환.
export function GoogleAuthButton({ label, next = "/app" }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!supabase) {
    return (
      <Button variant="secondary" full disabled>
        <GoogleMark />
        {label}
      </Button>
    );
  }

  async function handleClick() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    // open redirect 방지 — LoginForm과 동일 규칙(내부 절대경로만)
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (oauthError) {
      setError("Google 인증을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
    // 성공 시 브라우저가 Google로 이동하므로 로딩 상태를 유지한다
  }

  return (
    <>
      {error ? (
        <div className="auth-error" role="alert">
          <IconAlert />
          {error}
        </div>
      ) : null}
      <Button variant="secondary" full type="button" disabled={loading} onClick={handleClick}>
        {loading ? (
          <>
            <span className="spin" />
            Google로 이동 중…
          </>
        ) : (
          <>
            <GoogleMark />
            {label}
          </>
        )}
      </Button>
    </>
  );
}
