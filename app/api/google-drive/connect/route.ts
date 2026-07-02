import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/shared";
import { getCurrentIdentity } from "@/lib/data/current-member";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import { buildConsentUrl } from "@/lib/google-drive/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gd_oauth_state";

/** GET /api/google-drive/connect → Google 동의 화면으로 redirect */
export async function GET(request: Request) {
  const settingsUrl = new URL("/app/settings", request.url);

  if (!isGoogleDriveConfigured()) {
    settingsUrl.searchParams.set("drive", "unconfigured");
    return NextResponse.redirect(settingsUrl);
  }

  const supabase = await createClient();
  if (!supabase) {
    settingsUrl.searchParams.set("drive", "error");
    return NextResponse.redirect(settingsUrl);
  }

  const identity = await getCurrentIdentity(supabase);
  if (!identity) {
    return NextResponse.redirect(new URL("/login?redirect=/app/settings", request.url));
  }

  const allowed = await requirePermission(supabase, "settings.drive.write");
  if ("error" in allowed) {
    settingsUrl.searchParams.set("drive", "permission_denied");
    return NextResponse.redirect(settingsUrl);
  }

  // CSRF 방지: 무작위 state를 httpOnly 쿠키에 저장하고 콜백에서 대조
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildConsentUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10분
  });
  return response;
}
