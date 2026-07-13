// 대시보드 패널은 독립 Suspense 경계로 스트리밍한다.
import { cache } from "react";
import {
  getDashboardActivity,
  getDashboardQueue,
  getDashboardTeam,
  parseDashboardSearchParams,
  type DashboardConsultantOption,
  type DashboardScope,
} from "@/lib/data/dashboard";
import { assistantEnabled } from "@/lib/assistant/config";
import { isReportSourceSupported } from "@/lib/reports/file-types";
import { AssistantPanel } from "./AssistantPanel";
import { DashboardWidgets } from "./DashboardWidgets";
import { PriorityQueue } from "./PriorityQueue";
import { TeamHealthTable } from "./TeamHealthTable";

type DashboardQuery = ReturnType<typeof parseDashboardSearchParams>;
const getDashboardActivityCached = cache(getDashboardActivity);

export async function PriorityQueueSection({
  query,
  scope,
  consultants,
}: {
  query: DashboardQuery;
  scope: DashboardScope;
  consultants: DashboardConsultantOption[];
}) {
  const { items } = await getDashboardQueue(query);
  return (
    <PriorityQueue
      items={items}
      scope={scope}
      queueFilter={query.queueFilter}
      consultantId={query.consultantId}
      consultants={consultants}
    />
  );
}

export async function TeamHealthSection({ query }: { query: DashboardQuery }) {
  const { rows } = await getDashboardTeam(query);
  return <TeamHealthTable rows={rows} />;
}

export async function ActivitySection({ query }: { query: DashboardQuery }) {
  const { alerts, files } = await getDashboardActivityCached(query);
  return <DashboardWidgets alerts={alerts} files={files} />;
}

export async function AssistantSection({
  query,
  scope,
  consultantId,
}: {
  query: DashboardQuery;
  scope: DashboardScope;
  consultantId: string | null;
}) {
  const { files } = await getDashboardActivityCached(query);
  return (
    <AssistantPanel
      scope={scope}
      consultantId={consultantId}
      configured={assistantEnabled()}
      documents={files.filter((file) => isReportSourceSupported(file.fileType))}
    />
  );
}

export function QueueSkeleton() {
  return (
    <div className="panel monitor-skeleton-panel" aria-label="우선 처리 큐 불러오는 중">
      <div className="monitor-skeleton-head">
        <div className="skeleton" style={{ width: 176, height: 22 }} />
        <div className="skeleton" style={{ width: 92, height: 36 }} />
      </div>
      <div className="monitor-skeleton-filters">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="skeleton" style={{ width: 148, height: 38 }} />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="skeleton monitor-skeleton-row" />
      ))}
    </div>
  );
}

export function TeamSkeleton() {
  return (
    <div className="panel monitor-skeleton-panel" aria-label="팀 관제 현황 불러오는 중">
      <div className="monitor-skeleton-head">
        <div className="skeleton" style={{ width: 210, height: 22 }} />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="skeleton monitor-skeleton-row" />
      ))}
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="panel monitor-skeleton-panel" aria-label="최근 활동 불러오는 중">
      <div className="monitor-skeleton-head">
        <div className="skeleton" style={{ width: 130, height: 22 }} />
      </div>
      <div className="monitor-skeleton-activity">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}

export function AssistantSkeleton() {
  return (
    <aside className="assistant-panel assistant-panel--skeleton" aria-label="AI 비서 불러오는 중">
      <div className="assistant-head">
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9999 }} />
        <div>
          <div className="skeleton" style={{ width: 142, height: 17 }} />
          <div className="skeleton" style={{ width: 98, height: 11, marginTop: 7 }} />
        </div>
      </div>
      <div className="assistant-log">
        <div className="skeleton" style={{ width: "88%", height: 92 }} />
        <div className="skeleton" style={{ width: "72%", height: 66, marginLeft: "auto" }} />
      </div>
    </aside>
  );
}
