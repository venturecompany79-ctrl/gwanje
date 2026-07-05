import type { MetadataRoute } from "next";

// CBT 단계 — 공개 랜딩·약관만 색인 허용, 앱·인증·API 경로는 크롤링 차단
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app",
        "/login",
        "/signup",
        "/reset",
        "/invite",
        "/billing",
        "/auth",
        "/api",
        "/configuration-error",
      ],
    },
  };
}
