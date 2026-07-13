import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import {
  deadlineHref,
  getDashboardOverview,
  parseDashboardSearchParams,
} from "@/lib/data/dashboard";
import type { DeadlineItem } from "@/lib/database.types";
import {
  ActivitySection,
  ActivitySkeleton,
  AssistantSection,
  AssistantSkeleton,
  PriorityQueueSection,
  QueueSkeleton,
  TeamHealthSection,
  TeamSkeleton,
} from "./_components/DashboardSections";
import { DashboardToolbar } from "./_components/DashboardToolbar";
import { KpiRow } from "./_components/KpiRow";

export const metadata: Metadata = { title: "통합 관제 대시보드" };
export const dynamic = "force-dynamic";

interface DashboardSearchParams {
  scope?: string;
  consultant?: string;
  risk?: string;
  due?: string;
  expire?: string;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

function AlertStrip({
  overdue,
  urgent,
  unassigned,
  teamScope,
}: {
  overdue: DeadlineItem | null;
  urgent: DeadlineItem | null;
  unassigned: number;
  teamScope: boolean;
}) {
  let tone: "critical" | "warning" | "attention" | "stable" = "stable";
  let href: string | null = null;
  let icon: ReactNode = <IconCheck />;
  let eyebrow = "관제 상태 안정";
  let title = "현재 즉시 조치가 필요한 예외가 없습니다.";
  let detail = "정기 갱신으로 새 위험 항목을 계속 확인합니다.";

  if (overdue) {
    tone = "critical";
    href = deadlineHref(overdue);
    icon = <IconAlert />;
    eyebrow = "즉시 조치";
    title = `${overdue.company_name ?? "기업 미지정"} · ${overdue.title}`;
    detail = "기한이 지난 업무입니다. 담당자와 현재 진행 상태를 확인해 주세요.";
  } else if (urgent && urgent.days_left <= 7) {
    tone = "warning";
    href = deadlineHref(urgent);
    icon = <IconAlert />;
    eyebrow = "이번 주 우선 처리";
    title = `${urgent.company_name ?? "기업 미지정"} · ${urgent.title}`;
    detail = "7일 안에 마감되는 업무입니다. 필요한 자료와 후속 조치를 점검해 주세요.";
  } else if (unassigned > 0) {
    tone = "attention";
    href = `/app?${teamScope ? "scope=team&" : ""}risk=unassigned`;
    icon = <IconAlert />;
    eyebrow = "담당 배정 필요";
    title = `담당자가 지정되지 않은 과제 ${unassigned}건이 있습니다.`;
    detail = "업무 누락을 막기 위해 오늘 안에 담당자를 지정해 주세요.";
  }

  const content = (
    <>
      <span className="monitor-alert-icon">{icon}</span>
      <span className="monitor-alert-copy">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      {overdue ? <DdayBadge daysLeft={overdue.days_left} /> : null}
      {!overdue && urgent && urgent.days_left <= 7 ? (
        <DdayBadge daysLeft={urgent.days_left} />
      ) : null}
      {href ? <span className="monitor-alert-cta">상세 확인</span> : null}
    </>
  );

  if (href) {
    return (
      <Link className={`monitor-alert-strip monitor-alert-strip--${tone}`} href={href}>
        {content}
      </Link>
    );
  }
  return (
    <div className={`monitor-alert-strip monitor-alert-strip--${tone}`} role="status">
      {content}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const parsedQuery = parseDashboardSearchParams(await searchParams);
  const overview = await getDashboardOverview(parsedQuery);
  const query = {
    ...parsedQuery,
    scope: overview.scope,
    consultantId: overview.scope === "team" ? parsedQuery.consultantId : null,
  };

  return (
    <div className="monitor-dashboard">
      {overview.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수를 설정하면 실제 관제 데이터로 전환됩니다.
        </div>
      ) : null}

      <header className="page-head monitor-page-head">
        <div>
          <div className="monitor-page-kicker">
            {overview.scope === "team" ? "TEAM CONTROL" : "MY CONTROL"}
          </div>
          <h1>통합 관제 대시보드</h1>
          <p className="sub">
            {todayLabel()} · {overview.scope === "team" ? "팀 전체" : "내 담당"}의 위험 업무를
            우선순위로 정리했습니다.
          </p>
        </div>
        <div className="spacer" />
        <DashboardToolbar
          scope={overview.scope}
          canViewTeam={overview.canViewTeam}
          lastUpdatedAt={overview.lastUpdatedAt}
        />
      </header>

      <AlertStrip
        overdue={overview.mostOverdue}
        urgent={overview.mostUrgent}
        unassigned={overview.risk.unassigned}
        teamScope={overview.scope === "team"}
      />

      <KpiRow risk={overview.risk} scope={overview.scope} />

      <div
        className={`monitor-layout${
          overview.canUseAssistant ? "" : " monitor-layout--without-assistant"
        }`}
      >
        <div className="monitor-main-column">
          <Suspense fallback={<QueueSkeleton />}>
            <PriorityQueueSection
              query={query}
              scope={overview.scope}
              consultants={overview.consultants}
            />
          </Suspense>

          {overview.scope === "team" && overview.canViewTeam ? (
            <Suspense fallback={<TeamSkeleton />}>
              <TeamHealthSection query={query} />
            </Suspense>
          ) : null}

          <Suspense fallback={<ActivitySkeleton />}>
            <ActivitySection query={query} />
          </Suspense>
        </div>

        {overview.canUseAssistant ? (
          <div className="monitor-assistant-column">
            <Suspense fallback={<AssistantSkeleton />}>
              <AssistantSection
                query={query}
                scope={overview.scope}
                consultantId={query.consultantId}
              />
            </Suspense>
          </div>
        ) : null}
      </div>
    </div>
  );
}
