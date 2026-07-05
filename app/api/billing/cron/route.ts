import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isBillingEnabled, isTossConfigured } from "@/lib/billing/config";
import { runRecurringBilling } from "@/lib/billing/service";
import { verifyBearerSecret } from "@/lib/api/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 정기결제 배치. Vercel Cron 또는 외부 스케줄러가 주기 호출.
 * 인증: Authorization: Bearer <BILLING_CRON_SECRET>.
 * 만기 도래 구독을 청구하고 active/past_due/expired/canceled로 전이한다.
 */
async function handle(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.BILLING_CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "BILLING_CRON_SECRET 미설정" },
      { status: 503 },
    );
  }

  // Vercel Cron은 Authorization에 CRON_SECRET을 자동 첨부하므로 둘 다 허용한다.
  if (!verifyBearerSecret(request, cronSecret, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isBillingEnabled() || !isTossConfigured()) {
    return NextResponse.json(
      { ok: false, error: "결제 비활성 또는 환경변수 미설정" },
      { status: 503 },
    );
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  try {
    const summary = await runRecurringBilling(service);
    console.info("[billing/cron]", JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[billing/cron]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
