import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

// 고객사 대표용 공유 대시보드 미니 셸 — 앱 셸(사이드바) 밖의 공개 화면.
// 비공개 링크이므로 검색엔진 색인을 막는다.
export const metadata: Metadata = {
  title: "진행현황 공유",
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="share-shell">
      <header className="share-topbar">
        <Image
          src="/brand/gwanje-logo.png"
          alt="관제"
          width={1597}
          height={280}
          priority
          className="share-logo"
        />
        <span className="share-topbar-sub">컨설팅 진행현황 공유</span>
      </header>
      <main className="share-main">{children}</main>
      <footer className="share-foot">© 2026 관제 · Compliance Desk</footer>
    </div>
  );
}
