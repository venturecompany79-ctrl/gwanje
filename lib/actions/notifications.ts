"use server";

// 알림 읽음 처리 액션 — 알림 센터 + 셸(사이드바·상단바) 안읽음 배지 갱신
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ERROR, type ActionResult } from "@/lib/actions/shared";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const { error } = await supabase
    .from("notification")
    .update({ is_read: true })
    .eq("id", id);
  if (error) {
    console.error("[markNotificationRead]", error.code, error.message);
    return { ok: false, error: `읽음 처리에 실패했습니다: ${error.message}` };
  }

  // 안읽음 배지는 앱 셸(layout)에서 조회 — /app 전체 무효화
  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const { error } = await supabase
    .from("notification")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) {
    console.error("[markAllNotificationsRead]", error.code, error.message);
    return { ok: false, error: `읽음 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app", "layout");
  return { ok: true, error: null };
}
