import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Service = SupabaseClient<Database>;
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

/**
 * POST /api/billing/webhook/toss — Toss 웹훅 수신(멱등).
 * - 서명검증: TOSS_PAYMENTS_WEBHOOK_SECRET 설정 시 본문 HMAC-SHA256 검증.
 * - event_key(또는 paymentKey:status)로 webhook_event에 멱등 적재 → 중복이면 즉시 200.
 * - 결제 승인/취소/실패 이벤트를 payment_transaction에 반영.
 * Toss는 비-2xx면 재전송하므로, 처리 실패가 아닌 한 항상 200을 반환한다.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  // 서명검증(설정된 경우에만). Toss 콘솔의 서명 헤더와 일치하도록 정렬 필요.
  const secret = process.env.TOSS_PAYMENTS_WEBHOOK_SECRET;
  if (secret) {
    const signature =
      request.headers.get("tosspayments-webhook-signature") ??
      request.headers.get("x-toss-signature");
    if (!verifySignature(raw, signature, secret)) {
      console.error("[billing/webhook] 서명 검증 실패");
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const eventType = (body.eventType as string | undefined) ?? "UNKNOWN";
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const paymentKey = (data.paymentKey as string | undefined) ?? null;
  const orderId = (data.orderId as string | undefined) ?? null;
  const status = (data.status as string | undefined) ?? null;
  const eventKey =
    (body.eventId as string | undefined) ??
    (paymentKey && status ? `${paymentKey}:${status}` : `${eventType}:${orderId ?? raw.length}`);

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  // 멱등 적재 — 중복이면 unique 위반 → 이미 처리됨으로 간주하고 200
  const { error: insertError } = await service.from("webhook_event").insert({
    event_key: eventKey,
    event_type: eventType,
    order_id: orderId,
    payment_key: paymentKey,
    status,
    payload: sanitizeWebhook(body) as Json,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[billing/webhook] 적재 실패", insertError.code, insertError.message);
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  try {
    await applyWebhook(service, { eventType, orderId, paymentKey, status });
    await service
      .from("webhook_event")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_key", eventKey);
  } catch (err) {
    console.error("[billing/webhook] 처리 실패", err);
    // 적재는 됐으므로 운영자가 재처리 가능. Toss 재전송 방지 위해 200.
  }

  return NextResponse.json({ ok: true });
}

function verifySignature(
  raw: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function applyWebhook(
  service: Service,
  evt: {
    eventType: string;
    orderId: string | null;
    paymentKey: string | null;
    status: string | null;
  },
): Promise<void> {
  if (!evt.orderId && !evt.paymentKey) return;

  // 우리 거래 매핑 — orderId 우선, 없으면 paymentKey
  const query = service
    .from("payment_transaction")
    .select("id, status, tenant_id, subscription_id");
  const { data: tx } = evt.orderId
    ? await query.eq("order_id", evt.orderId).maybeSingle()
    : await query.eq("toss_payment_key", evt.paymentKey!).maybeSingle();
  if (!tx) return;

  const mapped = mapTossStatus(evt.status);
  if (mapped && mapped !== tx.status) {
    await service
      .from("payment_transaction")
      .update({ status: mapped, toss_payment_key: evt.paymentKey ?? undefined })
      .eq("id", tx.id);

    // 취소 이벤트면 구독도 정지(다음 결제일 도래 시 cron이 재평가)
    if (mapped === "canceled" && tx.subscription_id) {
      await service
        .from("tenant_subscription")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("id", tx.subscription_id);
    }
  }
  console.info(
    `[billing/webhook] applied event=${evt.eventType} order=${evt.orderId} status=${evt.status}`,
  );
}

function mapTossStatus(status: string | null): PaymentStatus | null {
  switch (status) {
    case "DONE":
      return "succeeded";
    case "CANCELED":
    case "PARTIAL_CANCELED":
      return "canceled";
    case "ABORTED":
    case "EXPIRED":
      return "failed";
    default:
      return null;
  }
}

function sanitizeWebhook(body: Record<string, unknown>): Record<string, unknown> {
  const data = body.data as Record<string, unknown> | undefined;
  return {
    eventType: body.eventType,
    eventId: body.eventId,
    data: data
      ? {
          paymentKey: data.paymentKey,
          orderId: data.orderId,
          status: data.status,
          approvedAt: data.approvedAt,
          totalAmount: data.totalAmount,
        }
      : undefined,
  };
}
