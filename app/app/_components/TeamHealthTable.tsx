import Link from "next/link";
import { IconAlert, IconCheck, IconTeam } from "@/components/ui/icons";

interface ConsultantHealthRow {
  consultantId: string;
  consultantName: string;
  consultantTitle: string | null;
  companyCount: number;
  overdue: number;
  due7: number;
  activeTasks: number;
  unassigned: number;
}

function healthFor(row: ConsultantHealthRow): {
  tone: "critical" | "warning" | "attention" | "stable";
  label: string;
} {
  if (row.overdue > 0) return { tone: "critical", label: "즉시 조치" };
  if (row.due7 > 0) return { tone: "warning", label: "이번 주 확인" };
  if (row.unassigned > 0) return { tone: "attention", label: "배정 필요" };
  return { tone: "stable", label: "안정" };
}

export function TeamHealthTable({ rows }: { rows: ConsultantHealthRow[] }) {
  return (
    <section className="panel monitor-team" aria-labelledby="team-health-title">
      <header className="monitor-section-head">
        <div className="monitor-section-title">
          <span className="monitor-section-icon">
            <IconTeam />
          </span>
          <div>
            <h2 id="team-health-title">컨설턴트별 관제 현황</h2>
            <p>팀의 위험 업무와 담당 편중을 한눈에 비교합니다.</p>
          </div>
        </div>
        <span className="monitor-count num">{rows.length}명</span>
      </header>

      {rows.length === 0 ? (
        <div className="monitor-empty-state">
          <IconTeam />
          <strong>표시할 팀원이 없습니다</strong>
          <p>활성 컨설턴트가 추가되면 팀 현황이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="monitor-table-wrap">
          <table className="monitor-team-table">
            <thead>
              <tr>
                <th>컨설턴트</th>
                <th>상태</th>
                <th className="r">담당 기업</th>
                <th className="r">기한 지남</th>
                <th className="r">7일 내</th>
                <th className="r">진행 과제</th>
                <th className="r">미배정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const health = healthFor(row);
                const params = new URLSearchParams({
                  scope: "team",
                  consultant: row.consultantId,
                });
                return (
                  <tr key={row.consultantId}>
                    <td data-label="컨설턴트">
                      <Link href={`/app?${params.toString()}`} className="monitor-team-person">
                        <span className="avatar" aria-hidden="true">
                          {row.consultantName.slice(0, 1)}
                        </span>
                        <span>
                          <strong>{row.consultantName}</strong>
                          <small>{row.consultantTitle ?? "컨설턴트"}</small>
                        </span>
                      </Link>
                    </td>
                    <td data-label="상태">
                      <span className={`monitor-health monitor-health--${health.tone}`}>
                        {health.tone === "stable" ? <IconCheck /> : <IconAlert />}
                        {health.label}
                      </span>
                    </td>
                    <td data-label="담당 기업" className="r num">
                      {row.companyCount}
                    </td>
                    <td data-label="기한 지남" className="r num monitor-risk-number">
                      {row.overdue}
                    </td>
                    <td data-label="7일 내" className="r num">
                      {row.due7}
                    </td>
                    <td data-label="진행 과제" className="r num">
                      {row.activeTasks}
                    </td>
                    <td data-label="미배정" className="r num">
                      {row.unassigned}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
