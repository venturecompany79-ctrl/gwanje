import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface LegalDocProps {
  title: string;
  /** 예: "시행일: 2026-07-01" — 문안 확정 전까지 초안 표기 */
  effective: string;
  children: ReactNode;
}

// 약관/개인정보 처리방침 공용 문서 셸 — auth-stage 위에 넓은 문서 카드
export function LegalDoc({ title, effective, children }: LegalDocProps) {
  return (
    <main className="auth-stage">
      <div className="auth-brand">
        <Image
          src="/brand/gwanje-logo.png"
          alt="관제"
          width={1597}
          height={280}
          className="brand-logo"
        />
        <span>중소기업 인증·지원·융자 관제 데스크</span>
      </div>

      <article className="auth-card legal-card">
        <div>
          <h1>{title}</h1>
          <p className="auth-sub">{effective}</p>
        </div>
        <div className="legal-body">{children}</div>
        <p className="auth-foot">
          <Link href="/signup">회원가입으로 돌아가기</Link> ·{" "}
          <Link href="/login">로그인</Link>
        </p>
      </article>

      <span className="auth-legal">© 2026 관제 · Compliance Desk</span>
    </main>
  );
}
