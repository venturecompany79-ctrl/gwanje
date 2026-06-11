// D-day 긴급도 규칙 (화면설계 0절): D-3 이하 critical / D-7 이하 attention / 그 외 중립 / 음수 만료
export function DdayBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) {
    return <span className="dday dday--expired num">만료</span>;
  }
  const tone =
    daysLeft <= 3 ? "dday--critical" : daysLeft <= 7 ? "dday--attention" : "dday--neutral";
  const label = daysLeft === 0 ? "D-day" : `D-${daysLeft}`;
  return <span className={`dday ${tone} num`}>{label}</span>;
}
