import { createClient } from "@/lib/supabase/server";
import { isBillingEnabled, getTossClientKey } from "@/lib/billing/config";
import type { Database } from "@/lib/database.types";

// 결제 화면용 읽기 레이어. tenant 종속 데이터는 RLS가 격리하므로 일반 서버
// 클라이언트로 조회한다(빌링키 등 민감 컬럼은 grant에서 제외돼 select 불가).
// 데모 모드(supabase=null)에서는 고정 데이터로 폴백한다.

export type SubscriptionStatus =
  Database["public"]["Enums"]["subscription_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface BillingTransaction {
  id: string;
  orderName: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  kind: Database["public"]["Enums"]["payment_kind"];
  createdAt: string;
}

export interface BillingOverview {
  enabled: boolean;
  clientKey: string | null;
  plan: { name: string; amount: number; currency: string; interval: string };
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    graceUntil: string | null;
    canceledAt: string | null;
  } | null;
  paymentMethod: {
    cardCompany: string | null;
    cardNumberMasked: string | null;
    cardType: string | null;
  } | null;
  transactions: BillingTransaction[];
}

const DEFAULT_PLAN = {
  name: "관제 베이직",
  amount: 49000,
  currency: "KRW",
  interval: "month",
};

function DEMO_BILLING(): BillingOverview {
  return {
    enabled: isBillingEnabled(),
    clientKey: getTossClientKey(),
    plan: DEFAULT_PLAN,
    subscription: null,
    paymentMethod: null,
    transactions: [],
  };
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const supabase = await createClient();
  if (!supabase) return DEMO_BILLING();

  const [planRes, subRes, pmRes, txRes] = await Promise.all([
    supabase
      .from("billing_plan")
      .select("name, amount, currency, interval")
      .eq("code", "monthly")
      .maybeSingle(),
    supabase
      .from("tenant_subscription")
      .select("status, current_period_end, grace_until, canceled_at")
      .maybeSingle(),
    supabase
      .from("payment_method")
      .select("card_company, card_number_masked, card_type")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("payment_transaction")
      .select("id, order_name, amount, currency, status, kind, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const firstError = planRes.error ?? subRes.error ?? pmRes.error ?? txRes.error;
  if (firstError) {
    throw new Error(`결제 정보를 불러오지 못했습니다: ${firstError.message}`);
  }

  const plan = planRes.data ?? DEFAULT_PLAN;

  return {
    enabled: isBillingEnabled(),
    clientKey: getTossClientKey(),
    plan: {
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
    },
    subscription: subRes.data
      ? {
          status: subRes.data.status,
          currentPeriodEnd: subRes.data.current_period_end,
          graceUntil: subRes.data.grace_until,
          canceledAt: subRes.data.canceled_at,
        }
      : null,
    paymentMethod: pmRes.data
      ? {
          cardCompany: pmRes.data.card_company,
          cardNumberMasked: pmRes.data.card_number_masked,
          cardType: pmRes.data.card_type,
        }
      : null,
    transactions: (txRes.data ?? []).map((t) => ({
      id: t.id,
      orderName: t.order_name,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      kind: t.kind,
      createdAt: t.created_at,
    })),
  };
}

export type SubscriptionGate = "off" | "ok" | "banner" | "block";

/**
 * 앱 셸/미들웨어용 접근 게이트.
 * - off: 결제 비활성(플래그 OFF) 또는 데모 → 기존 동작 유지
 * - ok: active/trialing/canceled(기간 내) → 정상
 * - banner: past_due → 상단 배너 + 정상 사용(유예기간)
 * - block: expired 또는 구독 없음 → /app/billing로 유도
 */
export async function getSubscriptionGate(): Promise<SubscriptionGate> {
  if (!isBillingEnabled()) return "off";

  const supabase = await createClient();
  if (!supabase) return "off"; // 데모 모드

  const { data } = await supabase
    .from("tenant_subscription")
    .select("status")
    .maybeSingle();

  const status = data?.status ?? null;
  if (status === "active" || status === "trialing" || status === "canceled") {
    return "ok";
  }
  if (status === "past_due") return "banner";
  return "block"; // expired 또는 구독 없음
}
