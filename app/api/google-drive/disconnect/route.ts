import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext, requirePermission } from "@/lib/actions/shared";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import { decryptRefreshToken } from "@/lib/google-drive/crypto";
import { refreshAccessToken, revokeToken } from "@/lib/google-drive/oauth";

export const dynamic = "force-dynamic";

/**
 * POST /api/google-drive/disconnect → 연결 해제.
 * 1) Google 토큰 revoke(베스트 에포트) 2) DB는 revoked_at 기록.
 * 행을 지우지 않고 revoked_at만 남겨 이력을 보존한다.
 */
export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드" }, { status: 400 });
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: 401 });
  }
  const allowed = await requirePermission(supabase, "settings.drive.write");
  if ("error" in allowed) {
    return NextResponse.json({ ok: false, error: allowed.error }, { status: 403 });
  }

  const { data: connection, error: readError } = await supabase
    .from("google_drive_connections")
    .select("id, encrypted_refresh_token, revoked_at")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (readError) {
    console.error("[disconnect:read]", readError.code, readError.message);
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }
  if (!connection || connection.revoked_at) {
    // 이미 해제됨 — 멱등하게 성공 처리
    return NextResponse.json({ ok: true });
  }

  // Google 측 토큰 폐기 (설정돼 있을 때만, 실패해도 진행)
  if (isGoogleDriveConfigured()) {
    try {
      const refreshToken = decryptRefreshToken(connection.encrypted_refresh_token);
      const { accessToken } = await refreshAccessToken(refreshToken);
      await revokeToken(accessToken);
    } catch (err) {
      console.error("[disconnect:revoke]", err);
    }
  }

  const { error: updateError } = await supabase
    .from("google_drive_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", connection.id);
  if (updateError) {
    console.error("[disconnect:update]", updateError.code, updateError.message);
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
