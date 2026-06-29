"use server";

// Google Drive 동기화 사용자 액션 — 실패한 자료의 재시도.
// 잡 UPDATE는 RLS상 worker(service_role) 전용이므로, 먼저 사용자 세션으로 소유권을
// 확인한 뒤 service client로 상태를 되돌린다(테넌트/사용자 격리 유지).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DEMO_ERROR, getTenantContext, type ActionResult } from "@/lib/actions/shared";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import { triggerDriveSyncAfterResponse } from "@/lib/google-drive/trigger";

export async function retryDriveSync(
  companyId: string,
  documentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  // 1) 소유권 확인 — RLS로 본인 잡만 조회됨
  const { data: job, error } = await supabase
    .from("google_drive_sync_jobs")
    .select("id")
    .eq("document_id", documentId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) {
    console.error("[retryDriveSync:read]", error.code, error.message);
    return { ok: false, error: `확인에 실패했습니다: ${error.message}` };
  }
  if (!job) return { ok: false, error: "동기화 작업을 찾을 수 없습니다." };

  // 2) service client로 pending 되돌리기(RLS 우회). user_id 재대조로 격리 유지.
  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "서버 설정이 필요합니다(SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const { error: updateError } = await service
    .from("google_drive_sync_jobs")
    .update({
      status: "pending",
      attempts: 0,
      next_run_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", job.id)
    .eq("user_id", ctx.userId);
  if (updateError) {
    console.error("[retryDriveSync:update]", updateError.code, updateError.message);
    return { ok: false, error: `재시도 등록에 실패했습니다: ${updateError.message}` };
  }

  // 3) 즉시 트리거(응답 후 백그라운드)
  if (isGoogleDriveConfigured()) triggerDriveSyncAfterResponse();

  revalidatePath(`/app/companies/${companyId}`);
  return { ok: true, error: null };
}
