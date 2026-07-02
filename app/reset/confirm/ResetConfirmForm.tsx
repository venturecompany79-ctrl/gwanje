"use client";

// 재설정 메일 링크(/reset/confirm)로 복귀 → recovery 세션 확인 → 새 비밀번호 저장 → 로그인 이동
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 6; // supabase/config.toml minimum_password_length과 일치

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

export function ResetConfirmForm() {
  const router = useRouter();
  const [supabase] = useState(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStatus("invalid");
      return;
    }
    // createBrowserClient는 URL 해시의 recovery 토큰을 자동 처리하고
    // PASSWORD_RECOVERY 이벤트를 발생시킨다. 이미 처리된 경우엔 세션이 존재.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      setStatus((prev) =>
        prev === "ready" ? prev : data.session ? "ready" : "invalid",
      );
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < MIN_PASSWORD) {
      setFieldError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`);
      return;
    }
    if (password !== confirm) {
      setFieldError("비밀번호가 일치하지 않습니다");
      return;
    }
    setFieldError(undefined);
    setAuthError(null);
    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setAuthError("비밀번호를 변경하지 못했습니다. 링크가 만료되었을 수 있습니다.");
      setStatus("ready");
      return;
    }
    // 새 비밀번호로 다시 로그인하도록 세션 종료 후 이동
    await supabase.auth.signOut();
    setStatus("done");
    setTimeout(() => router.replace("/login"), 1500);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h1>새 비밀번호 설정</h1>
        <p className="auth-sub">사용할 새 비밀번호를 입력해 주세요.</p>
      </div>

      {status === "checking" ? (
        <div className="auth-notice">재설정 링크를 확인하는 중입니다…</div>
      ) : null}

      {status === "invalid" ? (
        <>
          <div className="auth-error" role="alert">
            <IconAlert />
            재설정 링크가 유효하지 않거나 만료되었습니다.
          </div>
          <p className="auth-foot">
            <Link href="/reset" className="auth-link">
              재설정 링크 다시 받기
            </Link>
          </p>
        </>
      ) : null}

      {status === "done" ? (
        <div className="auth-notice" role="status">
          <IconCheck /> 비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다…
        </div>
      ) : null}

      {(status === "ready" || status === "saving") && (
        <>
          {authError ? (
            <div className="auth-error" role="alert">
              <IconAlert />
              {authError}
            </div>
          ) : null}
          <InputField
            label="새 비밀번호"
            type="password"
            autoComplete="new-password"
            placeholder={`${MIN_PASSWORD}자 이상`}
            value={password}
            error={fieldError}
            onChange={(e) => setPassword(e.target.value)}
          />
          <InputField
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 재입력"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button variant="cta" full type="submit" disabled={status === "saving"}>
            {status === "saving" ? (
              <>
                <span className="spin" />
                저장 중…
              </>
            ) : (
              "비밀번호 변경"
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
