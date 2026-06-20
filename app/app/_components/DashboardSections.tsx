// GWJ-019: 대시보드 패널을 Suspense 경계로 분리해 스트리밍한다.
// 각 섹션은 자체 로더로 데이터를 가져오는 async Server Component이며,
// page.tsx는 KPI(헤드)만 await하고 이 섹션들은 fallback을 먼저 그린 뒤 채운다.
import {
  getDashboardActivity,
  getDashboardDeadlines,
  type DeadlineFilter,
} from "@/lib/data/dashboard";
import { DashboardWidgets } from "./DashboardWidgets";
import { DeadlinePanel } from "./DeadlinePanel";

export async function DeadlinePanelSection({
  filter,
  filterLabel,
}: {
  filter: DeadlineFilter;
  filterLabel: string | null;
}) {
  const { deadlines, overdue } = await getDashboardDeadlines(filter);
  return (
    <DeadlinePanel
      deadlines={deadlines}
      overdue={overdue}
      filterLabel={filterLabel}
    />
  );
}

export async function WidgetsSection() {
  const { alerts, files } = await getDashboardActivity();
  return <DashboardWidgets alerts={alerts} files={files} />;
}

/** 마감 패널 자리 스켈레톤 (loading.tsx와 동일 톤) */
export function DeadlinePanelSkeleton() {
  return (
    <div className="panel" style={{ padding: 22 }}>
      <div className="skeleton" style={{ width: 140, height: 22 }} />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 44, marginTop: 14 }} />
      ))}
    </div>
  );
}

/** 우측 위젯 자리 스켈레톤 */
export function WidgetsSkeleton() {
  return (
    <div className="widgets">
      <div className="panel" style={{ padding: 18 }}>
        <div className="skeleton" style={{ width: 100, height: 18 }} />
        <div className="skeleton" style={{ height: 52, marginTop: 14 }} />
        <div className="skeleton" style={{ height: 52, marginTop: 10 }} />
      </div>
      <div className="panel" style={{ padding: 18 }}>
        <div className="skeleton" style={{ width: 100, height: 18 }} />
        <div className="skeleton" style={{ height: 46, marginTop: 14 }} />
      </div>
    </div>
  );
}
