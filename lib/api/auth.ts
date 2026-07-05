import { timingSafeEqual } from "node:crypto";

/**
 * cron/webhook 등 Bearer 시크릿 보호 라우트의 공용 검증기.
 * 타이밍 사이드채널을 막기 위해 상수시간 비교(timingSafeEqual)를 사용한다.
 * 여러 시크릿을 넘기면 그중 하나라도 일치하면 통과한다
 * (예: BILLING_CRON_SECRET과 Vercel Cron이 붙이는 CRON_SECRET 둘 다 허용).
 */
export function verifyBearerSecret(
  request: Request,
  ...secrets: Array<string | undefined | null>
): boolean {
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  for (const secret of secrets) {
    if (!secret) continue;
    const b = Buffer.from(`Bearer ${secret}`);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}
