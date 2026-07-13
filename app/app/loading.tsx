import {
  ActivitySkeleton,
  AssistantSkeleton,
  QueueSkeleton,
} from "./_components/DashboardSections";

export default function DashboardLoading() {
  return (
    <div className="monitor-dashboard" aria-busy="true" aria-label="통합 관제 대시보드 불러오는 중">
      <header className="page-head monitor-page-head">
        <div>
          <div className="skeleton" style={{ width: 82, height: 12 }} />
          <div className="skeleton" style={{ width: 250, height: 34, marginTop: 9 }} />
          <div className="skeleton" style={{ width: 350, maxWidth: "75vw", height: 15, marginTop: 9 }} />
        </div>
        <div className="spacer" />
        <div className="skeleton" style={{ width: 286, height: 42, borderRadius: 9999 }} />
      </header>

      <div className="skeleton monitor-alert-skeleton" />

      <div className="kpi-row monitor-kpi-row">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="kpi monitor-kpi">
            <div className="kpi-top">
              <div className="skeleton" style={{ width: 90, height: 15 }} />
              <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9999 }} />
            </div>
            <div className="skeleton" style={{ width: 76, height: 42, marginTop: 14 }} />
            <div className="skeleton" style={{ width: 126, height: 12, marginTop: 9 }} />
          </div>
        ))}
      </div>

      <div className="monitor-layout">
        <div className="monitor-main-column">
          <QueueSkeleton />
          <ActivitySkeleton />
        </div>
        <div className="monitor-assistant-column">
          <AssistantSkeleton />
        </div>
      </div>
    </div>
  );
}
