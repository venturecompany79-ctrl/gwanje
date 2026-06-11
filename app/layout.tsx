import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// ★ Optimistic VF는 Meta 비공개 폰트 — 폴백 확정: 라틴 Inter + 한글 Noto Sans KR (CLAUDE.md 5절 갭 5)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "관제 — 컨설턴트 통합 관제 데스크",
    template: "%s · 관제",
  },
  description:
    "수십 개 기업의 인증·정부지원사업·융자 마감을 한 화면에서 놓치지 않게. 컨설턴트를 위한 다중 기업 관리 SaaS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 폰트 변수는 html에 — :root에서 --font-body로 합성되기 때문 (globals.css)
    <html lang="ko" className={`${inter.variable} ${notoSansKR.variable}`}>
      <body>{children}</body>
    </html>
  );
}
