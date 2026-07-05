import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { encryptBillingKey, decryptBillingKey } from "@/lib/billing/crypto";
import {
  approveBilling,
  issueBillingKey,
  deleteBillingKey,
  TossApiError,
  type IssuedBillingKey,
} from "@/lib/billing/toss";

// 구독/결제 도메인 로직 — service_role 클라이언트로만 호출(RLS 우회).
// ⚠️ 서버 전용. 라우트/크론에서 createServiceClient() 결과를 주입해 사용한다.

type Service = SupabaseClient<Database>;
type PlanRow = Database["public"]["Tables"]["billing_plan"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["tenant_subscription"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_method"]["Row"];
export type PaymentKind = Database["public"]["Enums"]["payment_kind"];

/** past_due 유예기간(일). 이 기간 경과 후에도 결제 실패면 expired. */
export const GRACE_DAYS = 3;

export type ChargeResult =
  | { ok: true; status: "active"; orderId: string; paymentKey: string }
  | { ok: false; status: "past_due" | "expired"; orderId: string; code: string; message: string };

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 12);
}

/** 활성 월간 플랜. 없으면 throw(시드 누락). */
export async function getActivePlan(service: Service): Promise<PlanRow> {
  const { data, error } = await service
    .from("billing_plan")
    .select("*")
    .eq("code", "monthly")
    .eq("is_active", true)
    .single();
  if (error || !data) {
    throw new Error("활성 요금제를 찾을 수 없습니다(billing_plan 시드 확인).");
  }
  return data;
}

/** tenant ↔ Toss customerKey. 없으면 생성. customerKey는 불투명 랜덤값. */
export async function getOrCreateBillingCustomer(
  service: Service,
  tenantId: string,
  contact?: { email?: string | null; name?: string | null },
): Promise<{ id: string; tossCustomerKey: string }> {
  const { data: existing } = await service
    .from("billing_customer")
    .select("id, toss_customer_key")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (existing) {
    return { id: existing.id, tossCustomerKey: existing.toss_customer_key };
  }

  const tossCustomerKey = `cus_${shortId(tenantId)}_${randomUUID().slice(0, 8)}`;
  const { data, error } = await service
    .from("billing_customer")
    .insert({
      tenant_id: tenantId,
      toss_customer_key: tossCustomerKey,
      billing_email: contact?.email ?? null,
      billing_name: contact?.name ?? null,
    })
    .select("id, toss_customer_key")
    .single();
  if (error || !data) {
    throw new Error(`결제 고객 생성 실패: ${error?.message ?? "unknown"}`);
  }
  return { id: data.id, tossCustomerKey: data.toss_customer_key };
}

/**
 * authKey로 빌링키를 발급해 payment_method에 암호화 저장하고 기본 결제수단으로 만든다.
 * 기존 active 결제수단은 deleted로 내리고 Toss 빌링키도 삭제(베스트 에포트).
 */
export async function issueAndStoreBillingKey(
  service: Service,
  tenantId: string,
  authKey: string,
  expectedCustomerKey: string,
): Promise<{ paymentMethodId: string; issued: IssuedBillingKey }> {
  const customer = await getOrCreateBillingCustomer(service, tenantId);
  // 콜백으로 받은 customerKey가 우리 tenant의 것인지 검증(위조 방지)
  if (expectedCustomerKey !== customer.tossCustomerKey) {
    throw new Error("customerKey가 일치하지 않습니다.");
  }

  const issued = await issueBillingKey(authKey, customer.tossCustomerKey);

  // 기존 active 결제수단 회수
  const { data: olds } = await service
    .from("payment_method")
    .select("id, encrypted_billing_key")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  for (const old of olds ?? []) {
    await service
      .from("payment_method")
      .update({ status: "deleted", is_default: false })
      .eq("id", old.id);
    try {
      await deleteBillingKey(decryptBillingKey(old.encrypted_billing_key));
    } catch (err) {
      console.error("[billing] 기존 빌링키 삭제 실패", err);
    }
  }

  const { data: pm, error } = await service
    .from("payment_method")
    .insert({
      tenant_id: tenantId,
      billing_customer_id: customer.id,
      encrypted_billing_key: encryptBillingKey(issued.billingKey),
      card_company: issued.cardCompany,
      card_number_masked: issued.cardNumberMasked,
      card_type: issued.cardType,
      is_default: true,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !pm) {
    throw new Error(`결제수단 저장 실패: ${error?.message ?? "unknown"}`);
  }
  return { paymentMethodId: pm.id, issued };
}

/** 구독 행 보장(없으면 expired로 생성). */
async function ensureSubscription(
  service: Service,
  tenantId: string,
  planId: string,
): Promise<SubscriptionRow> {
  const { data: existing } = await service
    .from("tenant_subscription")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await service
    .from("tenant_subscription")
    .insert({ tenant_id: tenantId, plan_id: planId, status: "expired" })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`구독 생성 실패: ${error?.message ?? "unknown"}`);
  }
  return data;
}

async function getActivePaymentMethod(
  service: Service,
  tenantId: string,
): Promise<PaymentMethodRow | null> {
  const { data } = await service
    .from("payment_method")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  return data ?? null;
}

/**
 * 빌링키로 결제를 승인하고 구독 상태를 전이한다.
 * - 성공: payment_transaction succeeded + 구독 active(다음 결제일 = +1개월)
 * - 실패: failed 기록 + past_due(유예 부여) 또는 grace 경과 시 expired
 * orderId 멱등: 동일 orderId 거래가 이미 succeeded면 재청구하지 않는다.
 */
export async function chargeAndActivate(
  service: Service,
  tenantId: string,
  kind: PaymentKind,
  orderIdOverride?: string,
): Promise<ChargeResult> {
  const plan = await getActivePlan(service);
  const sub = await ensureSubscription(service, tenantId, plan.id);
  const pm = await getActivePaymentMethod(service, tenantId);
  if (!pm) throw new Error("등록된 결제수단이 없습니다.");
  const customer = await getOrCreateBillingCustomer(service, tenantId);

  const now = new Date();
  const periodAnchor = sub.current_period_end
    ? new Date(sub.current_period_end)
    : now;
  const orderId =
    orderIdOverride ??
    (kind === "recurring"
      ? `rcr_${shortId(tenantId)}_${periodAnchor.toISOString().slice(0, 10)}`
      : `int_${shortId(tenantId)}_${shortId(pm.id)}`);

  // 멱등: 이미 성공한 거래면 그대로 active 보장 후 반환
  const { data: prior } = await service
    .from("payment_transaction")
    .select("id, status, toss_payment_key")
    .eq("order_id", orderId)
    .maybeSingle();
  if (prior?.status === "succeeded") {
    return {
      ok: true,
      status: "active",
      orderId,
      paymentKey: prior.toss_payment_key ?? "",
    };
  }

  // pending 거래 기록(없으면 생성). order_id unique 경합(23505) 시 상대 결과를 따른다.
  if (!prior) {
    const { error: pendingError } = await service.from("payment_transaction").insert({
      tenant_id: tenantId,
      subscription_id: sub.id,
      payment_method_id: pm.id,
      kind,
      status: "pending",
      order_id: orderId,
      order_name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
    });
    if (pendingError) {
      // 동시 실행(크론 + 수동/웹훅)이 같은 orderId로 진입한 경우.
      if (pendingError.code === "23505") {
        const { data: winner } = await service
          .from("payment_transaction")
          .select("status, toss_payment_key")
          .eq("order_id", orderId)
          .maybeSingle();
        if (winner?.status === "succeeded") {
          return {
            ok: true,
            status: "active",
            orderId,
            paymentKey: winner.toss_payment_key ?? "",
          };
        }
        // 상대가 아직 처리 중 — 중복 승인을 시도하지 않고 물러난다(상태 변경 없음).
        return {
          ok: false,
          status: "past_due",
          orderId,
          code: "CONCURRENT",
          message: "동일 주문이 처리 중입니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      throw new Error(`거래 기록 실패: ${pendingError.message}`);
    }
  }

  try {
    const billingKey = decryptBillingKey(pm.encrypted_billing_key);
    const approved = await approveBilling({
      billingKey,
      customerKey: customer.tossCustomerKey,
      amount: plan.amount, // 금액은 항상 서버 플랜 기준
      orderId,
      orderName: plan.name,
      customerEmail: null,
      customerName: null,
    });

    await service
      .from("payment_transaction")
      .update({
        status: "succeeded",
        toss_payment_key: approved.paymentKey,
        approved_at: approved.approvedAt ?? now.toISOString(),
        raw_response: approved.sanitized as Json,
      })
      .eq("order_id", orderId);

    const periodStart = now;
    const periodEnd = addMonths(periodStart, 1);
    await service
      .from("tenant_subscription")
      .update({
        status: "active",
        plan_id: plan.id,
        payment_method_id: pm.id,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        grace_until: null,
      })
      .eq("id", sub.id);

    console.info(
      `[billing] 결제 성공 tenant=${tenantId} order=${orderId} paymentKey=${approved.paymentKey}`,
    );
    return { ok: true, status: "active", orderId, paymentKey: approved.paymentKey };
  } catch (err) {
    const code = err instanceof TossApiError ? err.code : "UNKNOWN";
    const message = err instanceof Error ? err.message : String(err);

    // 경합으로 다른 실행이 이미 succeeded로 마감한 거래는 절대 덮어쓰지 않는다.
    await service
      .from("payment_transaction")
      .update({ status: "failed", failure_code: code, failure_message: message })
      .eq("order_id", orderId)
      .neq("status", "succeeded");

    // 유예 경과 판정: 이미 past_due이고 grace_until 지났으면 expired
    const graceElapsed =
      sub.status === "past_due" &&
      sub.grace_until != null &&
      new Date(sub.grace_until) <= now;
    const nextStatus: "past_due" | "expired" = graceElapsed ? "expired" : "past_due";
    const graceUntilIso = graceElapsed
      ? sub.grace_until
      : new Date(now.getTime() + GRACE_DAYS * 86_400_000).toISOString();

    await service
      .from("tenant_subscription")
      .update({ status: nextStatus, grace_until: graceUntilIso })
      .eq("id", sub.id);

    console.error(
      `[billing] 결제 실패 tenant=${tenantId} order=${orderId} code=${code} → ${nextStatus}`,
    );
    return { ok: false, status: nextStatus, orderId, code, message };
  }
}

/** 구독 취소 — 다음 결제일(current_period_end)까지 유지, 이후 과금 중단. */
export async function cancelAtPeriodEnd(
  service: Service,
  tenantId: string,
): Promise<void> {
  const { error } = await service
    .from("tenant_subscription")
    .update({ canceled_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`구독 취소 실패: ${error.message}`);
  console.info(`[billing] 구독 취소 예약 tenant=${tenantId}`);
}

export interface RecurringSummary {
  processed: number;
  charged: number;
  failed: number;
  canceled: number;
}

/**
 * 정기결제 배치 — 만기 도래 구독을 청구한다.
 * - canceled_at 있는 구독: 청구하지 않고 canceled로 종료
 * - 그 외: chargeAndActivate('recurring')
 */
export async function runRecurringBilling(
  service: Service,
): Promise<RecurringSummary> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await service
    .from("tenant_subscription")
    .select("tenant_id, status, canceled_at")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", nowIso);
  if (error) throw new Error(`만기 구독 조회 실패: ${error.message}`);

  const summary: RecurringSummary = {
    processed: 0,
    charged: 0,
    failed: 0,
    canceled: 0,
  };
  for (const row of due ?? []) {
    summary.processed += 1;
    if (row.canceled_at) {
      await service
        .from("tenant_subscription")
        .update({ status: "canceled" })
        .eq("tenant_id", row.tenant_id);
      summary.canceled += 1;
      continue;
    }
    try {
      const result = await chargeAndActivate(service, row.tenant_id, "recurring");
      if (result.ok) summary.charged += 1;
      else summary.failed += 1;
    } catch (err) {
      summary.failed += 1;
      console.error(`[billing] 정기결제 예외 tenant=${row.tenant_id}`, err);
    }
  }
  return summary;
}
