import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <div className="auth-stage">
      <div className="auth-brand">
        <div className="brand-mark">관</div>
        <b>관제</b>
        <span>중소기업 인증·지원·융자 관제 데스크</span>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <span className="auth-legal">© 2026 관제 · Compliance Desk</span>
    </div>
  );
}
