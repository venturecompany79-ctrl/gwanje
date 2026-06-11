"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconAlert } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError("이메일 또는 비밀번호를 확인해 주세요.");
      setLoading(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  if (!supabase) {
    return (
      <div className="auth-card">
        <div>
          <h1>로그인</h1>
          <p className="auth-sub">관제 워크스페이스에 오신 것을 환영합니다.</p>
        </div>
        <div className="auth-notice">
          Supabase가 아직 연결되지 않았습니다. <code>.env.local</code>에
          환경변수를 설정하면 로그인이 활성화됩니다. 지금은 데모 데이터로
          화면을 둘러볼 수 있습니다.
        </div>
        <LinkButton variant="cta" full href="/app">
          데모 모드로 둘러보기
        </LinkButton>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div>
        <h1>로그인</h1>
        <p className="auth-sub">관제 워크스페이스에 오신 것을 환영합니다.</p>
      </div>

      {authError ? (
        <div className="auth-error" role="alert">
          <IconAlert style={{ width: 16, height: 16, flex: "none" }} />
          {authError}
        </div>
      ) : null}

      <InputField
        label="이메일"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <InputField
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13.5,
        }}
      >
        <span style={{ color: "var(--color-steel)" }}>
          단일 컨설턴트 MVP — 본인 계정으로 로그인
        </span>
        <Link className="auth-link" href="/reset">
          비밀번호 찾기
        </Link>
      </div>

      <Button variant="cta" full type="submit" disabled={loading}>
        {loading ? "처리 중…" : "로그인"}
      </Button>

      <p className="auth-foot">
        계정이 없으신가요? <Link href="/signup">회원가입</Link>
      </p>
    </form>
  );
}
