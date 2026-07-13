import { NextResponse } from "next/server";
import { verifyBearerSecret } from "@/lib/api/auth";
import { reportGenerationEnabled } from "@/lib/reports/config";
import { runReportBatch } from "@/lib/reports/worker";
import { createServiceClient } from "@/lib/supabase/service";
import { triggerDriveSyncAfterResponse } from "@/lib/google-drive/trigger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 미설정" },
      { status: 503 },
    );
  }

  if (!verifyBearerSecret(request, cronSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!reportGenerationEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY 미설정" },
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
    const result = await runReportBatch(service, 1);
    if (result.succeeded > 0) triggerDriveSyncAfterResponse();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[reports/generate]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
