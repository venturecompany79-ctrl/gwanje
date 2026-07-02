import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/lib/actions/shared";
import { isBillingEnabled } from "@/lib/billing/config";
import { cancelAtPeriodEnd } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/cancel — 구독 취소.
 * 다음 결제일(current_period_end)까지 유지하고 이후 과금을 중단한다.
 * (UI는 server action cancelSubscription을 우선 사용 — 이 라우트는 외부/대체 호출용.)
 */
export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드" }, { status: 400 });
  }
  if (!isBillingEnabled()) {
    return NextResponse.json({ ok: false, error: "결제 비활성" }, { status: 503 });
  }

  const member = await requirePermission(supabase, "billing.manage");
  if ("error" in member) {
    return NextResponse.json({ ok: false, error: member.error }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  try {
    await cancelAtPeriodEnd(service, member.tenantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[billing/cancel]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
