"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { Panel } from "@/components/ui/Panel";
import { Toast, type ToastOptions, useToast } from "@/components/ui/Toast";
import {
  IconArrow,
  IconBuilding,
  IconClock,
  IconPlus,
  IconSearch,
  IconSparkle,
  IconUser,
} from "@/components/ui/icons";
import { AddTaskSlideOver } from "@/components/tasks/TaskSlideOver";
import {
  TaskStateControls,
  type TaskStateSnapshot,
} from "@/components/tasks/TaskStateControls";
import { TaskDday } from "@/components/tasks/Stepper";
import {
  getCompanyPortfolioTasks,
} from "@/lib/actions/tasks";
import { formatDotDateString } from "@/lib/datetime";
import type { TaskRow } from "@/lib/data/company-detail";
import type {
  CompaniesData,
  CompanyListRow,
  CompanyStageCounts,
  CompanyWorkStatusCounts,
} from "@/lib/data/companies";
import {
  TASK_STAGE_LABEL,
  TASK_STAGE_ORDER,
  TASK_WORK_STATUS_LABEL,
  TASK_WORK_STATUS_ORDER,
} from "@/lib/labels";

type SortKey = "risk" | "name" | "recent";
type ScopeKey = "mine" | "team";
type ViewKey = "all" | "attention" | "stable" | "ended";
type WorkStatusFilter =
  | "all"
  | "planned"
  | "in_progress"
  | "waiting"
  | "on_hold"
  | "completed";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "risk", label: "위험 우선순" },
  { value: "name", label: "이름순" },
  { value: "recent", label: "최근 업데이트순" },
];

const SOURCE_LABEL = {
  credential: "자격",
  task: "Task",
  schedule: "일정",
  ip_deadline: "지식재산",
} as const;

function isSortKey(value: string | null): value is SortKey {
  return value === "risk" || value === "name" || value === "recent";
}

function isScopeKey(value: string | null): value is ScopeKey {
  return value === "mine" || value === "team";
}

function isViewKey(value: string | null): value is ViewKey {
  return (
    value === "all" ||
    value === "attention" ||
    value === "stable" ||
    value === "ended"
  );
}

function isWorkStatusFilter(value: string | null): value is WorkStatusFilter {
  return (
    value === "all" ||
    value === "planned" ||
    value === "in_progress" ||
    value === "waiting" ||
    value === "on_hold" ||
    value === "completed"
  );
}

function hasAttention(company: CompanyListRow): boolean {
  return (
    company.overdueTaskCount > 0 ||
    company.due7TaskCount > 0 ||
    company.unassignedTaskCount > 0 ||
    company.workStatusCounts.on_hold > 0 ||
    company.expiredCount > 0 ||
    (company.contractDaysLeft !== null && company.contractDaysLeft <= 30)
  );
}

function riskTuple(company: CompanyListRow): number[] {
  return [
    company.overdueTaskCount > 0 || company.expiredCount > 0 ? 0 : 1,
    company.workStatusCounts.on_hold > 0 ? 0 : 1,
    company.due7TaskCount > 0 ? 0 : 1,
    company.unassignedTaskCount > 0 ? 0 : 1,
    company.workStatusCounts.waiting > 0 ? 0 : 1,
    company.priorityTask?.daysLeft ?? Number.MAX_SAFE_INTEGER,
  ];
}

function compareRisk(a: CompanyListRow, b: CompanyListRow): number {
  const aTuple = riskTuple(a);
  const bTuple = riskTuple(b);
  for (let i = 0; i < aTuple.length; i += 1) {
    if (aTuple[i] !== bTuple[i]) return aTuple[i] - bTuple[i];
  }
  return a.name.localeCompare(b.name, "ko");
}

function formatRecent(value: string | null): string {
  if (!value) return "업데이트 없음";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return formatDotDateString(value.slice(0, 10));
  const diffMinutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (diffMinutes < 5) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatDotDateString(value.slice(0, 10));
}

function StageDistribution({
  counts,
}: {
  counts: CompanyStageCounts;
}) {
  const total = TASK_STAGE_ORDER.reduce((sum, stage) => sum + counts[stage], 0);
  if (total === 0) return <span className="portfolio-empty-value">진행 Task 없음</span>;

  return (
    <div
      className="portfolio-stage"
      aria-label={TASK_STAGE_ORDER.map(
        (stage) => `${TASK_STAGE_LABEL[stage]} ${counts[stage]}건`,
      ).join(", ")}
    >
      <div className="portfolio-stage-bar" aria-hidden="true">
        {TASK_STAGE_ORDER.map((stage) =>
          counts[stage] > 0 ? (
            <span
              key={stage}
              className={`is-${stage}`}
              style={{ flexGrow: counts[stage] }}
            />
          ) : null,
        )}
      </div>
      <div className="portfolio-stage-labels">
        {TASK_STAGE_ORDER.map((stage) =>
          counts[stage] > 0 ? (
            <span key={stage}>
              {TASK_STAGE_LABEL[stage]} {counts[stage]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function WorkStatusSummary({
  counts,
}: {
  counts: CompanyWorkStatusCounts;
}) {
  const visible = TASK_WORK_STATUS_ORDER.filter((status) => counts[status] > 0);
  if (visible.length === 0) {
    return <span className="portfolio-empty-value">Task 없음</span>;
  }
  return (
    <div className="portfolio-status-list">
      {visible.map((status) => (
        <span
          key={status}
          className={`portfolio-status portfolio-status--${status}`}
        >
          {TASK_WORK_STATUS_LABEL[status]} {counts[status]}
        </span>
      ))}
    </div>
  );
}

function RiskSummary({ company }: { company: CompanyListRow }) {
  const hasRisk = hasAttention(company);
  if (!hasRisk) {
    return <span className="portfolio-stable">정상</span>;
  }
  return (
    <div className="portfolio-risk-list">
      {company.overdueTaskCount > 0 ? (
        <Badge tone="critical">기한 지남 {company.overdueTaskCount}</Badge>
      ) : null}
      {company.expiredCount > 0 ? (
        <Badge tone="critical">자격 만료 {company.expiredCount}</Badge>
      ) : null}
      {company.workStatusCounts.on_hold > 0 ? (
        <Badge tone="critical">보류 {company.workStatusCounts.on_hold}</Badge>
      ) : null}
      {company.due7TaskCount > 0 ? (
        <Badge tone="attention">7일 내 {company.due7TaskCount}</Badge>
      ) : null}
      {company.unassignedTaskCount > 0 ? (
        <Badge tone="warning">미배정 {company.unassignedTaskCount}</Badge>
      ) : null}
    </div>
  );
}

function UpcomingPopover({ company }: { company: CompanyListRow }) {
  if (company.upcomingItems.length <= 1) return null;
  return (
    <details className="portfolio-popover">
      <summary>마감 {company.upcomingCount}건</summary>
      <div className="portfolio-popover-card">
        {company.upcomingItems.map((item, index) => (
          <div key={`${item.source}-${item.title}-${index}`}>
            <span>{SOURCE_LABEL[item.source]}</span>
            <strong>{item.title}</strong>
            <DdayBadge daysLeft={item.daysLeft} />
          </div>
        ))}
      </div>
    </details>
  );
}

function PortfolioTaskList({
  company,
  categories,
  demo,
  canWriteTasks,
  showToast,
}: {
  company: CompanyListRow;
  categories: CompaniesData["categories"];
  demo: boolean;
  canWriteTasks: boolean;
  showToast: (message: string, options?: ToastOptions) => void;
}) {
  const [loading, startLoading] = useTransition();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      const result = await getCompanyPortfolioTasks(company.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTasks(result.tasks);
    });
  }, [company.id]);

  function updateTaskState(taskId: string, snapshot: TaskStateSnapshot) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              stage: snapshot.stage,
              workStatus: snapshot.workStatus,
              updatedAt: snapshot.updatedAt,
            }
          : task,
      ),
    );
  }

  const editable = canWriteTasks && company.status !== "ended";

  return (
    <div className="portfolio-task-drawer">
      <div className="portfolio-task-drawer-head">
        <div>
          <strong>{company.name} Task</strong>
          <span>지연·보류·마감 임박순</span>
        </div>
        {editable ? (
          <Button size="sm" variant="cta" onClick={() => setAdding(true)}>
            <IconPlus /> Task 추가
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="portfolio-task-loading">Task를 불러오는 중…</div>
      ) : error ? (
        <div className="portfolio-task-error">{error}</div>
      ) : tasks.length === 0 ? (
        <div className="portfolio-task-empty">등록된 Task가 없습니다.</div>
      ) : (
        <div className="portfolio-task-list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`portfolio-task-row${
                task.workStatus === "completed" ? " is-completed" : ""
              }`}
            >
              <Link
                href={`/app/companies/${company.id}?tab=tasks`}
                className="portfolio-task-title"
              >
                <strong>{task.title}</strong>
                <span>
                  {task.categoryName ?? "미분류"} ·{" "}
                  {task.assigneeName ?? "담당 미배정"}
                </span>
              </Link>
              <TaskDday
                workStatus={task.workStatus}
                daysLeft={task.daysLeft}
              />
              <TaskStateControls
                companyId={company.id}
                taskId={task.id}
                taskTitle={task.title}
                stage={task.stage}
                workStatus={task.workStatus}
                updatedAt={task.updatedAt}
                canEdit={editable}
                compact
                showToast={showToast}
                onChange={(snapshot) => updateTaskState(task.id, snapshot)}
              />
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <AddTaskSlideOver
          companyId={company.id}
          categories={categories}
          demo={demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

export function CompaniesTable({
  data,
  initialQuery = "",
  initialTag = null,
  initialSort = null,
  initialScope = null,
  initialView = null,
  initialConsultant = null,
  initialWorkStatus = null,
}: {
  data: CompaniesData;
  initialQuery?: string;
  initialTag?: string | null;
  initialSort?: string | null;
  initialScope?: string | null;
  initialView?: string | null;
  initialConsultant?: string | null;
  initialWorkStatus?: string | null;
}) {
  const { toast, showToast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState<string | null>(initialTag);
  const [scope, setScope] = useState<ScopeKey>(
    data.canViewTeam && isScopeKey(initialScope) ? initialScope : "mine",
  );
  const [view, setView] = useState<ViewKey>(
    isViewKey(initialView) ? initialView : "all",
  );
  const [consultant, setConsultant] = useState(
    initialConsultant && data.canViewTeam ? initialConsultant : "all",
  );
  const [workStatus, setWorkStatus] = useState<WorkStatusFilter>(
    isWorkStatusFilter(initialWorkStatus) ? initialWorkStatus : "all",
  );
  const [sort, setSort] = useState<SortKey>(
    isSortKey(initialSort) ? initialSort : "risk",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!data.canViewTeam && scope === "team") setScope("mine");
  }, [data.canViewTeam, scope]);

  useEffect(() => {
    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    if (tag) params.set("tag", tag);
    if (scope !== "mine") params.set("scope", scope);
    if (view !== "all") params.set("view", view);
    if (scope === "team" && consultant !== "all") {
      params.set("consultant", consultant);
    }
    if (workStatus !== "all") params.set("work", workStatus);
    if (sort !== "risk") params.set("sort", sort);
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `/app/companies?${search}` : "/app/companies",
    );
  }, [consultant, query, scope, sort, tag, view, workStatus]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const company of data.companies) {
      for (const value of company.conditionTags) tags.add(value);
    }
    return [...tags].sort((a, b) => a.localeCompare(b, "ko"));
  }, [data.companies]);

  const scopedCompanies = useMemo(
    () =>
      data.companies.filter((company) => {
        if (scope === "mine") {
          return company.primaryConsultantId === data.currentProfileId;
        }
        if (consultant === "unassigned") {
          return company.primaryConsultantId === null;
        }
        return consultant === "all" || company.primaryConsultantId === consultant;
      }),
    [consultant, data.companies, data.currentProfileId, scope],
  );

  const counts = useMemo(() => {
    const active = scopedCompanies.filter((company) => company.status !== "ended");
    return {
      all: active.length,
      attention: active.filter(hasAttention).length,
      stable: active.filter((company) => !hasAttention(company)).length,
      ended: scopedCompanies.length - active.length,
    };
  }, [scopedCompanies]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = scopedCompanies.filter((company) => {
      const ended = company.status === "ended";
      if (view === "ended" ? !ended : ended) return false;
      if (view === "attention" && !hasAttention(company)) return false;
      if (view === "stable" && hasAttention(company)) return false;
      if (tag && !company.conditionTags.includes(tag)) return false;
      if (
        workStatus !== "all" &&
        company.workStatusCounts[workStatus] === 0
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        company.name.toLowerCase().includes(needle) ||
        (company.industry ?? "").toLowerCase().includes(needle) ||
        (company.primaryConsultantName ?? "").toLowerCase().includes(needle)
      );
    });

    const sorted = [...filtered];
    if (view === "ended") {
      sorted.sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else if (sort === "recent") {
      sorted.sort((a, b) =>
        (b.latestTaskUpdatedAt ?? b.createdAt).localeCompare(
          a.latestTaskUpdatedAt ?? a.createdAt,
        ),
      );
    } else {
      sorted.sort(compareRisk);
    }
    return sorted;
  }, [query, scopedCompanies, sort, tag, view, workStatus]);

  const isFiltered =
    query.trim() !== "" ||
    tag !== null ||
    workStatus !== "all" ||
    consultant !== "all";

  return (
    <>
      <div className="portfolio-toolbar">
        <div className="portfolio-scope" role="group" aria-label="기업 관제 범위">
          <button
            type="button"
            className={`pill-tab${scope === "mine" ? " is-active" : ""}`}
            onClick={() => {
              setScope("mine");
              setConsultant("all");
            }}
          >
            <IconUser /> 내 담당
          </button>
          {data.canViewTeam ? (
            <button
              type="button"
              className={`pill-tab${scope === "team" ? " is-active" : ""}`}
              onClick={() => setScope("team")}
            >
              <IconBuilding /> 팀 전체
            </button>
          ) : null}
        </div>
        <div className="portfolio-view-tabs" role="group" aria-label="기업 상태 보기">
          {(
            [
              ["all", "전체"],
              ["attention", "집중관리"],
              ["stable", "정상"],
              ["ended", "종료"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`pill-tab${view === value ? " is-active" : ""}`}
              onClick={() => setView(value)}
            >
              {label} {counts[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar portfolio-filter-bar">
        <div className="search-pill">
          <IconSearch />
          <input
            type="search"
            placeholder="기업·업종·주담당 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="기업·업종·주담당 검색"
          />
        </div>
        {scope === "team" ? (
          <select
            className="select-pill"
            value={consultant}
            onChange={(event) => setConsultant(event.target.value)}
            aria-label="주담당 컨설턴트 필터"
          >
            <option value="all">주담당 전체</option>
            <option value="unassigned">주담당 미배정</option>
            {data.consultants.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="select-pill"
          value={workStatus}
          onChange={(event) =>
            setWorkStatus(event.target.value as WorkStatusFilter)
          }
          aria-label="업무상태 필터"
        >
          <option value="all">업무상태 전체</option>
          {TASK_WORK_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {TASK_WORK_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <div className="tag-tabs" role="group" aria-label="컨디션 태그 필터">
          <button
            type="button"
            className={`pill-tab${tag === null ? " is-active" : ""}`}
            onClick={() => setTag(null)}
          >
            태그 전체
          </button>
          {allTags.map((value) => (
            <button
              key={value}
              type="button"
              className={`pill-tab${tag === value ? " is-active" : ""}`}
              onClick={() => setTag(tag === value ? null : value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {view !== "ended" ? (
          <select
            className="select-pill"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="정렬"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <Panel className="portfolio-panel">
        {rows.length === 0 ? (
          <div className="empty-w" style={{ padding: "56px 16px" }}>
            <IconSearch />
            <p>
              {scope === "mine" && scopedCompanies.length === 0
                ? "내 담당 기업이 없습니다"
                : "조건에 맞는 기업이 없습니다"}
            </p>
            {isFiltered ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setTag(null);
                  setConsultant("all");
                  setWorkStatus("all");
                }}
              >
                필터 초기화
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>기업·주담당</th>
                  <th>진행단계</th>
                  <th>업무상태</th>
                  <th>위험 항목</th>
                  <th>다음 우선 Task</th>
                  <th>최근 업데이트</th>
                  <th>
                    <span className="sr-only">맞춤 정부지원사업</span>
                  </th>
                  <th>
                    <span className="sr-only">Task 펼치기</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((company) => {
                  const expanded = expandedId === company.id;
                  return (
                    <CompanyPortfolioRows
                      key={company.id}
                      company={company}
                      expanded={expanded}
                      onToggle={() =>
                        setExpandedId((current) =>
                          current === company.id ? null : company.id,
                        )
                      }
                      data={data}
                      showToast={showToast}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Toast message={toast} />
    </>
  );
}

function CompanyPortfolioRows({
  company,
  expanded,
  onToggle,
  data,
  showToast,
}: {
  company: CompanyListRow;
  expanded: boolean;
  onToggle: () => void;
  data: CompaniesData;
  showToast: (message: string, options?: ToastOptions) => void;
}) {
  return (
    <>
      <tr className={expanded ? "is-expanded" : undefined}>
        <td>
          <div className="portfolio-company">
            <Link href={`/app/companies/${company.id}`}>{company.name}</Link>
            <span>
              {company.industry ?? "업종 미입력"} ·{" "}
              {company.primaryConsultantName ?? "주담당 미배정"}
            </span>
          </div>
        </td>
        <td>
          <StageDistribution counts={company.stageCounts} />
        </td>
        <td>
          <WorkStatusSummary counts={company.workStatusCounts} />
        </td>
        <td>
          {company.status === "ended" ? (
            <Badge tone="neutral">
              {company.endedAt
                ? `${formatDotDateString(company.endedAt.slice(0, 10))} 종료`
                : "종료"}
            </Badge>
          ) : (
            <>
              <RiskSummary company={company} />
              <UpcomingPopover company={company} />
            </>
          )}
        </td>
        <td>
          {company.priorityTask ? (
            <div className="portfolio-priority-task">
              <strong>{company.priorityTask.title}</strong>
              <span>
                {TASK_STAGE_LABEL[company.priorityTask.stage]} ·{" "}
                {TASK_WORK_STATUS_LABEL[company.priorityTask.workStatus]} ·{" "}
                {company.priorityTask.assigneeName ?? "미배정"}
              </span>
              <TaskDday
                workStatus={company.priorityTask.workStatus}
                daysLeft={company.priorityTask.daysLeft}
              />
            </div>
          ) : (
            <span className="portfolio-empty-value">진행 Task 없음</span>
          )}
        </td>
        <td>
          <span className="portfolio-recent">
            <IconClock />
            {formatRecent(company.latestTaskUpdatedAt)}
          </span>
        </td>
        <td className="portfolio-program-cell">
          <LinkButton
            variant="secondary"
            size="sm"
            href={`/app/companies/${company.id}/gov-programs`}
          >
            <IconSparkle /> 맞춤 사업
          </LinkButton>
        </td>
        <td className="portfolio-expand-cell">
          <button
            type="button"
            className={`portfolio-expand${expanded ? " is-open" : ""}`}
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${company.name} Task ${expanded ? "접기" : "펼치기"}`}
          >
            <IconArrow />
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="portfolio-drawer-row">
          <td colSpan={8}>
            <PortfolioTaskList
              company={company}
              categories={data.categories}
              demo={data.demo}
              canWriteTasks={data.canWriteTasks}
              showToast={showToast}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}
