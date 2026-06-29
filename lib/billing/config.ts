// 구독 결제(Toss Payments 빌링키) 서버 전용 환경설정.
// ⚠️ secretKey/webhookSecret/encryptionKey는 절대 NEXT_PUBLIC_ 금지(클라이언트 번들 노출 방지).
//    clientKey만 NEXT_PUBLIC_ — Toss clientKey는 공개키로 브라우저 SDK에서 사용한다.

export const TOSS_API_BASE = "https://api.tosspayments.com";

/**
 * 결제 기능 활성 여부(서버 피처 플래그).
 * Toss 자동결제는 운영 전 계약/리스크 심사가 필요 → 기본 OFF.
 * 미설정이면 결제 UI는 "준비 중"으로 안내하고 접근 제어도 비활성(기존 동작 유지).
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

/** 브라우저 SDK용 공개 clientKey(없으면 결제창을 열 수 없음). */
export function getTossClientKey(): string | null {
  return process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY ?? null;
}

export interface TossServerConfig {
  secretKey: string;
  webhookSecret: string | null;
  billingKeyEncryptionKey: string;
}

/** 서버 결제 API에 필요한 비공개 설정이 모두 갖춰졌는지. */
export function isTossConfigured(): boolean {
  return Boolean(
    process.env.TOSS_PAYMENTS_SECRET_KEY &&
      process.env.BILLING_KEY_ENCRYPTION_KEY,
  );
}

/** 서버 설정 반환. 누락 시 throw — 라우트/워커에서 isTossConfigured로 가드 후 호출. */
export function getTossServerConfig(): TossServerConfig {
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
  const billingKeyEncryptionKey = process.env.BILLING_KEY_ENCRYPTION_KEY;
  if (!secretKey || !billingKeyEncryptionKey) {
    throw new Error(
      "결제 환경변수가 설정되지 않았습니다(TOSS_PAYMENTS_SECRET_KEY/BILLING_KEY_ENCRYPTION_KEY).",
    );
  }
  return {
    secretKey,
    webhookSecret: process.env.TOSS_PAYMENTS_WEBHOOK_SECRET ?? null,
    billingKeyEncryptionKey,
  };
}
