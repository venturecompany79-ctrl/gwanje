"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import type { ToastOptions } from "@/components/ui/Toast";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconKanban,
  IconList,
  IconPlus,
  IconSearch,
} from "@/components/ui/icons";
import { TaskDday } from "@/components/tasks/Stepper";
import {
  TaskStateControls,
  type TaskStateSnapshot,
} from "@/components/tasks/TaskStateControls";
import {
  AddTaskSlideOver,
  TaskSlideOver,
} from "@/components/tasks/TaskSlideOver";
import { updateTaskWorkStatus } from "@/lib/actions/tasks";
import type { TaskWorkStatus } from "@/lib/database.types";
import type { BoardData, BoardTask } from "@/lib/data/board";
import {
  TASK_WORK_STATUS_LABEL,
  TASK_WORK_STATUS_ORDER,
  type ActiveTaskWorkStatus,
} from "@/lib/labels";
import { CompanyName } from "@/components/ui/CompanyName";

type DueFilter = "all" | "7" | "30" | "overdue";
type ViewMode = "kanban" | "list";

// 뷰 선택은 뷰어별 편의 설정 — URL(view=list)이 우선, 없으면 마지막 선택.
const VIEW_STORAGE_KEY = "gwanje.taskBoard.view";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "마감기간 전체" },
  { value: "7", label: "7일 이내" },
  { value: "30", label: "30일 이내" },
  { value: "overdue", label: "기한 지남" },
];

function BoardCard({
  task,
  state,
  dragging,
  canWrite,
  onDragStart,
  onDragEnd,
  onOpen,
  showToast,
  onStateChange,
}: {
  task: BoardTask;
  state: TaskStateSnapshot;
  dragging: boolean;
  canWrite: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  showToast: (message: string, options?: ToastOptions) => void;
  onStateChange: (snapshot: TaskStateSnapshot) => void;
}) {
  return (
    <div
      className={`kcard${dragging ? " is-dragging" : ""}`}
      draggable={canWrite}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="kcard-open"
        onClick={onOpen}
        aria-label={`${task.title} 상세 열기`}
      >
        <span className="kc-co">
          <CompanyName id={task.companyId} name={task.companyName} withMark />
        </span>
        <span className="kc-task">{task.title}</span>
        <span className="kc-foot">
          <CategoryChip name={task.categoryName} />
          <TaskDday workStatus={state.workStatus} daysLeft={task.daysLeft} />
        </span>
        {task.assigneeName ? (
          <span className="kc-owner">
            <span className="avatar">{task.assigneeName.slice(0, 1)}</span>
            {task.assigneeName}
          </span>
        ) : (
          <span className="kc-owner is-unassigned">담당 미배정</span>
        )}
      </button>
      <TaskStateControls
        companyId={task.companyId}
        taskId={task.id}
        taskTitle={task.title}
        workStatus={state.workStatus}
        updatedAt={state.updatedAt}
        canEdit={canWrite}
        compact
        showToast={showToast}
        onChange={onStateChange}
      />
    </div>
  );
}

export function TaskBoard({
  data,
  addRequest,
  showToast,
}: {
  data: BoardData;
  addRequest: number;
  showToast: (message: string, options?: ToastOptions) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const handledAddRequestRef = useRef(addRequest);

  const initialDue = searchParams.get("due");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [companyFilter, setCompanyFilter] = useState(
    searchParams.get("company") ?? "all",
  );
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get("category") ?? "all",
  );
  const [dueFilter, setDueFilter] = useState<DueFilter>(
    DUE_OPTIONS.some((option) => option.value === initialDue)
      ? (initialDue as DueFilter)
      : "all",
  );
  const [scope, setScope] = useState<"mine" | "team">(
    data.canViewTeam && searchParams.get("scope") === "team" ? "team" : "mine",
  );
  const [assigneeFilter, setAssigneeFilter] = useState(
    searchParams.get("assignee") ?? "all",
  );
  const [workStatusFilter, setWorkStatusFilter] = useState<
    "all" | ActiveTaskWorkStatus
  >(
    TASK_WORK_STATUS_ORDER.includes(
      searchParams.get("status") as ActiveTaskWorkStatus,
    )
      ? (searchParams.get("status") as ActiveTaskWorkStatus)
      : "all",
  );
  const [showCompleted, setShowCompleted] = useState(
    searchParams.get("completed") === "1" ||
      searchParams.get("status") === "completed",
  );
  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "list" ? "list" : "kanban",
  );
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overWorkStatus, setOverWorkStatus] =
    useState<TaskWorkStatus | null>(null);
  const [stateById, setStateById] = useState<
    Record<string, TaskStateSnapshot>
  >({});

  const applyTaskState = useCallback(
    (taskId: string, snapshot: TaskStateSnapshot) => {
      if (snapshot.workStatus === "completed") {
        setShowCompleted(true);
      }
      setStateById((current) => ({ ...current, [taskId]: snapshot }));
    },
    [],
  );

  useEffect(() => {
    if (searchParams.get("view")) return;
    try {
      if (localStorage.getItem(VIEW_STORAGE_KEY) === "list") setView("list");
    } catch {}
    // 최초 1회만 — 이후 선택은 changeView가 저장한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {}
  }

  useEffect(() => {
    if (addRequest === handledAddRequestRef.current) return;
    handledAddRequestRef.current = addRequest;
    if (!data.canWriteTasks) return;
    setAdding(true);
  }, [addRequest, data.canWriteTasks]);

  const effectiveState = useCallback(
    (task: BoardTask): TaskStateSnapshot =>
      stateById[task.id] ?? {
        workStatus: task.workStatus,
        updatedAt: task.updatedAt,
      },
    [stateById],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", "tasks");
    if (view === "list") params.set("view", "list");
    if (scope === "team") params.set("scope", "team");
    if (scope === "team" && assigneeFilter !== "all") {
      params.set("assignee", assigneeFilter);
    }
    if (workStatusFilter !== "all") params.set("status", workStatusFilter);
    if (showCompleted) params.set("completed", "1");
    if (companyFilter !== "all") params.set("company", companyFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (dueFilter !== "all") params.set("due", dueFilter);
    if (query.trim()) params.set("q", query.trim());
    window.history.replaceState(null, "", `/app/board?${params.toString()}`);
  }, [
    assigneeFilter,
    categoryFilter,
    companyFilter,
    dueFilter,
    query,
    scope,
    showCompleted,
    view,
    workStatusFilter,
  ]);

  // 칸반은 컬럼 자체가 상태라 상태 필터를 목록 보기에서만 적용한다.
  const statusFilter = view === "list" ? workStatusFilter : "all";

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.tasks.filter((t) => {
      const taskState = effectiveState(t);
      if (!showCompleted && taskState.workStatus === "completed") return false;
      if (statusFilter !== "all" && taskState.workStatus !== statusFilter) {
        return false;
      }
      if (scope === "mine" && t.assigneeId !== data.currentProfileId) return false;
      if (scope === "team") {
        if (assigneeFilter === "unassigned" && t.assigneeId !== null) return false;
        if (
          assigneeFilter !== "all" &&
          assigneeFilter !== "unassigned" &&
          t.assigneeId !== assigneeFilter
        ) {
          return false;
        }
      }
      if (companyFilter !== "all" && t.companyId !== companyFilter) return false;
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      if (
        dueFilter === "7" &&
        !(t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 7)
      ) {
        return false;
      }
      if (
        dueFilter === "30" &&
        !(t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 30)
      ) {
        return false;
      }
      if (
        dueFilter === "overdue" &&
        !(t.daysLeft !== null && t.daysLeft < 0 && taskState.workStatus !== "completed")
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.companyName.toLowerCase().includes(needle)
      );
    });
  }, [
    assigneeFilter,
    categoryFilter,
    companyFilter,
    data.currentProfileId,
    data.tasks,
    dueFilter,
    query,
    scope,
    showCompleted,
    effectiveState,
    statusFilter,
  ]);

  // 목록: 진행 중 → 기한 지남 우선 → 마감 임박순, 완료는 맨 뒤
  const sortedRows = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const doneA = effectiveState(a).workStatus === "completed" ? 1 : 0;
        const doneB = effectiveState(b).workStatus === "completed" ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        return (
          (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
          (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
        );
      }),
    [effectiveState, filtered],
  );
  const kanbanStatuses = showCompleted
    ? TASK_WORK_STATUS_ORDER
    : TASK_WORK_STATUS_ORDER.filter((status) => status !== "completed");

  const isFiltered =
    query.trim() !== "" ||
    companyFilter !== "all" ||
    categoryFilter !== "all" ||
    dueFilter !== "all" ||
    scope !== "mine" ||
    assigneeFilter !== "all" ||
    statusFilter !== "all" ||
    showCompleted;

  const selected = data.tasks.find((t) => t.id === selectedId) ?? null;

  function handleDrop(workStatus: TaskWorkStatus) {
    const task = data.tasks.find((t) => t.id === draggingId) ?? null;
    setDraggingId(null);
    setOverWorkStatus(null);
    if (!task || effectiveState(task).workStatus === workStatus) return;

    const previous = effectiveState(task);
    applyTaskState(task.id, { ...previous, workStatus });
    startTransition(async () => {
      const result = await updateTaskWorkStatus(
        task.companyId,
        task.id,
        workStatus,
        previous.updatedAt,
      );
      if (!result.ok || !result.updatedAt) {
        const fallback =
          result.conflict && result.workStatus && result.updatedAt
            ? { workStatus: result.workStatus, updatedAt: result.updatedAt }
            : previous;
        applyTaskState(task.id, fallback);
        showToast(result.error ?? "변경에 실패했습니다.");
        return;
      }
      const applied: TaskStateSnapshot = {
        workStatus: result.workStatus ?? workStatus,
        updatedAt: result.updatedAt,
      };
      applyTaskState(task.id, applied);
      showToast(`'${TASK_WORK_STATUS_LABEL[workStatus]}' 상태로 변경되었습니다`, {
        actionLabel: "되돌리기",
        durationMs: 5000,
        onAction: async () => {
          const undo = await updateTaskWorkStatus(
            task.companyId,
            task.id,
            previous.workStatus,
            applied.updatedAt,
          );
          if (!undo.ok || !undo.updatedAt) {
            if (undo.conflict && undo.workStatus && undo.updatedAt) {
              applyTaskState(task.id, {
                workStatus: undo.workStatus,
                updatedAt: undo.updatedAt,
              });
            }
            showToast(undo.error ?? "되돌리기에 실패했습니다.");
            router.refresh();
            return;
          }
          const undoUpdatedAt = undo.updatedAt;
          applyTaskState(task.id, {
            workStatus: undo.workStatus ?? previous.workStatus,
            updatedAt: undoUpdatedAt,
          });
          showToast("상태 변경을 되돌렸습니다.");
          router.refresh();
        },
      });
      router.refresh();
    });
  }

  return (
    <>
      {data.tasks.length === 0 ? (
        <EmptyState
          icon={<IconKanban />}
          title="첫 Task를 추가하세요"
          description={
            data.canWriteTasks
              ? "관리 중인 기업의 Task를 등록하면 상태별 보드에서 진행 상황을 한눈에 관제할 수 있습니다."
              : "조회할 Task가 아직 없습니다."
          }
          action={
            data.canWriteTasks ? (
              <Button variant="cta" onClick={() => setAdding(true)}>
                <IconPlus /> Task 추가
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="task-toolbar">
            {data.canViewTeam ? (
              <div className="seg-toggle" role="group" aria-label="Task 범위">
                <button
                  type="button"
                  aria-pressed={scope === "mine"}
                  onClick={() => {
                    setScope("mine");
                    setAssigneeFilter("all");
                  }}
                >
                  내 Task
                </button>
                <button
                  type="button"
                  aria-pressed={scope === "team"}
                  onClick={() => setScope("team")}
                >
                  팀 전체
                </button>
              </div>
            ) : null}
            <div className="spacer" />
            <button
              type="button"
              className={`pill-tab${showCompleted ? " is-active" : ""}`}
              aria-pressed={showCompleted}
              onClick={() => setShowCompleted((value) => !value)}
            >
              완료 포함
            </button>
            <div className="seg-toggle" role="group" aria-label="보기 방식">
              <button
                type="button"
                aria-pressed={view === "kanban"}
                onClick={() => changeView("kanban")}
              >
                <IconKanban /> 칸반
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                onClick={() => changeView("list")}
              >
                <IconList /> 목록
              </button>
            </div>
          </div>
          <div className="filter-bar">
            {scope === "team" ? (
              <select
                className="select-pill"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                aria-label="Task 담당자 필터"
              >
                <option value="all">담당자 전체</option>
                <option value="unassigned">담당 미배정</option>
                {data.consultants.map((consultant) => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.name}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className="select-pill"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="기업 필터"
            >
              <option value="all">기업 전체</option>
              {data.companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <select
              className="select-pill"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="분류 필터"
            >
              <option value="all">분류 전체</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {view === "list" ? (
              <select
                className="select-pill"
                value={workStatusFilter}
                onChange={(e) => {
                  const next = e.target.value as "all" | ActiveTaskWorkStatus;
                  setWorkStatusFilter(next);
                  if (next === "completed") setShowCompleted(true);
                }}
                aria-label="상태 필터"
              >
                <option value="all">상태 전체</option>
                {TASK_WORK_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {TASK_WORK_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className="select-pill"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              aria-label="마감기간 필터"
            >
              {DUE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="spacer" />
            <div className="search-pill">
              <IconSearch />
              <input
                type="search"
                placeholder="Task 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Task 검색"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="panel empty-w" style={{ padding: "56px 16px" }}>
              <IconSearch />
              <p>조건에 맞는 Task가 없습니다</p>
              {isFiltered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setCompanyFilter("all");
                    setCategoryFilter("all");
                    setDueFilter("all");
                    setAssigneeFilter("all");
                    setWorkStatusFilter("all");
                    setShowCompleted(false);
                  }}
                >
                  필터 초기화
                </Button>
              ) : null}
            </div>
          ) : view === "list" ? (
            <div className="panel task-list-wrap">
              <table className="dlist task-list">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>분류</th>
                    <th>마감</th>
                    {scope === "team" ? <th>담당</th> : null}
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((t) => {
                    const taskState = effectiveState(t);
                    return (
                      <tr
                        key={t.id}
                        className={
                          taskState.workStatus === "completed" ? "is-done" : undefined
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className="task-list-open"
                            onClick={() => setSelectedId(t.id)}
                          >
                            <span className="task-list-title">{t.title}</span>
                            <CompanyName
                              id={t.companyId}
                              name={t.companyName}
                              withMark
                            />
                          </button>
                        </td>
                        <td>
                          <CategoryChip name={t.categoryName} />
                        </td>
                        <td>
                          <TaskDday
                            workStatus={taskState.workStatus}
                            daysLeft={t.daysLeft}
                          />
                        </td>
                        {scope === "team" ? (
                          <td className="cell-muted">
                            {t.assigneeName ?? "미배정"}
                          </td>
                        ) : null}
                        <td>
                          <TaskStateControls
                            companyId={t.companyId}
                            taskId={t.id}
                            taskTitle={t.title}
                            workStatus={taskState.workStatus}
                            updatedAt={taskState.updatedAt}
                            canEdit={data.canWriteTasks}
                            compact
                            showToast={showToast}
                            onChange={(snapshot) => applyTaskState(t.id, snapshot)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`board${showCompleted ? "" : " board--3"}`}>
              {kanbanStatuses.map((workStatus) => {
                const columnTasks = filtered.filter(
                  (t) => effectiveState(t).workStatus === workStatus,
                );
                return (
                  <section
                    key={workStatus}
                    className={`kcol${
                      overWorkStatus === workStatus ? " is-over" : ""
                    }`}
                    aria-label={`${TASK_WORK_STATUS_LABEL[workStatus]} 상태 컬럼`}
                    onDragOver={(e) => {
                      if (!data.canWriteTasks) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (overWorkStatus !== workStatus) {
                        setOverWorkStatus(workStatus);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setOverWorkStatus((current) =>
                          current === workStatus ? null : current,
                        );
                      }
                    }}
                    onDrop={(e) => {
                      if (!data.canWriteTasks) return;
                      e.preventDefault();
                      handleDrop(workStatus);
                    }}
                  >
                    <div className="kcol-head">
                      <span className={`kdot kdot--${workStatus}`} />
                      <h3>{TASK_WORK_STATUS_LABEL[workStatus]}</h3>
                      <span className="cnt num">{columnTasks.length}</span>
                    </div>
                    <div className="kcol-body">
                      {columnTasks.map((t) => (
                        <BoardCard
                          key={t.id}
                          task={t}
                          state={effectiveState(t)}
                          dragging={draggingId === t.id}
                          canWrite={data.canWriteTasks}
                          onDragStart={(e) => {
                            if (!data.canWriteTasks) return;
                            setDraggingId(t.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", t.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setOverWorkStatus(null);
                          }}
                          onOpen={() => setSelectedId(t.id)}
                          showToast={showToast}
                          onStateChange={(snapshot) =>
                            applyTaskState(t.id, snapshot)
                          }
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected ? (
        <TaskSlideOver
          key={selected.id}
          companyId={selected.companyId}
          companyName={selected.companyName}
          task={{
            ...selected,
            ...effectiveState(selected),
          }}
          categories={data.categories}
          demo={data.demo}
          canEdit={data.canWriteTasks}
          showToast={showToast}
          onStateChange={(snapshot) =>
            applyTaskState(selected.id, snapshot)
          }
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {adding && data.canWriteTasks ? (
        <AddTaskSlideOver
          companies={data.companies}
          categories={data.categories}
          demo={data.demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
