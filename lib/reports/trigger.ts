import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportGenerationEnabled } from "@/lib/reports/config";
import { runReportBatch } from "@/lib/reports/worker";
import { isGoogleDriveConfigured } from "@/lib/google-drive/config";
import { runSyncBatch } from "@/lib/google-drive/sync-worker";

export function triggerReportGenerationAfterResponse(): void {
  if (!reportGenerationEnabled()) return;

  after(async () => {
    try {
      const service = createServiceClient();
      if (!service) return;
      await runReportBatch(service, 1);
      // 생성 워커가 적재한 전체본·요약본 백업 잡을 같은 요청 수명에서 바로 처리한다.
      if (isGoogleDriveConfigured()) await runSyncBatch(service, 5);
    } catch (err) {
      console.error("[triggerReportGenerationAfterResponse]", err);
    }
  });
}
