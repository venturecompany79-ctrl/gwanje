import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantContext } from "@/lib/actions/shared";
import { isBillingEnabled, isTossConfigured } from "@/lib/billing/config";
import { issueAndStoreBillingKey } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/issue — authKey로 빌링키 발급·저장(충전 없음).
 * 카드 등록/변경 콜백에서 사용. body: { authKey, customerKey }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드" }, { status: 400 });
  }
  if (!isBillingEnabled() || !isTossConfigured()) {
    return NextResponse.json(
      { ok: false, error: "결제 비활성" },
      { status: 503 },
    );
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
    console.info(
      `[billing/issue] tenant=${ctx.tenantId} paymentMethod=${paymentMethodId}`,
    );
    return NextResponse.json({ ok: true, paymentMethodId });
  } catch (err) {
    console.error("[billing/issue]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
