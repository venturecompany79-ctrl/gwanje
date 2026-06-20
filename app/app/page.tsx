import type { Metadata } from "next";
import { Suspense } from "react";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert, IconBuilding, IconPlus, IconSend } from "@/components/ui/icons";
import {
  DEADLINE_FILTER_LABEL,
  getDashboardKpi,
  parseDeadlineFilter,
} from "@/lib/data/dashboard";
import { DashboardWidgets } from "./_components/DashboardWidgets";
import {
  DeadlinePanelSection,
  DeadlinePanelSkeleton,
  WidgetsSection,
  WidgetsSkeleton,
} from "./_components/DashboardSections";
import { ExportButton } from "./_components/ExportButton";
import { KpiRow } from "./_components/KpiRow";

export const metadata: Metadata = { title: "통합 대시보드" };
export const dynamic = "force-dynamic";

function todayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ due?: string; expire?: string }>;
}) {
  const filter = parseDeadlineFilter(await searchParams);
  // 헤드(카운트 + 가장 시급 1건)만 먼저 await — 마감 패널/위젯은 아래에서 스트리밍 (GWJ-019)
  const { demo, kpi, mostOverdue, mostUrgent } = await getDashboardKpi();
  const isEmpty = kpi.companyCount === 0;

  return (
    <>
      {demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <div className="page-head">
        <div>
          <h1>통합 대시보드</h1>
          <div className="sub">
            {todayLabel()} ·{" "}
            {isEmpty ? (
              "관리할 기업을 등록해 시작하세요"
            ) : mostOverdue ? (
              <>
                기한이 지난{" "}
                <b className="num">
                  D+{Math.abs(mostOverdue.days_left)} {mostOverdue.company_name}
                </b>{" "}
                건이 있습니다 — 즉시 확인이 필요합니다
              </>
            ) : mostUrgent ? (
              <>
                오늘 가장 급한 일은{" "}
                <b className="num">
                  D-{mostUrgent.days_left} {mostUrgent.company_name}
                </b>{" "}
                입니다
              </>
            ) : (
              "다가오는 마감이 없습니다"
            )}
          </div>
        </div>
        <div className="spacer" />
        <div className="head-actions">
          <ExportButton />
          {!isEmpty ? (
            <LinkButton variant="cta" size="sm" href="/app/campaigns/new">
              <IconSend /> 일괄안내
            </LinkButton>
          ) : null}
        </div>
      </div>

      <KpiRow kpi={kpi} />

      {isEmpty ? (
        <div className="dash-grid">
          <EmptyState
            icon={<IconBuilding />}
            title="첫 기업을 등록하세요"
            description="관리할 기업을 추가하면 인증·정부지원·융자의 만료와 마감이 이 대시보드에 D-day 순으로 자동으로 모입니다."
            action={
              <LinkButton variant="cta" href="/app/companies">
                <IconPlus /> 기업 등록
              </LinkButton>
            }
          />
          <DashboardWidgets alerts={[]} files={[]} />
        </div>
      ) : (
        <div className="dash-grid">
          <Suspense fallback={<DeadlinePanelSkeleton />}>
            <DeadlinePanelSection
              filter={filter}
              filterLabel={filter ? DEADLINE_FILTER_LABEL[filter] : null}
            />
          </Suspense>
          <Suspense fallback={<WidgetsSkeleton />}>
            <WidgetsSection />
          </Suspense>
        </div>
      )}
    </>
  );
}
