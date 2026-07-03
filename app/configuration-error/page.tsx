import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "서비스 설정 확인 필요 · 관제",
};

export default function ConfigurationErrorPage() {
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

      <section className="auth-card" role="alert">
        <div>
          <h1>서비스 설정 확인 필요</h1>
          <p className="auth-sub">
            운영 환경의 Supabase 연결 정보가 누락되어 앱 진입을 차단했습니다.
          </p>
        </div>

        <div className="auth-error">
          Vercel Preview/Production 환경변수에{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 설정해 주세요.
        </div>

        <p className="auth-foot">
          데모 모드는 로컬 개발 환경에서만 사용할 수 있습니다.{" "}
          <Link href="/">랜딩으로 돌아가기</Link>
        </p>
      </section>

      <span className="auth-legal">
        © 2026 관제 · Compliance Desk · 이용약관 · 개인정보처리방침
      </span>
    </main>
  );
}
