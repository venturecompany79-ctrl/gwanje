import { RECIPIENT_STATUS_LABEL } from "@/lib/labels";
import type { RecipientStatus } from "@/lib/database.types";

/** 수신자별 발송 상태 배지 — 캠페인 상태 배지(st-badge)와 같은 시각 언어를 쓴다. */
export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return (
    <span className={`st-badge st-badge--rcp-${status}`}>
      <span className="sd" />
      {RECIPIENT_STATUS_LABEL[status]}
    </span>
  );
}
