import type { NextRequest } from "next/server";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

interface RegisterDeviceBody {
  expoPushToken?: string;
  platform?: string;
  deviceName?: string | null;
  appVersion?: string | null;
}

const PLATFORMS = new Set(["ios", "android", "web", "unknown"]);

interface MobileDeviceUpsert {
  tenant_id: string;
  user_id: string;
  expo_push_token: string;
  platform: string;
  device_name: string | null;
  app_version: string | null;
  disabled_at: null;
  last_seen_at: string;
}

interface MobileDeviceResult {
  id: string;
  platform: string;
  last_seen_at: string;
}

interface MobileDeviceTable {
  upsert: (
    values: MobileDeviceUpsert,
    options: { onConflict: string },
  ) => {
    select: (columns: string) => {
      single: () => Promise<{
        data: MobileDeviceResult | null;
        error: { message: string } | null;
      }>;
    };
  };
}

interface MobileDeviceSupabase {
  from: (relation: "mobile_device") => MobileDeviceTable;
}

function cleanOptional(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text.slice(0, 120);
}

export async function POST(request: NextRequest) {
  const ctx = await requireMobileContext(request);
  if (ctx instanceof Response) return ctx;

  const body = await mobileJson<RegisterDeviceBody>(request);
  const token = body?.expoPushToken?.trim();
  if (!token) return mobileError("Expo push token이 필요합니다.");

  const platform = body?.platform?.trim().toLowerCase() ?? "unknown";
  const safePlatform = PLATFORMS.has(platform) ? platform : "unknown";

  const db = ctx.supabase as unknown as MobileDeviceSupabase;
  const { data, error } = await db
    .from("mobile_device")
    .upsert(
      {
        tenant_id: ctx.member.tenantId,
        user_id: ctx.member.userId,
        expo_push_token: token,
        platform: safePlatform,
        device_name: cleanOptional(body?.deviceName),
        app_version: cleanOptional(body?.appVersion),
        disabled_at: null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,expo_push_token" },
    )
    .select("id, platform, last_seen_at")
    .single();
  if (error) {
    return mobileError(`디바이스 등록에 실패했습니다: ${error.message}`, 500);
  }

  return mobileOk({ device: data });
}
