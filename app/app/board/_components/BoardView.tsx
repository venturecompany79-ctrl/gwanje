"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  IconBuilding,
  IconKanban,
  IconPlus,
  IconSearch,
} from "@/components/ui/icons";
import { TaskDday } from "@/components/tasks/Stepper";
import {
  AddTaskSlideOver,
  TaskSlideOver,
} from "@/components/tasks/TaskSlideOver";
import { updateTaskStage } from "@/lib/actions/tasks";
import { TASK_STAGE_LABEL, TASK_STAGE_ORDER } from "@/lib/labels";
import type { TaskStage } from "@/lib/database.types";
import type { BoardData, BoardTask } from "@/lib/data/board";

type DueFilter = "all" | "7" | "30" | "overdue";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "마감기간 전체" },
  { value: "7", label: "7일 이내" },
  { value: "30", label: "30일 이내" },
  { value: "overdue", label: "기한 지남" },
];

function BoardCard({
  task,
  stage,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  task: BoardTask;
  stage: TaskStage;
  dragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`kcard${dragging ? " is-dragging" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="kc-co">
        <IconBuilding /> {task.companyName}
      </div>
      <div className="kc-task">{task.title}</div>
      <div className="kc-foot">
        <CategoryChip name={task.categoryName} />
        <TaskDday stage={stage} daysLeft={task.daysLeft} />
      </div>
      {task.assigneeName ? (
        <div className="kc-owner">
          <span className="avatar">{task.assigneeName.slice(0, 1)}</span>
          {task.assigneeName}
        </div>
      ) : null}
    </div>
  );
}

export function BoardView({ data }: { data: BoardData }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<TaskStage | null>(null);
  // 드래그 직후 서버 반영 전까지의 낙관적 단계 오버라이드
  const [stageOverride, setStageOverride] = useState<Record<string, TaskStage>>({});

  const effectiveStage = (t: BoardTask): TaskStage =>
    stageOverride[t.id] ?? t.stage;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.tasks.filter((t) => {
      if (companyFilter !== "all" && t.companyId !== companyFilter) return false;
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      const stage = stageOverride[t.id] ?? t.stage;
      if (dueFilter === "7" && !(t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 7)) return false;
      if (dueFilter === "30" && !(t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 30)) return false;
      if (dueFilter === "overdue" && !(t.daysLeft !== null && t.daysLeft < 0 && stage !== "result")) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.companyName.toLowerCase().includes(needle)
      );
    });
  }, [data.tasks, query, companyFilter, categoryFilter, dueFilter, stageOverride]);

  const isFiltered =
    query.trim() !== "" ||
    companyFilter !== "all" ||
    categoryFilter !== "all" ||
    dueFilter !== "all";

  const selected = data.tasks.find((t) => t.id === selectedId) ?? null;

  function handleDrop(stage: TaskStage) {
    const task = data.tasks.find((t) => t.id === draggingId) ?? null;
    setDraggingId(null);
    setOverStage(null);
    if (!task || effectiveStage(task) === stage) return;

    setStageOverride((prev) => ({ ...prev, [task.id]: stage }));
    startTransition(async () => {
      const result = await updateTaskStage(task.companyId, task.id, stage);
      if (!result.ok) {
        // 실패(데모 포함) 시 원래 컬럼으로 복귀
        setStageOverride((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
        showToast(result.error ?? "변경에 실패했습니다.");
        return;
      }
      showToast(
        `'${TASK_STAGE_LABEL[stage]}' 단계로 변경되었습니다`,
      );
      router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>관리포인트 보드</h1>
          <div className="sub">
            {data.tasks.length === 0
              ? "첫 과제를 등록해 시작하세요"
              : `전체 ${data.tasks.length}건`}
          </div>
        </div>
        <div className="spacer" />
        <div className="head-actions">
          <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
            <IconPlus /> 과제 추가
          </Button>
        </div>
      </div>

      {data.tasks.length === 0 ? (
        <EmptyState
          icon={<IconKanban />}
          title="첫 과제를 추가하세요"
          description="관리 중인 기업의 과제를 등록하면 단계별 보드에서 진행 상황을 한눈에 관제할 수 있습니다."
          action={
            <Button variant="cta" onClick={() => setAdding(true)}>
              <IconPlus /> 과제 추가
            </Button>
          }
        />
      ) : (
        <>
          <div className="filter-bar">
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
                placeholder="과제 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="과제 검색"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="panel empty-w" style={{ padding: "56px 16px" }}>
              <IconSearch />
              <p>조건에 맞는 과제가 없습니다</p>
              {isFiltered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setCompanyFilter("all");
                    setCategoryFilter("all");
                    setDueFilter("all");
                  }}
                >
                  필터 초기화
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="board">
              {TASK_STAGE_ORDER.map((stage) => {
                const columnTasks = filtered.filter(
                  (t) => effectiveStage(t) === stage,
                );
                return (
                  <section
                    key={stage}
                    className={`kcol${overStage === stage ? " is-over" : ""}`}
                    aria-label={`${TASK_STAGE_LABEL[stage]} 컬럼`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (overStage !== stage) setOverStage(stage);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setOverStage((o) => (o === stage ? null : o));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(stage);
                    }}
                  >
                    <div className="kcol-head">
                      <span className={`kdot kdot--${stage}`} />
                      <h3>{TASK_STAGE_LABEL[stage]}</h3>
                      <span className="cnt num">{columnTasks.length}</span>
                    </div>
                    <div className="kcol-body">
                      {columnTasks.map((t) => (
                        <BoardCard
                          key={t.id}
                          task={t}
                          stage={effectiveStage(t)}
                          dragging={draggingId === t.id}
                          onDragStart={(e) => {
                            setDraggingId(t.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", t.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setOverStage(null);
                          }}
                          onOpen={() => setSelectedId(t.id)}
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
          task={{ ...selected, stage: effectiveStage(selected) }}
          demo={data.demo}
          showToast={showToast}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {adding ? (
        <AddTaskSlideOver
          companies={data.companies}
          categories={data.categories}
          demo={data.demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}

      <Toast message={toast} />
    </>
  );
}
