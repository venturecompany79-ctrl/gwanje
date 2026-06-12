import type { ReactNode } from "react";

// 인증 화면 공통 스테이지 — 브랜드(56px 마크) + 카드 슬롯 + 푸터 (login/signup/reset 공유)
export function AuthStage({ children }: { children: ReactNode }) {
  return (
    <div className="auth-stage">
      <div className="auth-brand">
        <div className="brand-mark">관</div>
        <b>관제</b>
        <span>중소기업 인증·지원·융자 관제 데스크</span>
      </div>
      {children}
      <span className="auth-legal">
        © 2026 관제 · Compliance Desk · 이용약관 · 개인정보처리방침
      </span>
    </div>
  );
}
