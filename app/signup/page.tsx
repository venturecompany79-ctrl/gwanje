import type { Metadata } from "next";
import Link from "next/link";
import { AuthStage } from "@/components/auth/AuthStage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { InputField } from "@/components/ui/Input";
import { isSignupEnabled } from "@/lib/auth/config";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "회원가입" };

// SIGNUP_ENABLED=true → Google OAuth + 이메일 직접 가입. OFF → 비활성 플레이스홀더.
export default function SignupPage() {
  if (!isSignupEnabled()) return <SignupDisabledPlaceholder />;

  return (
    <AuthStage>
      <SignupForm />
    </AuthStage>
  );
}

// 가입이 닫힌 동안 노출되는 비활성 화면
function SignupDisabledPlaceholder() {
  return (
    <AuthStage>
      <div className="auth-card">
        <div>
          <h1>워크스페이스 만들기</h1>
          <p className="auth-sub">새 컨설턴트 워크스페이스를 만듭니다.</p>
        </div>

        <div className="auth-notice">
          아직 회원가입이 열리지 않았습니다. 오픈 준비가 끝나면 이 화면에서 바로
          가입할 수 있습니다.
        </div>

        <InputField label="이름" placeholder="이름" disabled />
        <InputField
          label="직함 / 소속"
          placeholder="예: 경영컨설턴트 · OO파트너스"
          disabled
        />
        <InputField
          label="이메일"
          type="email"
          placeholder="you@example.com"
          disabled
        />
        <InputField
          label="비밀번호"
          type="password"
          placeholder="8자 이상"
          disabled
        />
        <InputField
          label="비밀번호 확인"
          type="password"
          placeholder="비밀번호 재입력"
          disabled
        />

        <Checkbox checked={false} disabled agree>
          <span className="auth-link">이용약관</span> 및{" "}
          <span className="auth-link">개인정보 처리방침</span>에 동의합니다.
        </Checkbox>

        <Button variant="cta" full disabled>
          가입하고 시작하기
        </Button>

        <p className="auth-foot">
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </div>
    </AuthStage>
  );
}
