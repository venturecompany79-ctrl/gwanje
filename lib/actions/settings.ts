"use server";

// 설정 서버 액션 — 프로필/발신정보 · 알림 규칙 · 분류 카테고리
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ERROR,
  getTenantContext,
  type ActionResult,
  type Supabase,
} from "@/lib/actions/shared";

const LEAD_DAY_OPTIONS = [7, 3, 1];
const CHANNEL_OPTIONS = ["email", "alimtalk"];

function clean(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

async function getUserId(
  supabase: Supabase,
): Promise<{ userId: string } | { error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "세션이 만료되었습니다. 다시 로그인해 주세요." };
  }
  return { userId: auth.user.id };
}

export interface ProfileInput {
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  senderName: string | null;
  senderPhone: string | null;
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };

  const user = await getUserId(supabase);
  if ("error" in user) return { ok: false, error: user.error };

  const { error } = await supabase
    .from("profile")
    .update({
      name,
      title: clean(input.title),
      phone: clean(input.phone),
      email: clean(input.email),
      sender_name: clean(input.senderName),
      sender_phone: clean(input.senderPhone),
    })
    .eq("id", user.userId);
  if (error) {
    console.error("[updateProfile]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  // 이름·직함은 앱 셸(사이드바·상단바)에도 표시 — /app 전체 무효화
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export interface NotifyRulesInput {
  /** 사전 알림 시점 — 7/3/1 중 켜진 값 */
  leadDays: number[];
  /** 발송 채널 — email / alimtalk */
  channels: string[];
  notifyMatch: boolean;
  /** "HH:MM" (null = 일일 요약 off) */
  dailySummaryAt: string | null;
}

export async function updateNotifyRules(
  input: NotifyRulesInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  if (input.leadDays.some((d) => !LEAD_DAY_OPTIONS.includes(d))) {
    return { ok: false, error: "사전 알림 시점 값이 올바르지 않습니다." };
  }
  if (input.channels.some((c) => !CHANNEL_OPTIONS.includes(c))) {
    return { ok: false, error: "발송 채널 값이 올바르지 않습니다." };
  }
  if (
    input.dailySummaryAt !== null &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dailySummaryAt)
  ) {
    return { ok: false, error: "일일 요약 시각이 올바르지 않습니다." };
  }

  const user = await getUserId(supabase);
  if ("error" in user) return { ok: false, error: user.error };

  const { error } = await supabase
    .from("profile")
    .update({
      notify_lead_days: [...input.leadDays].sort((a, b) => b - a),
      notify_channels: input.channels,
      notify_match: input.notifyMatch,
      daily_summary_at: input.dailySummaryAt,
    })
    .eq("id", user.userId);
  if (error) {
    console.error("[updateNotifyRules]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/settings");
  return { ok: true, error: null };
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "카테고리 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("category")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) {
    console.error("[renameCategory]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  // 카테고리 칩은 대시보드·보드·기업상세 등 전 화면에서 사용
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export async function addCategory(name: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "카테고리 이름을 입력해 주세요." };

  const context = await getTenantContext(supabase);
  if ("error" in context) return { ok: false, error: context.error };

  const { data: last } = await supabase
    .from("category")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("category").insert({
    tenant_id: context.tenantId,
    name: trimmed,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) {
    console.error("[addCategory]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}
