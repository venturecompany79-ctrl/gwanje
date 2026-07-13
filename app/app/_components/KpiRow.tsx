import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconAlert,
  IconCalendar,
  IconKanban,
  IconUser,
} from "@/components/ui/icons";
import type { DashboardRiskSummary, DashboardScope } from "@/lib/data/dashboard";

type KpiTone = "critical" | "warning" | "attention" | "neutral";

function riskHref(scope: DashboardScope, risk: string): string {
  const params = new URLSearchParams();
  if (scope === "team") params.set("scope", "team");
  params.set("risk", risk);
  return `/app?${params.toString()}`;
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  icon: ReactNode;
  tone: KpiTone;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`kpi monitor-kpi monitor-kpi--${tone} kpi--link`}
      aria-label={`${label} ${value}${unit} — ${sub}`}
    >
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon">{icon}</div>
      </div>
      <div className="kpi-value">
        <span className="num">{value}</span>
        <em>{unit}</em>
      </div>
      <div className="kpi-sub">{sub}</div>
    </Link>
  );
}

export function KpiRow({
  risk,
  scope,
}: {
  risk: DashboardRiskSummary;
  scope: DashboardScope;
}) {
  return (
    <section className="kpi-row monitor-kpi-row" aria-label="관제 핵심 지표">
      <KpiCard
        label="기한 지남"
        value={risk.overdue}
        unit="건"
        sub={risk.overdue > 0 ? "즉시 조치가 필요합니다" : "지연 업무 없음"}
        icon={<IconAlert />}
        tone={risk.overdue > 0 ? "critical" : "neutral"}
        href={riskHref(scope, "overdue")}
      />
      <KpiCard
        label="7일 내 마감"
        value={risk.due7}
        unit="건"
        sub={risk.due7 > 0 ? "이번 주 우선 확인" : "임박 업무 없음"}
        icon={<IconCalendar />}
        tone={risk.due7 > 0 ? "warning" : "neutral"}
        href={riskHref(scope, "due7")}
      />
      <KpiCard
        label="미배정 과제"
        value={risk.unassigned}
        unit="건"
        sub={risk.unassigned > 0 ? "담당자 지정 필요" : "모두 배정됨"}
        icon={<IconUser />}
        tone={risk.unassigned > 0 ? "attention" : "neutral"}
        href={riskHref(scope, "unassigned")}
      />
      <KpiCard
        label="진행 중 과제"
        value={risk.activeTasks}
        unit="건"
        sub={`${risk.companyCount}개 관리 기업 기준`}
        icon={<IconKanban />}
        tone="neutral"
        href={riskHref(scope, "active")}
      />
    </section>
  );
}
