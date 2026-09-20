import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAlimtalkConfigured, isAlimtalkEnabled } from "@/lib/alimtalk/config";
import { sendCampaign } from "@/lib/alimtalk/send-worker";

// 즉시 발송 트리거 — 응답을 보낸 뒤(after) 백그라운드로 발송 워커를 돌린다.
// cron(5분 주기)은 이 실행이 실패·타임아웃했을 때의 안전망으로 남는다.
//
// after(): 사용자 응답을 막지 않고, 서버리스(Vercel)에서도 응답 후 실행을 보장한다.
//          (await 없이 fetch만 던지면 함수가 동결되며 중단될 수 있어 사용하지 않는다.)

/**
 * 응답 전송 후 해당 캠페인 발송을 1회 시도하도록 예약한다.
 * - service_role 클라이언트로 in-process 실행 → 자기 자신을 HTTP 재호출하지 않음.
 * - 어떤 실패도 throw하지 않는다(로그만). 미처리분은 cron이 회수한다.
 */
export function triggerCampaignSendAfterResponse(campaignId: string): void {
  if (!isAlimtalkEnabled() || !isAlimtalkConfigured()) return;

  after(async () => {
    try {
      const service = createServiceClient();
      if (!service) return;
      await sendCampaign(service, campaignId);
    } catch (err) {
      console.error("[triggerCampaignSendAfterResponse]", err);
    }
  });
}
