import type { NextConfig } from "next";

// 고객 비즈니스 데이터를 다루는 SaaS — 검증된 보안 헤더를 전 경로에 적용한다.
// CSP(Content-Security-Policy)는 Next.js inline script/style와 충돌 위험이 있어
// 별도 nonce 설계·테스트 후 도입한다(런칭 체크리스트 8절).
const securityHeaders = [
  // HTTPS 강제 (Vercel은 HTTPS 전용) — preload는 도메인 확정 후 별도 검토
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // 클릭재킹 방지 — 외부 사이트 iframe 임베드 차단
  { key: "X-Frame-Options", value: "DENY" },
  // MIME 스니핑 방지
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 외부로 전체 URL referrer 유출 방지
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 사용하지 않는 브라우저 기능 비활성화
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
