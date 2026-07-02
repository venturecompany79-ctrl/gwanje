import { formatDday } from "@/lib/format";

// D-day 긴급도 규칙 (화면설계 0절): D-3 이하 critical / D-7 이하 attention / 그 외 중립
// 기한 지남(음수)은 전 화면 공통으로 "D+N" 표기로 통일한다 (GWJ-013).
export function DdayBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) {
    return <span className="dday dday--expired num">{formatDday(daysLeft)}</span>;
  }
  const tone =
    daysLeft <= 3 ? "dday--critical" : daysLeft <= 7 ? "dday--attention" : "dday--neutral";
  const label = formatDday(daysLeft);
  return <span className={`dday ${tone} num`}>{label}</span>;
}
