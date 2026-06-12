"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { InputField } from "@/components/ui/Input";
import { IconAlert } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const supabase = createClient();
  const demo = !supabase;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    const errs: typeof fieldErrors = {};
    if (!EMAIL_RE.test(email)) errs.email = "이메일 형식이 올바르지 않습니다";
    if (!password) errs.password = "비밀번호를 입력해 주세요";
    setFieldErrors(errs);
    setAuthError(null);
    if (errs.email || errs.password) return;

    setLoading(true);
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

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h1>로그인</h1>
        <p className="auth-sub">관제 워크스페이스에 오신 것을 환영합니다.</p>
      </div>

      {demo ? (
        <div className="auth-notice">
          Supabase가 아직 연결되지 않았습니다. <code>.env.local</code>에
          환경변수를 설정하면 로그인이 활성화됩니다. 지금은 데모 데이터로
          화면을 둘러볼 수 있습니다.
        </div>
      ) : null}

      {authError ? (
        <div className="auth-error" role="alert">
          <IconAlert />
          {authError}
        </div>
      ) : null}

      <InputField
        label="이메일"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        error={fieldErrors.email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <InputField
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호"
        value={password}
        error={fieldErrors.password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className="auth-row">
        <Checkbox checked={keep} onChange={setKeep}>
          로그인 상태 유지
        </Checkbox>
        <Link className="auth-link" href="/reset" style={{ fontSize: 13 }}>
          비밀번호 찾기
        </Link>
      </div>

      {demo ? (
        <LinkButton variant="cta" full href="/app">
          데모 모드로 둘러보기
        </LinkButton>
      ) : (
        <Button variant="cta" full type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="spin" />
              처리 중…
            </>
          ) : (
            "로그인"
          )}
        </Button>
      )}

      <p className="auth-foot">
        계정이 없으신가요? <Link href="/signup">회원가입</Link>
      </p>
    </form>
  );
}
