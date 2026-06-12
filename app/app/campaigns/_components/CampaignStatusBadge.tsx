import { CAMPAIGN_STATUS_LABEL } from "@/lib/labels";
import type { CampaignStatus } from "@/lib/database.types";

/** 캠페인 상태 배지 — 발송완료=초록 soft / 예약·발송중=파랑 soft / 임시저장=중립 */
export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`st-badge st-badge--${status}`}>
      <span className="sd" />
      {CAMPAIGN_STATUS_LABEL[status]}
    </span>
  );
}
