"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { InputField } from "@/components/ui/Input";
import { IconAlert } from "@/components/ui/icons";
import { completeSignup } from "@/lib/actions/signup";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;

function signUpErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    case "weak_password":
      return "비밀번호가 너무 약합니다. 다른 비밀번호를 사용해 주세요.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "아직 이메일 가입이 열리지 않았습니다. Google 가입을 이용해 주세요.";
    case "over_email_send_rate_limit":
      return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return "가입에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

// 회원가입 — Google OAuth 또는 이메일+비밀번호(즉시 가입, 확인 메일 없음).
// 이메일 가입: signUp(세션 즉시 발급) → completeSignup(워크스페이스 프로비저닝) → /app.
// 중간 실패 시에도 middleware가 "세션 O + profile X"를 /signup/complete로 보내 이어서 완료된다.
export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const demo = !supabase;

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  // 사용자가 직접 수정하기 전까지는 이름 입력을 따라 워크스페이스 이름을 제안한다
  const [workspaceTouched, setWorkspaceTouched] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  // auth 계정 생성 성공 후 프로비저닝만 실패한 경우, 재제출 시 signUp을 건너뛴다
  const [signedUp, setSignedUp] = useState(false);
  // 대시보드에 "Confirm email"이 켜져 있는 경우의 안전망 — 메일 링크로 이어서 가입
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    passwordConfirm?: string;
  }>({});

  function handleNameChange(next: string) {
    setName(next);
    if (!workspaceTouched) {
      setWorkspaceName(next.trim() ? `${next.trim()} 컨설팅` : "");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "이름을 입력해 주세요";
    if (!EMAIL_RE.test(email)) errs.email = "이메일 형식이 올바르지 않습니다";
    if (password.length < MIN_PASSWORD) {
      errs.password = `비밀번호는 ${MIN_PASSWORD}자 이상으로 입력해 주세요`;
    }
    if (password !== passwordConfirm) {
      errs.passwordConfirm = "비밀번호가 일치하지 않습니다";
    }
    setFieldErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length > 0) return;
    if (!agreed) {
      setFormError("이용약관과 개인정보 처리방침에 동의해 주세요.");
      return;
    }

    setLoading(true);

    if (!signedUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim(), title: title.trim() || null },
          // 확인 메일 설정이 켜져 있어도 링크가 콜백 → 온보딩으로 이어지도록
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
        },
      });
      if (error) {
        setFormError(signUpErrorMessage(error));
        setLoading(false);
        return;
      }
      if (!data.session) {
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }
      setSignedUp(true);
    }

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
          Google 계정 또는 이메일로 새 컨설턴트 워크스페이스를 만듭니다.
        </p>
      </div>

      {demo ? (
        <div className="auth-notice">
          Supabase가 아직 연결되지 않았습니다. <code>.env.local</code>에
          환경변수를 설정하면 회원가입이 활성화됩니다.
        </div>
      ) : null}

      {needsConfirm ? (
        <div className="auth-notice">
          확인 메일을 보냈습니다. 메일함에서 링크를 열면 가입이 이어집니다.
        </div>
      ) : null}

      {formError ? (
        <div className="auth-error" role="alert">
          <IconAlert />
          {formError}
        </div>
      ) : null}

      <GoogleAuthButton label="Google로 가입하기" />

      <div className="auth-divider">
        <span>또는 이메일로 가입</span>
      </div>

      <InputField
        label="이름"
        placeholder="이름"
        autoComplete="name"
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
        autoComplete="new-password"
        placeholder="8자 이상"
        value={password}
        error={fieldErrors.password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <InputField
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        placeholder="비밀번호 재입력"
        value={passwordConfirm}
        error={fieldErrors.passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
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

      <Button variant="cta" full type="submit" disabled={loading || demo || needsConfirm}>
        {loading ? (
          <>
            <span className="spin" />
            워크스페이스 생성 중…
          </>
        ) : (
          "가입하고 시작하기"
        )}
      </Button>

      <p className="auth-foot">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </form>
  );
}
