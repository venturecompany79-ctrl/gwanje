"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconMail } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [authError, setAuthError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    if (!EMAIL_RE.test(email)) {
      setFieldError("이메일 형식이 올바르지 않습니다");
      return;
    }
    setFieldError(undefined);
    setAuthError(null);
    setLoading(true);
    // 재설정 링크는 /reset/confirm으로 복귀 — 그곳에서 새 비밀번호를 저장한다
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset/confirm`,
    });
    setLoading(false);
    if (error) {
      // 메일 존재 여부는 노출하지 않되, rate-limit 등 발송 자체 실패는 안내
      setAuthError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setSent(true);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h1>비밀번호 재설정</h1>
        <p className="auth-sub">
          가입한 이메일로 재설정 링크를 보내드립니다.
        </p>
      </div>

      {!supabase ? (
        <div className="auth-notice">
          Supabase 연결 후 사용할 수 있습니다 (.env.local 설정 필요).
        </div>
      ) : null}

      {authError ? (
        <div className="auth-error" role="alert">
          <IconMail />
          {authError}
        </div>
      ) : null}

      {sent ? (
        <div className="auth-notice">
          재설정 링크를 보냈습니다. 메일함을 확인해 주세요.
        </div>
      ) : (
        <>
          <InputField
            label="이메일"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            error={fieldError}
            disabled={!supabase}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button variant="cta" full type="submit" disabled={loading || !supabase}>
            {loading ? (
              <>
                <span className="spin" />
                처리 중…
              </>
            ) : (
              <>
                <IconMail />
                재설정 링크 받기
              </>
            )}
          </Button>
        </>
      )}

      <p className="auth-foot">
        <Link href="/login" className="auth-link">
          ← 로그인으로 돌아가기
        </Link>
      </p>
    </form>
  );
}
