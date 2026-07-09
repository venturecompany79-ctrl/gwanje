"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Input";
import { IconAlert } from "@/components/ui/icons";
import { SHARE_LOCKED_ERROR } from "@/lib/share/constants";
import { enterSharePassword, setSharePassword } from "../actions";

// 비밀번호 게이트 — set(첫 방문 설정) / enter(재방문 입력) 겸용 폼.
// 성공 시 서버 액션이 세션 쿠키를 심고, refresh로 대시보드가 렌더된다.
export function SharePasswordGate({
  token,
  mode,
  initiallyLocked,
}: {
  token: string;
  mode: "set" | "enter";
  initiallyLocked: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    initiallyLocked ? SHARE_LOCKED_ERROR : null,
  );
  const [pending, startTransition] = useTransition();
  const isSet = mode === "set";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isSet
        ? await setSharePassword(token, formData)
        : await enterSharePassword(token, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="share-gate">
      <div className="auth-card">
        <div>
          <h1>{isSet ? "비밀번호 설정" : "진행현황 확인"}</h1>
          <p className="auth-sub">
            {isSet
              ? "처음 방문하셨네요. 앞으로 이 페이지에 입장할 때 사용할 비밀번호를 설정해 주세요."
              : "설정하신 비밀번호를 입력하면 컨설팅 진행현황을 확인할 수 있습니다."}
          </p>
        </div>

        {error ? (
          <div className="auth-error">
            <IconAlert /> {error}
          </div>
        ) : null}

        <form className="share-gate-form" onSubmit={handleSubmit}>
          <InputField
            label={isSet ? "비밀번호 (6자 이상)" : "비밀번호"}
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoFocus
            autoComplete={isSet ? "new-password" : "current-password"}
          />
          {isSet ? (
            <InputField
              label="비밀번호 확인"
              name="password_confirm"
              type="password"
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
            />
          ) : null}
          <Button variant="cta" type="submit" full disabled={pending}>
            {pending ? "확인 중…" : isSet ? "설정하고 입장" : "입장"}
          </Button>
        </form>
      </div>
    </div>
  );
}
