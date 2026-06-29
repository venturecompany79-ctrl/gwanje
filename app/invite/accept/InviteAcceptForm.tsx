"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import { acceptTeamInvite } from "@/lib/actions/settings";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 6;

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

export function InviteAcceptForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus("ready");
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

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });
    if (passwordError) {
      setAuthError("비밀번호를 설정하지 못했습니다. 초대 링크가 만료되었을 수 있습니다.");
      setStatus("ready");
      return;
    }

    const result = await acceptTeamInvite();
    if (!result.ok) {
      setAuthError(result.error ?? "초대 수락에 실패했습니다.");
      setStatus("ready");
      return;
    }

    setStatus("done");
    setTimeout(() => {
      router.replace("/app");
      router.refresh();
    }, 900);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h1>팀 초대 수락</h1>
        <p className="auth-sub">사용할 비밀번호를 설정하면 워크스페이스에 참여합니다.</p>
      </div>

      {status === "checking" ? (
        <div className="auth-notice">초대 링크를 확인하는 중입니다…</div>
      ) : null}

      {status === "invalid" ? (
        <>
          <div className="auth-error" role="alert">
            <IconAlert />
            초대 링크가 유효하지 않거나 만료되었습니다.
          </div>
          <p className="auth-foot">
            <Link href="/login" className="auth-link">
              로그인으로 돌아가기
            </Link>
          </p>
        </>
      ) : null}

      {status === "done" ? (
        <div className="auth-notice" role="status">
          <IconCheck /> 팀 초대가 수락되었습니다. 앱으로 이동합니다…
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
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            placeholder={`${MIN_PASSWORD}자 이상`}
            value={password}
            error={fieldError}
            onChange={(e) => setPassword(e.target.value)}
          />
          <InputField
            label="비밀번호 확인"
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
              "초대 수락"
            )}
          </Button>
        </>
      )}
    </form>
  );
}
