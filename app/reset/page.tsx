import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default function ResetPage() {
  return (
    <div className="auth-stage">
      <div className="auth-brand">
        <div className="brand-mark">관</div>
        <b>관제</b>
        <span>중소기업 인증·지원·융자 관제 데스크</span>
      </div>
      <ResetForm />
      <Link className="auth-link" href="/login" style={{ fontSize: 13.5 }}>
        ← 로그인으로 돌아가기
      </Link>
    </div>
  );
}
