"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { InputField } from "@/components/ui/Input";
import { IconAlert } from "@/components/ui/icons";
import { completeSignup } from "@/lib/actions/signup";

interface SignupCompleteFormProps {
  /** Google 계정에서 가져온 이름(user_metadata) */
  defaultName: string;
  /** Google 계정 이메일 — 표시 전용 */
  email: string;
}

export function SignupCompleteForm({ defaultName, email }: SignupCompleteFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [workspaceName, setWorkspaceName] = useState(
    defaultName ? `${defaultName} 컨설팅` : "",
  );
  // 사용자가 직접 수정하기 전까지는 이름 입력을 따라 워크스페이스 이름을 제안한다
  const [workspaceTouched, setWorkspaceTouched] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});

  function handleNameChange(next: string) {
    setName(next);
    if (!workspaceTouched) {
      setWorkspaceName(next.trim() ? `${next.trim()} 컨설팅` : "");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "이름을 입력해 주세요";
    setFieldErrors(errs);
    setFormError(null);
    if (errs.name) return;
    if (!agreed) {
      setFormError("이용약관과 개인정보 처리방침에 동의해 주세요.");
      return;
    }

    setLoading(true);
    const result = await completeSignup({
      name,
      title: title.trim() || null,
      workspaceName,
      agreedToTerms: agreed,
    });

    if (!result.ok) {
      setFormError(result.error ?? "가입에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h1>워크스페이스 만들기</h1>
        <p className="auth-sub">
          Google 계정 확인이 끝났습니다. 컨설턴트 정보를 입력하면 바로 시작할 수
          있습니다.
        </p>
      </div>

      {formError ? (
        <div className="auth-error" role="alert">
          <IconAlert />
          {formError}
        </div>
      ) : null}

      <InputField label="이메일 (Google 계정)" type="email" value={email} disabled />
      <InputField
        label="이름"
        placeholder="이름"
        value={name}
        error={fieldErrors.name}
        onChange={(e) => handleNameChange(e.target.value)}
      />
      <InputField
        label="직함 / 소속 (선택)"
        placeholder="예: 경영컨설턴트 · OO파트너스"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <InputField
        label="워크스페이스 이름"
        placeholder="예: OO컨설팅"
        value={workspaceName}
        onChange={(e) => {
          setWorkspaceTouched(true);
          setWorkspaceName(e.target.value);
        }}
      />

      <Checkbox checked={agreed} onChange={setAgreed} agree>
        {/* Checkbox 루트가 button이므로 링크 클릭이 동의 토글로 번지지 않게 막는다 */}
        <Link
          className="auth-link"
          href="/terms"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          이용약관
        </Link>{" "}
        및{" "}
        <Link
          className="auth-link"
          href="/privacy"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          개인정보 처리방침
        </Link>
        에 동의합니다.
      </Checkbox>

      <Button variant="cta" full type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spin" />
            워크스페이스 생성 중…
          </>
        ) : (
          "가입하고 시작하기"
        )}
      </Button>
    </form>
  );
}
