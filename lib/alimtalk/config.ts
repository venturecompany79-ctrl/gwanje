// 알림톡(카카오톡) 실발송 서버 전용 환경설정.
// ⚠️ 절대 NEXT_PUBLIC_ 금지.
//
// Solapi 자격증명(API 키·시크릿·채널·발신번호)은 env가 아니라 테넌트별로 DB에 있다
// (alimtalk_settings). 각 컨설팅사가 자기 Solapi 계정을 연동해 직접 충전하고,
// 발송 요금도 그 계정에서 차감되기 때문이다. 여기서는 전역 스위치와
// 자격증명 암호화 키만 다룬다.

export const SOLAPI_API_BASE = "https://api.solapi.com";

/**
 * 알림톡 기능 활성 여부(서버 피처 플래그).
 * OFF면 테넌트가 연동돼 있어도 기존 "기록만 저장" 동작을 유지한다.
 */
export function isAlimtalkEnabled(): boolean {
  return process.env.ALIMTALK_ENABLED === "true";
}

/**
 * 실제 Solapi 호출 없이 파이프라인만 검증하는 모드.
 * Solapi는 샌드박스를 제공하지 않아 개발/스테이징에서 요금 없이 E2E를 돌리려면 필요하다.
 */
export function isAlimtalkDryRun(): boolean {
  return process.env.ALIMTALK_DRY_RUN === "true";
}

/** 테넌트 자격증명 암호화 키가 준비됐는지(연동 저장/복호화 가능 여부). */
export function isAlimtalkConfigured(): boolean {
  return Boolean(process.env.ALIMTALK_CRED_KEY);
}

/** 자격증명 암호화 키. 누락 시 throw — isAlimtalkConfigured로 가드 후 호출. */
export function getCredKey(): string {
  const key = process.env.ALIMTALK_CRED_KEY;
  if (!key) {
    throw new Error(
      "알림톡 환경변수가 설정되지 않았습니다(ALIMTALK_CRED_KEY). 생성 예: openssl rand -base64 32",
    );
  }
  return key;
}
