import type { NextRequest } from "next/server";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

interface ReadNotificationBody {
  id?: string;
}

export async function POST(request: NextRequest) {
  const ctx = await requireMobileContext(request, "notifications.read");
  if (ctx instanceof Response) return ctx;

  const body = await mobileJson<ReadNotificationBody>(request);
  const id = body?.id?.trim();
  if (!id) return mobileError("알림 id가 필요합니다.");

  const { error } = await ctx.supabase
    .from("notification")
    .update({ is_read: true })
    .eq("id", id);
  if (error) {
    return mobileError(`읽음 처리에 실패했습니다: ${error.message}`, 500);
  }

  return mobileOk({ id });
}
