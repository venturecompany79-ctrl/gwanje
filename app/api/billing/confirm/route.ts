import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/lib/actions/shared";
import { isBillingEnabled, isTossConfigured } from "@/lib/billing/config";
import {
  issueAndStoreBillingKey,
  chargeAndActivate,
} from "@/lib/billing/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/billing/confirm — 최초 구독 결제 오케스트레이션.
 * 1) authKey로 빌링키 발급·저장(이미 있으면 갱신)
 * 2) 첫 결제 승인(서버 플랜 금액)
 * 3) 구독 active 전이
 * body: { authKey, customerKey }. orderId 멱등으로 중복 호출 안전.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드" }, { status: 400 });
  }
  if (!isBillingEnabled() || !isTossConfigured()) {
    return NextResponse.json({ ok: false, error: "결제 비활성" }, { status: 503 });
  }

  const member = await requirePermission(supabase, "billing.manage");
  if ("error" in member) {
    return NextResponse.json({ ok: false, error: member.error }, { status: 403 });
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
    await issueAndStoreBillingKey(
      service,
      member.tenantId,
      body.authKey,
      body.customerKey,
    );
    const result = await chargeAndActivate(service, member.tenantId, "initial");
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.message, code: result.code },
        { status: 402 },
      );
    }
    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    console.error("[billing/confirm]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
