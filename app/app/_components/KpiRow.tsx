import type { ReactNode } from "react";
import {
  IconAlert,
  IconBuilding,
  IconCalendar,
  IconKanban,
} from "@/components/ui/icons";
import type { DashboardKpi } from "@/lib/data/dashboard";

function KpiCard({
  label,
  value,
  unit,
  sub,
  icon,
  urgent = false,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  icon: ReactNode;
  urgent?: boolean;
}) {
  return (
    <div className={`kpi${urgent ? " kpi--urgent" : ""}`}>
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon">{icon}</div>
      </div>
      <div className="kpi-value">
        <span className="num">{value}</span>
        <em>{unit}</em>
      </div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

export function KpiRow({ kpi }: { kpi: DashboardKpi }) {
  const hasData = kpi.companyCount > 0;
  return (
    <div className="kpi-row">
      <KpiCard
        label="관리 기업 수"
        value={kpi.companyCount}
        unit="개사"
        sub={hasData ? "전체 워크스페이스" : "—"}
        icon={<IconBuilding />}
      />
      <KpiCard
        label="7일 내 마감"
        value={kpi.due7}
        unit="건"
        sub={kpi.due7 > 0 ? "즉시 확인 필요" : "—"}
        icon={<IconAlert />}
        urgent={kpi.due7 > 0}
      />
      <KpiCard
        label="30일 내 만료"
        value={kpi.expire30}
        unit="건"
        sub={hasData ? "자격·인증 갱신" : "—"}
        icon={<IconCalendar />}
      />
      <KpiCard
        label="진행 중 과제"
        value={kpi.activeTasks}
        unit="건"
        sub={hasData ? `${kpi.companyCount}개사 전체` : "—"}
        icon={<IconKanban />}
      />
    </div>
  );
}
