// 회원가입(Google OAuth) 서버 전용 환경설정.
// ⚠️ 절대 NEXT_PUBLIC_ 금지 — 페이지 RSC·서버 액션·콜백 라우트가 서버에서 강제한다.

/**
 * 회원가입 활성 여부(서버 피처 플래그).
 * OFF면 /signup은 비활성 플레이스홀더로 노출되고,
 * /auth/callback의 신규 유저 진입과 completeSignup 프로비저닝도 서버에서 차단된다.
 * ON으로 켤 때는 Supabase Dashboard의 Google provider + "Allow new users to sign up"도
 * 함께 켜야 한다(.env.example 주석 참고).
 */
export function isSignupEnabled(): boolean {
  return process.env.SIGNUP_ENABLED === "true";
}
