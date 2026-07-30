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
  IconBuilding,
  IconKanban,
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
} from "@/lib/labels";

type DueFilter = "all" | "7" | "30" | "overdue";

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
          <IconBuilding /> {task.companyName}
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
        stage={state.stage}
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
    "all" | TaskWorkStatus
  >(
    TASK_WORK_STATUS_ORDER.includes(
      searchParams.get("status") as TaskWorkStatus,
    )
      ? (searchParams.get("status") as TaskWorkStatus)
      : "all",
  );
  const [showCompleted, setShowCompleted] = useState(
    searchParams.get("completed") === "1",
  );
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overWorkStatus, setOverWorkStatus] =
    useState<TaskWorkStatus | null>(null);
  const [stateById, setStateById] = useState<
    Record<string, TaskStateSnapshot>
  >({});

  useEffect(() => {
    if (addRequest === handledAddRequestRef.current) return;
    handledAddRequestRef.current = addRequest;
    if (!data.canWriteTasks) return;
    setAdding(true);
  }, [addRequest, data.canWriteTasks]);

  const effectiveState = useCallback(
    (task: BoardTask): TaskStateSnapshot =>
      stateById[task.id] ?? {
        stage: task.stage,
        workStatus: task.workStatus,
        updatedAt: task.updatedAt,
      },
    [stateById],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", "tasks");
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
    workStatusFilter,
  ]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.tasks.filter((t) => {
      const taskState = effectiveState(t);
      if (!showCompleted && taskState.workStatus === "completed") return false;
      if (
        workStatusFilter !== "all" &&
        taskState.workStatus !== workStatusFilter
      ) {
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
    workStatusFilter,
  ]);

  const isFiltered =
    query.trim() !== "" ||
    companyFilter !== "all" ||
    categoryFilter !== "all" ||
    dueFilter !== "all" ||
    scope !== "mine" ||
    assigneeFilter !== "all" ||
    workStatusFilter !== "all" ||
    showCompleted;

  const selected = data.tasks.find((t) => t.id === selectedId) ?? null;

  function handleDrop(workStatus: TaskWorkStatus) {
    const task = data.tasks.find((t) => t.id === draggingId) ?? null;
    setDraggingId(null);
    setOverWorkStatus(null);
    if (!task || effectiveState(task).workStatus === workStatus) return;

    const previous = effectiveState(task);
    setStateById((current) => ({
      ...current,
      [task.id]: { ...previous, workStatus },
    }));
    startTransition(async () => {
      const result = await updateTaskWorkStatus(
        task.companyId,
        task.id,
        workStatus,
        previous.updatedAt,
      );
      if (!result.ok || !result.updatedAt) {
        const fallback =
          result.conflict &&
          result.stage &&
          result.workStatus &&
          result.updatedAt
            ? {
                stage: result.stage,
                workStatus: result.workStatus,
                updatedAt: result.updatedAt,
              }
            : previous;
        setStateById((current) => ({ ...current, [task.id]: fallback }));
        showToast(result.error ?? "변경에 실패했습니다.");
        return;
      }
      const applied: TaskStateSnapshot = {
        stage: result.stage ?? previous.stage,
        workStatus: result.workStatus ?? workStatus,
        updatedAt: result.updatedAt,
      };
      setStateById((current) => ({ ...current, [task.id]: applied }));
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
            if (
              undo.conflict &&
              undo.stage &&
              undo.workStatus &&
              undo.updatedAt
            ) {
              setStateById((current) => ({
                ...current,
                [task.id]: {
                  stage: undo.stage!,
                  workStatus: undo.workStatus!,
                  updatedAt: undo.updatedAt!,
                },
              }));
            }
            showToast(undo.error ?? "되돌리기에 실패했습니다.");
            router.refresh();
            return;
          }
          const undoUpdatedAt = undo.updatedAt;
          setStateById((current) => ({
            ...current,
            [task.id]: {
              stage: undo.stage ?? previous.stage,
              workStatus: undo.workStatus ?? previous.workStatus,
              updatedAt: undoUpdatedAt,
            },
          }));
          showToast("업무상태 변경을 되돌렸습니다.");
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
              ? "관리 중인 기업의 Task를 등록하면 업무상태별 보드에서 진행 상황을 한눈에 관제할 수 있습니다."
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
          <div className="board-scope-row">
            <div className="portfolio-scope" role="group" aria-label="Task 관제 범위">
              <button
                type="button"
                className={`pill-tab${scope === "mine" ? " is-active" : ""}`}
                onClick={() => {
                  setScope("mine");
                  setAssigneeFilter("all");
                }}
              >
                내 Task
              </button>
              {data.canViewTeam ? (
                <button
                  type="button"
                  className={`pill-tab${scope === "team" ? " is-active" : ""}`}
                  onClick={() => setScope("team")}
                >
                  팀 전체
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className={`pill-tab${showCompleted ? " is-active" : ""}`}
              aria-pressed={showCompleted}
              onClick={() => setShowCompleted((value) => !value)}
            >
              완료 포함
            </button>
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
            <select
              className="select-pill"
              value={workStatusFilter}
              onChange={(e) =>
                setWorkStatusFilter(e.target.value as "all" | TaskWorkStatus)
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
          ) : (
            <div className="board">
              {TASK_WORK_STATUS_ORDER.map((workStatus) => {
                const columnTasks = filtered.filter(
                  (t) => effectiveState(t).workStatus === workStatus,
                );
                return (
                  <section
                    key={workStatus}
                    className={`kcol${
                      overWorkStatus === workStatus ? " is-over" : ""
                    }`}
                    aria-label={`${TASK_WORK_STATUS_LABEL[workStatus]} 업무상태 컬럼`}
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
                            setStateById((current) => ({
                              ...current,
                              [t.id]: snapshot,
                            }))
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
