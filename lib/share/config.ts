// 기업별 공유 대시보드 서버 전용 환경설정.
// ⚠️ SHARE_COOKIE_SECRET은 절대 NEXT_PUBLIC_ 금지(클라이언트 번들 노출 방지).
//    생성: openssl rand -base64 32

/** 공유 세션 쿠키 서명용 시크릿. 미설정이면 공유 대시보드 비활성. */
export function getShareCookieSecret(): string | null {
  return process.env.SHARE_COOKIE_SECRET ?? null;
}

/**
 * 공유 대시보드 동작에 필요한 서버 설정이 모두 갖춰졌는지.
 * 별도 ENABLED 플래그는 두지 않는다 — env가 갖춰지면 켜짐
 * (billing과 달리 외부 계약/심사 리스크가 없어 플래그 불필요).
 */
export function isCompanyShareConfigured(): boolean {
  return Boolean(
    process.env.SHARE_COOKIE_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
