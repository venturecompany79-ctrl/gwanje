import type { Metadata } from "next";
import Link from "next/link";
import { AuthStage } from "@/components/auth/AuthStage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { InputField } from "@/components/ui/Input";

export const metadata: Metadata = { title: "회원가입" };

// 단일 사용자 MVP — 회원가입은 비활성 (폼은 화면만 노출, CLAUDE.md 11절)
export default function SignupPage() {
  return (
    <AuthStage>
      <div className="auth-card">
        <div>
          <h1>워크스페이스 만들기</h1>
          <p className="auth-sub">새 컨설턴트 워크스페이스를 만듭니다.</p>
        </div>

        <div className="auth-notice">
          현재는 단일 사용자(본인) MVP 기준입니다. 회원가입은
          멀티테넌트(팀·다중 워크스페이스) 확장 시 활성화됩니다.
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
