import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantContext } from "@/lib/actions/shared";
import { isBillingEnabled, isTossConfigured } from "@/lib/billing/config";
import { issueAndStoreBillingKey } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/change-card — 결제수단 변경.
 * 새 authKey로 빌링키를 재발급해 기본 결제수단을 교체한다(구 빌링키는 회수).
 * 구독 상태/주기는 건드리지 않는다. body: { authKey, customerKey }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드" }, { status: 400 });
  }
  if (!isBillingEnabled() || !isTossConfigured()) {
    return NextResponse.json({ ok: false, error: "결제 비활성" }, { status: 503 });
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    authKey?: string;
    customerKey?: string;
  };
  if (!body.authKey || !body.customerKey) {
    return NextResponse.json(
      { ok: false, error: "authKey/customerKey가 필요합니다." },
      { status: 400 },
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
    const { paymentMethodId } = await issueAndStoreBillingKey(
      service,
      ctx.tenantId,
      body.authKey,
      body.customerKey,
    );
    // 구독에 새 결제수단 연결
    await service
      .from("tenant_subscription")
      .update({ payment_method_id: paymentMethodId })
      .eq("tenant_id", ctx.tenantId);
    console.info(
      `[billing/change-card] tenant=${ctx.tenantId} paymentMethod=${paymentMethodId}`,
    );
    return NextResponse.json({ ok: true, paymentMethodId });
  } catch (err) {
    console.error("[billing/change-card]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
