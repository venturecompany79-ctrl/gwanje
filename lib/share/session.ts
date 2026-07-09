// 공유 대시보드 세션 쿠키 — HMAC-SHA256 서명, 서버 상태 없음.
// 페이로드: <shareId>.<sessionVersion>.<expiresEpochSec>.<hmac b64url>
// 무효화 매트릭스:
//   링크 재발급 → 쿠키 path(/share/<token>)가 바뀌어 미전송(자동 무효) + version 불일치(이중 방어)
//   비번 초기화 → session_version+1 로 version 불일치
//   공유 off   → 페이지 게이트에서 enabled 체크가 쿠키보다 우선
import { createHmac, timingSafeEqual } from "node:crypto";

export const SHARE_SESSION_COOKIE = "share_session";
export const SHARE_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createShareSessionCookieValue(
  secret: string,
  shareId: string,
  sessionVersion: number,
): string {
  const expires = Math.floor(Date.now() / 1000) + SHARE_SESSION_MAX_AGE;
  const payload = `${shareId}.${sessionVersion}.${expires}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** 쿠키 값 검증 — HMAC 상수시간 비교 + 만료 + shareId/session_version 일치. */
export function verifyShareSessionCookieValue(
  secret: string,
  value: string,
  shareId: string,
  sessionVersion: number,
): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [cookieShareId, cookieVersion, cookieExpires, mac] = parts;

  const payload = `${cookieShareId}.${cookieVersion}.${cookieExpires}`;
  const expected = Buffer.from(sign(secret, payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return false;
  }

  if (cookieShareId !== shareId) return false;
  if (Number(cookieVersion) !== sessionVersion) return false;
  const expires = Number(cookieExpires);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  return true;
}

/** 쿠키 옵션 — path를 토큰 경로로 한정해 다른 공유 링크와 격리한다. */
export function shareSessionCookieOptions(token: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/share/${token}`,
    maxAge: SHARE_SESSION_MAX_AGE,
  };
}
