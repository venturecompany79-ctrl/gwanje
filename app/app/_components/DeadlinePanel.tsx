import Link from "next/link";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconAlert, IconCalendar, IconKanban, IconList } from "@/components/ui/icons";
import { deadlineHref } from "@/lib/data/dashboard";
import type { DeadlineItem } from "@/lib/database.types";
import { DeadlineRow } from "./DeadlineRow";

export function DeadlinePanel({
  deadlines,
  overdue = [],
  filterLabel = null,
}: {
  deadlines: DeadlineItem[];
  /** 기한 지남 항목 — 가장 시급, 상단에 별도 강조 */
  overdue?: DeadlineItem[];
  /** KPI 딥링크로 필터링된 경우 활성 필터명 (GWJ-009) */
  filterLabel?: string | null;
}) {
  return (
    <Panel>
      <PanelHead
        title={filterLabel ?? "마감 임박"}
        count={`${deadlines.length}건`}
      >
        {filterLabel ? (
          <Link href="/app" className="panel-filter-clear">
            전체 보기 ✕
          </Link>
        ) : null}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="pill-tab is-active">
            <IconList /> D-day 리스트
          </button>
          {/* 캘린더·칸반 뷰는 후속 세션 구현 (와이어프레임도 골격만 존재) */}
          <button
            type="button"
            className="pill-tab pill-tab--soon"
            disabled
            aria-disabled
            title="준비 중인 기능입니다"
          >
            <IconCalendar /> 캘린더 <span className="pill-tab-soon">준비 중</span>
          </button>
          <button
            type="button"
            className="pill-tab pill-tab--soon"
            disabled
            aria-disabled
            title="준비 중인 기능입니다"
          >
            <IconKanban /> 칸반 <span className="pill-tab-soon">준비 중</span>
          </button>
        </div>
      </PanelHead>

      {overdue.length > 0 ? (
        <div className="overdue-strip" role="alert">
          <div className="overdue-strip-head">
            <IconAlert /> 기한 지남 {overdue.length}건 — 즉시 확인이 필요합니다
          </div>
          <table className="dlist dlist--cards">
            <tbody>
              {overdue.map((row) => (
                <DeadlineRow
                  key={`${row.source}-${row.id}`}
                  href={deadlineHref(row)}
                  className="row-expired"
                >
                  <td className="co" data-label="기업명">{row.company_name}</td>
                  <td className="item" data-label="항목">{row.title}</td>
                  <td className="date num" data-label="마감일">{row.due_date}</td>
                  <td className="r" data-label="D-day">
                    <DdayBadge daysLeft={row.days_left} />
                  </td>
                </DeadlineRow>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {deadlines.length === 0 ? (
        <div className="empty-w" style={{ padding: "48px 16px" }}>
          <IconCalendar />
          <p>다가오는 마감·만료가 없습니다</p>
        </div>
      ) : (
        <table className="dlist dlist--cards">
          <thead>
            <tr>
              <th>기업명</th>
              <th>항목</th>
              <th>분류</th>
              <th>마감일</th>
              <th className="r">D-day</th>
            </tr>
          </thead>
          <tbody>
            {deadlines.map((row) => (
              <DeadlineRow
                key={`${row.source}-${row.id}`}
                href={deadlineHref(row)}
              >
                <td className="co" data-label="기업명">{row.company_name}</td>
                <td className="item" data-label="항목">{row.title}</td>
                <td data-label="분류">
                  <CategoryChip name={row.category_name} />
                </td>
                <td className="date num" data-label="마감일">{row.due_date}</td>
                <td className="r" data-label="D-day">
                  <DdayBadge daysLeft={row.days_left} />
                </td>
              </DeadlineRow>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
