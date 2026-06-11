import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "관제 — 컨설턴트 통합 관제 데스크" };

// 랜딩 풀 구현은 별도 세션(docs/wireframes/landing_page__Meta_DS_.html 기준).
// 지금은 진입 동선(로그인/앱)만 제공하는 최소 히어로.
export default function LandingPage() {
  return (
    <div className="auth-stage">
      <div className="auth-brand">
        <div className="brand-mark">관</div>
        <b>관제</b>
        <span>중소기업 인증·지원·융자 통합 관제</span>
      </div>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          수십 개 기업의 인증·지원사업 마감,
          <br />한 화면에서 놓치지 않게
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--color-steel)",
            lineHeight: 1.55,
            margin: "16px 0 28px",
          }}
        >
          만료·마감 통합 관제부터 관리포인트 추천, 조건별 일괄 안내까지 —
          컨설턴트를 위한 다중 기업 관리 백오피스.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {/* 마케팅 1차 CTA만 검정 pill (Meta DS 규칙) */}
          <LinkButton variant="primary" href="/login">
            서비스 이용하기
          </LinkButton>
          <LinkButton variant="secondary" href="/login">
            로그인
          </LinkButton>
        </div>
      </div>
      <span className="auth-legal">
        © 2026 관제 · Compliance Desk
      </span>
    </div>
  );
}
