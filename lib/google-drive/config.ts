// Google Drive 동기화 관련 서버 전용 환경설정.
// ⚠️ 서버에서만 import할 것 — 모든 값이 비공개다(NEXT_PUBLIC_ 접두사 금지 → 클라이언트 번들 노출 방지).

export const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_ROOT_FOLDER_NAME = "관제 자료";

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
}

/** 모든 OAuth 환경변수가 갖춰졌는지 — 설정 UI의 연결 가능 여부 판단에도 사용 */
export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  );
}

/** 설정값을 읽어 반환. 누락 시 throw — 라우트/워커에서 호출 전에 isGoogleDriveConfigured로 가드 */
export function getGoogleDriveConfig(): GoogleDriveConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    throw new Error(
      "Google Drive 환경변수가 설정되지 않았습니다(GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI/TOKEN_ENCRYPTION_KEY).",
    );
  }

  return { clientId, clientSecret, redirectUri, encryptionKey };
}
