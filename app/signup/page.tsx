import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "회원가입" };

// 단일 사용자 MVP — 회원가입은 비활성 (화면만, CLAUDE.md 11절)
export default function SignupPage() {
  return (
    <div className="auth-stage">
      <div className="auth-brand">
        <div className="brand-mark">관</div>
        <b>관제</b>
        <span>중소기업 인증·지원·융자 관제 데스크</span>
      </div>
      <div className="auth-card">
        <div>
          <h1>워크스페이스 만들기</h1>
          <p className="auth-sub">새 컨설턴트 워크스페이스를 만듭니다.</p>
        </div>
        <div className="auth-notice">
          현재는 단일 사용자(본인) MVP 기준입니다. 회원가입은 멀티테넌트 확장
          시 활성화됩니다.
        </div>
        <LinkButton variant="secondary" full href="/login">
          로그인으로 돌아가기
        </LinkButton>
        <p className="auth-foot">
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </div>
      <span className="auth-legal">© 2026 관제 · Compliance Desk</span>
    </div>
  );
}
