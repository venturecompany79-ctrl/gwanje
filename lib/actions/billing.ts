"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantContext, requirePermission } from "@/lib/actions/shared";
import { isBillingEnabled, isTossConfigured } from "@/lib/billing/config";
import {
  getOrCreateBillingCustomer,
  cancelAtPeriodEnd,
} from "@/lib/billing/service";

const DEMO_ERROR =
  "데모 모드에서는 결제를 사용할 수 없습니다. Supabase 연결(.env.local) 후 이용해 주세요.";
const DISABLED_ERROR =
  "결제 기능이 아직 활성화되지 않았습니다. 관리자에게 문의해 주세요.";

interface PrepareResult {
  ok: boolean;
  customerKey?: string;
  error: string | null;
}

/**
 * 카드 등록/변경 전 호출 — tenant의 Toss customerKey를 발급(없으면 생성)해 반환.
 * 클라이언트는 이 customerKey로 requestBillingAuth를 호출한다.
 */
export async function prepareCardRegistration(): Promise<PrepareResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!isBillingEnabled() || !isTossConfigured()) {
    return { ok: false, error: DISABLED_ERROR };
  }

  const allowed = await requirePermission(supabase, "billing.manage");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "결제 서버 설정이 누락되었습니다(service role)." };
  }

  try {
    const { tossCustomerKey } = await getOrCreateBillingCustomer(
      service,
      ctx.tenantId,
    );
    return { ok: true, customerKey: tossCustomerKey, error: null };
  } catch (err) {
    console.error("[prepareCardRegistration]", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

interface CancelResult {
  ok: boolean;
  error: string | null;
}

/** 구독 취소 — 다음 결제일까지 유지 후 과금 중단. */
export async function cancelSubscription(): Promise<CancelResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!isBillingEnabled()) return { ok: false, error: DISABLED_ERROR };

  const allowed = await requirePermission(supabase, "billing.manage");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "결제 서버 설정이 누락되었습니다(service role)." };
  }

  try {
    await cancelAtPeriodEnd(service, ctx.tenantId);
    revalidatePath("/app/billing");
    return { ok: true, error: null };
  } catch (err) {
    console.error("[cancelSubscription]", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
