import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportGenerationEnabled } from "@/lib/reports/config";
import { runReportBatch } from "@/lib/reports/worker";

export function triggerReportGenerationAfterResponse(): void {
  if (!reportGenerationEnabled()) return;

  after(async () => {
    try {
      const service = createServiceClient();
      if (!service) return;
      await runReportBatch(service, 1);
    } catch (err) {
      console.error("[triggerReportGenerationAfterResponse]", err);
    }
  });
}
