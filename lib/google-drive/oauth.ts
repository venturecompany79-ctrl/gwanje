import {
  GOOGLE_OAUTH_SCOPE,
  getGoogleDriveConfig,
} from "@/lib/google-drive/config";

// Google OAuth 2.0 — 의존성 없이 fetch로 직접 호출(googleapis 패키지 미사용).

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

/**
 * 동의 화면 URL.
 * - access_type=offline + prompt=consent → refresh token 확보.
 * - state는 CSRF 방지용(콜백에서 쿠키와 대조).
 */
export function buildConsentUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleDriveConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    access_type: "offline",
    // 최초 연결 시 refresh token을 반드시 받기 위해 동의를 강제한다.
    // (이미 동의한 사용자는 prompt 없으면 refresh token이 안 올 수 있음)
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
  scope: string;
}

/**
 * refresh token이 영구 폐기된 경우(사용자가 Google 계정에서 앱 액세스 철회,
 * 토큰 만료·회수 등). 재시도해도 복구되지 않으므로 워커가 영구 실패로 처리한다.
 */
export class RefreshTokenInvalidError extends Error {}

/** authorization code → access/refresh token 교환 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenExchangeResult> {
  const { clientId, clientSecret, redirectUri } = getGoogleDriveConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `토큰 교환 실패: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim(),
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresInSec: data.expires_in ?? 3600,
    scope: data.scope ?? "",
  };
}

/** refresh token → 단기 access token 재발급(워커에서 매 실행마다 호출) */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresInSec: number }> {
  const { clientId, clientSecret } = getGoogleDriveConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    // invalid_grant = refresh token 영구 폐기 → 재시도 무의미, 별도 타입으로 구분
    if (data.error === "invalid_grant") {
      throw new RefreshTokenInvalidError(
        `refresh token 폐기됨: ${data.error_description ?? "invalid_grant"}`,
      );
    }
    throw new Error(
      `액세스 토큰 갱신 실패: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim(),
    );
  }
  return { accessToken: data.access_token, expiresInSec: data.expires_in ?? 3600 };
}

/** 연결한 Google 계정 이메일 조회(표시용) */
export async function fetchGoogleEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** 연결 해제 시 Google 측 토큰 폐기(베스트 에포트 — 실패해도 DB 상태로 해제 처리) */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
