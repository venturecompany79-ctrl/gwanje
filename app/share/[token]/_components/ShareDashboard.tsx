import { buildCategoryColorCss } from "@/components/shell/CategoryColorStyle";
import { Badge } from "@/components/ui/Badge";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { TaskWorkStatusBadge } from "@/components/tasks/Stepper";
import { IconAlert, IconChecks, IconKanban } from "@/components/ui/icons";
import type { SharedDashboardData, SharedTaskRow } from "@/lib/data/company-share";
import { formatDotDateString, formatKstShortDateTime } from "@/lib/datetime";
import {
  COMPANY_STATUS_LABEL,
  TASK_STAGE_LABEL,
  TASK_STAGE_ORDER,
} from "@/lib/labels";
import type { TaskStage } from "@/lib/database.types";

// 고객사 대표용 읽기 전용 대시보드 — task 진행현황 + 성과 KPI만 노출.
// 내부 메모·담당자·자격·일정·문서는 이 화면에 절대 올리지 않는다.

function TaskRow({ task }: { task: SharedTaskRow }) {
  return (
    <li className="share-task">
      <span className="share-task-stage" data-stage={task.stage}>
        {TASK_STAGE_LABEL[task.stage]}
      </span>
      <span className="share-task-title">{task.title}</span>
      <TaskWorkStatusBadge status={task.workStatus} />
      <CategoryChip name={task.categoryName} />
      <span className="spacer" />
      {task.dueDate ? (
        <span className="share-task-due">
          {formatDotDateString(task.dueDate)}
          {task.daysLeft !== null && task.workStatus !== "completed" ? (
            <DdayBadge daysLeft={task.daysLeft} />
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

export function ShareDashboard({ data }: { data: SharedDashboardData }) {
  const { kpi } = data;
  const inProgressTasks = data.tasks.filter(
    (t) => t.workStatus !== "completed",
  );
  const doneTasks = data.tasks.filter((t) => t.workStatus === "completed");
  const barStages = TASK_STAGE_ORDER.filter((s) => kpi.byStage[s] > 0);
  const categoryCss = buildCategoryColorCss(data.categoryColors);
  const kpiTiles = [
    { label: "전체 관리포인트", value: kpi.total, unit: "건", className: "" },
    { label: "진행 중", value: kpi.inProgress, unit: "건", className: "" },
    { label: "완료", value: kpi.done, unit: "건", className: "" },
    {
      label: "진행률",
      value: kpi.progressPct,
      unit: "%",
      className: " share-kpi-progress",
    },
  ];

  return (
    <>
      {/* 컨설턴트 화면과 동일한 카테고리 칩 색 — 앱 셸 밖이라 여기서 직접 주입 */}
      {categoryCss ? (
        <style dangerouslySetInnerHTML={{ __html: categoryCss }} />
      ) : null}
      {data.demo ? (
        <div className="demo-banner">
          <IconAlert />
          데모 데이터 표시 중 — Supabase 환경변수(.env.local)를 설정하면 실제
          데이터로 전환됩니다.
        </div>
      ) : null}

      <div className="share-co-head">
        <div className="share-co-id">
          <h1>{data.companyName}</h1>
          <Badge tone={data.status === "ended" ? "neutral" : "success"}>
            {COMPANY_STATUS_LABEL[data.status]}
          </Badge>
          {data.industry ? <span className="ind">{data.industry}</span> : null}
        </div>
        <p className="share-co-sub">
          컨설팅 진행현황 · {formatKstShortDateTime(data.generatedAt)} 기준
        </p>
      </div>

      <div className="kpi-row share-kpi-row">
        {kpiTiles.map((tile) => (
          <div key={tile.label} className="kpi">
            <div className="kpi-top">
              <span className="kpi-label">{tile.label}</span>
            </div>
            <div className={`kpi-value${tile.className}`}>
              {tile.value}
              <em>{tile.unit}</em>
            </div>
          </div>
        ))}
      </div>

      {kpi.total > 0 ? (
        <Panel className="share-panel">
          <PanelHead title="단계별 현황" />
          <div
            className="share-stagebar"
            role="img"
            aria-label={TASK_STAGE_ORDER.map(
              (s) => `${TASK_STAGE_LABEL[s]} ${kpi.byStage[s]}건`,
            ).join(", ")}
          >
            {barStages.map((stage) => (
              <span
                key={stage}
                className="share-stagebar-seg"
                data-stage={stage}
                style={{ flexGrow: kpi.byStage[stage] }}
              />
            ))}
          </div>
          <div className="share-stagebar-legend">
            {TASK_STAGE_ORDER.map((stage: TaskStage) => (
              <span key={stage} className="share-legend-item">
                <span className="share-legend-dot" data-stage={stage} />
                {TASK_STAGE_LABEL[stage]}
                <b className="num">{kpi.byStage[stage]}</b>
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel className="share-panel">
        <PanelHead
          title="진행 중인 관리포인트"
          count={`${inProgressTasks.length}건`}
        />
        {inProgressTasks.length === 0 ? (
          <EmptyState
            bare
            icon={<IconKanban />}
            title="진행 중인 관리포인트가 없습니다"
            description="새 관리포인트가 시작되면 이곳에서 확인할 수 있습니다."
          />
        ) : (
          TASK_STAGE_ORDER.map((stage) => {
            const tasks = inProgressTasks.filter((t) => t.stage === stage);
            if (tasks.length === 0) return null;
            return (
              <div key={stage} className="share-stage-group">
                <h3 className="share-stage-title">
                  {TASK_STAGE_LABEL[stage]}
                  <span className="cnt">{tasks.length}</span>
                </h3>
                <ul className="share-task-list">
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </Panel>

      {doneTasks.length > 0 ? (
        <Panel className="share-panel">
          <PanelHead title="완료된 관리포인트" count={`${doneTasks.length}건`} />
          <ul className="share-task-list share-task-list--done">
            {doneTasks.map((t) => (
              <li key={t.id} className="share-task share-task--done">
                <IconChecks className="share-done-icon" />
                <span className="share-task-title">{t.title}</span>
                <CategoryChip name={t.categoryName} />
                <span className="spacer" />
                {t.dueDate ? (
                  <span className="share-task-due">
                    {formatDotDateString(t.dueDate)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {data.recentUpdates.length > 0 ? (
        <Panel className="share-panel">
          <PanelHead title="최근 업데이트" />
          <ul className="share-task-list">
            {data.recentUpdates.map((t) => (
              <li key={t.id} className="share-task">
                <span className="share-task-stage" data-stage={t.stage}>
                  {TASK_STAGE_LABEL[t.stage]}
                </span>
                <span className="share-task-title">{t.title}</span>
                <TaskWorkStatusBadge status={t.workStatus} />
                <span className="spacer" />
                <span className="share-task-due">
                  {formatKstShortDateTime(t.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
