import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAlimtalkConfigured, isAlimtalkEnabled } from "@/lib/alimtalk/config";
import { runDueCampaigns } from "@/lib/alimtalk/send-worker";
import { pollDeliveryStatus } from "@/lib/alimtalk/status-poller";
import { verifyBearerSecret } from "@/lib/api/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 알림톡 발송 배치. Vercel Cron이 5분마다 호출.
 * 인증: Authorization: Bearer <ALIMTALK_CRON_SECRET>.
 *
 * 1) 예약 시각이 된 캠페인 발송(+ 즉시 발송이 실패로 남긴 미처리분 회수)
 * 2) 접수된 메시지의 도달 여부 확인 → 수신자 상태 갱신
 */
async function handle(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.ALIMTALK_CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "ALIMTALK_CRON_SECRET 미설정" },
      { status: 503 },
    );
  }

  // Vercel Cron은 Authorization에 CRON_SECRET을 자동 첨부하므로 둘 다 허용한다.
  if (!verifyBearerSecret(request, cronSecret, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isAlimtalkEnabled() || !isAlimtalkConfigured()) {
    return NextResponse.json(
      { ok: false, error: "알림톡 비활성 또는 환경변수 미설정" },
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
    const sends = await runDueCampaigns(service, 5);
    const poll = await pollDeliveryStatus(service);
    const summary = {
      campaigns: sends.length,
      sent: sends.reduce((total, s) => total + s.sent, 0),
      failed: sends.reduce((total, s) => total + s.failed, 0),
      skipped: sends.reduce((total, s) => total + s.skipped, 0),
      poll,
    };
    console.info("[campaigns/cron]", JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[campaigns/cron]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
