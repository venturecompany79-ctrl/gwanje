import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, requirePermission } from "@/lib/actions/shared";
import {
  DRIVE_ROOT_FOLDER_NAME,
  isGoogleDriveConfigured,
} from "@/lib/google-drive/config";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/lib/google-drive/oauth";
import { ensureRootFolder } from "@/lib/google-drive/drive";
import { encryptRefreshToken } from "@/lib/google-drive/crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { enqueueExistingMeetingReportBackups } from "@/lib/google-drive/report-backup";
import { triggerDriveSyncAfterResponse } from "@/lib/google-drive/trigger";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gd_oauth_state";

function redirectToSettings(request: Request, status: string): NextResponse {
  const url = new URL("/app/settings", request.url);
  url.searchParams.set("drive", status);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/** GET /api/google-drive/callback → code 교환 후 연결 저장 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) {
    // 사용자가 동의를 거부한 경우 등
    return redirectToSettings(request, "denied");
  }
  if (!isGoogleDriveConfigured()) {
    return redirectToSettings(request, "unconfigured");
  }
  if (!code || !state) {
    return redirectToSettings(request, "error");
  }

  // CSRF: state 쿠키 대조
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);
  if (!cookieState || cookieState !== state) {
    return redirectToSettings(request, "state_mismatch");
  }

  const supabase = await createClient();
  if (!supabase) return redirectToSettings(request, "error");

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) {
    return NextResponse.redirect(new URL("/login?redirect=/app/settings", request.url));
  }
  const allowed = await requirePermission(supabase, "settings.drive.write");
  if ("error" in allowed) {
    return redirectToSettings(request, "permission_denied");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refreshToken) {
      // refresh token이 없으면 무인 동기화 불가 → 재동의 유도
      return redirectToSettings(request, "no_refresh_token");
    }

    const googleEmail = await fetchGoogleEmail(tokens.accessToken);

    // 앱 전용 루트 폴더 보장(연결 시점에 1회 생성/조회)
    let rootFolderId: string | null = null;
    try {
      rootFolderId = await ensureRootFolder(tokens.accessToken);
    } catch (folderError) {
      // 폴더 생성 실패는 치명적이지 않음 — 워커가 다음 동기화 때 재시도
      console.error("[google-drive/callback] root folder", folderError);
    }

    const { error } = await supabase
      .from("google_drive_connections")
      .upsert(
        {
          tenant_id: ctx.tenantId,
          user_id: ctx.userId,
          google_email: googleEmail,
          encrypted_refresh_token: encryptRefreshToken(tokens.refreshToken),
          root_folder_id: rootFolderId,
          root_folder_name: DRIVE_ROOT_FOLDER_NAME,
          connected_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("[google-drive/callback] upsert", error.code, error.message);
      return redirectToSettings(request, "error");
    }

    // Drive 미연결 상태에서 먼저 생성된 전체본·요약본도 연결 직후 자동 백업한다.
    // 보고서 생성/연결 성공을 백업 실패와 결합하지 않도록 실패는 로그만 남긴다.
    const service = createServiceClient();
    if (service) {
      const enqueued = await enqueueExistingMeetingReportBackups(
        service,
        ctx.tenantId,
        ctx.userId,
        { resetExisting: true },
      );
      if (enqueued > 0) triggerDriveSyncAfterResponse();
    }

    return redirectToSettings(request, "connected");
  } catch (err) {
    console.error("[google-drive/callback]", err);
    return redirectToSettings(request, "error");
  }
}
