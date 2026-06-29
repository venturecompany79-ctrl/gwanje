import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import { runSyncBatch } from "@/lib/google-drive/sync-worker";

export const dynamic = "force-dynamic";
// 파일 다운로드/업로드가 길어질 수 있어 최대 실행시간을 늘린다(Vercel)
export const maxDuration = 60;

/**
 * 동기화 워커. Vercel Cron 또는 외부 스케줄러가 주기적으로 호출.
 * 인증: Authorization: Bearer <CRON_SECRET>.
 *   (Vercel Cron은 이 헤더를 자동으로 붙여준다.)
 */
async function handle(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 미설정" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Google Drive 환경변수 미설정" },
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
    const result = await runSyncBatch(service);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[google-drive/sync]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Vercel Cron은 GET으로 호출. 수동 트리거용 POST도 허용.
export const GET = handle;
export const POST = handle;
