import Link from "next/link";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconCalendar, IconKanban, IconList } from "@/components/ui/icons";
import type { DeadlineItem } from "@/lib/database.types";

export function DeadlinePanel({ deadlines }: { deadlines: DeadlineItem[] }) {
  return (
    <Panel>
      <PanelHead title="마감 임박" count={`${deadlines.length}건`}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pill-tab is-active">
            <IconList /> D-day 리스트
          </button>
          {/* 캘린더·칸반 뷰는 후속 세션 구현 (와이어프레임도 골격만 존재) */}
          <button type="button" className="pill-tab" disabled title="준비 중">
            <IconCalendar /> 캘린더
          </button>
          <button type="button" className="pill-tab" disabled title="준비 중">
            <IconKanban /> 칸반
          </button>
        </div>
      </PanelHead>
      {deadlines.length === 0 ? (
        <div className="empty-w" style={{ padding: "48px 16px" }}>
          <IconCalendar />
          <p>다가오는 마감·만료가 없습니다</p>
        </div>
      ) : (
        <table className="dlist">
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
              <tr key={`${row.source}-${row.id}`}>
                <td className="co">
                  {row.company_id ? (
                    <Link href={`/app/companies/${row.company_id}`}>
                      {row.company_name}
                    </Link>
                  ) : (
                    row.company_name
                  )}
                </td>
                <td className="item">{row.title}</td>
                <td>
                  <CategoryChip name={row.category_name} />
                </td>
                <td className="date num">{row.due_date}</td>
                <td className="r">
                  <DdayBadge daysLeft={row.days_left} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
