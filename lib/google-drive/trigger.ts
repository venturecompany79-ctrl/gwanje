import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import { runSyncBatch } from "@/lib/google-drive/sync-worker";

// 업로드 직후 "즉시 트리거"(B안) — 응답을 보낸 뒤(after) 백그라운드로 동기화 워커를 한 번 돌린다.
// cron(A안)은 놓친 잡·재시도용 안전망으로 남는다.
//
// after(): 사용자 응답을 막지 않고, 서버리스(Vercel)에서도 응답 후 실행을 보장한다.
//          (await 없이 그냥 fetch 던지면 함수가 동결되며 중단될 수 있어 사용하지 않는다.)

/**
 * 응답 전송 후 동기화 워커를 1회 실행하도록 예약한다.
 * - service_role 클라이언트로 in-process 실행 → 자기 자신을 HTTP 재호출하지 않음(베이스 URL·시크릿 불필요).
 * - 보조 기능이므로 어떤 실패도 throw하지 않는다(로그만). cron이 못한 잡을 받쳐 준다.
 * - 막 적재한 잡 + 누적 대기 잡을 함께 처리하되, 즉시 트리거의 지연을 짧게 두기 위해 작은 배치만 처리.
 */
export function triggerDriveSyncAfterResponse(): void {
  if (!isGoogleDriveConfigured()) return;

  after(async () => {
    try {
      const service = createServiceClient();
      if (!service) return;
      await runSyncBatch(service, 5);
    } catch (err) {
      console.error("[triggerDriveSyncAfterResponse]", err);
    }
  });
}
