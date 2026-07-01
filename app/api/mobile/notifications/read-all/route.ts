import type { NextRequest } from "next/server";
import { mobileError, mobileOk, requireMobileContext } from "@/lib/mobile/api";

export async function POST(request: NextRequest) {
  const ctx = await requireMobileContext(request, "notifications.read");
  if (ctx instanceof Response) return ctx;

  const { error } = await ctx.supabase
    .from("notification")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) {
    return mobileError(`읽음 처리에 실패했습니다: ${error.message}`, 500);
  }

  return mobileOk();
}
