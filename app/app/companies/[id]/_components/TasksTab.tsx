"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ToastOptions } from "@/components/ui/Toast";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { IconPlus, IconTarget } from "@/components/ui/icons";
import { Stepper, TaskDday } from "@/components/tasks/Stepper";
import {
  TaskStateControls,
  type TaskStateSnapshot,
} from "@/components/tasks/TaskStateControls";
import {
  AddTaskSlideOver,
  TaskSlideOver,
} from "@/components/tasks/TaskSlideOver";
import type { CategoryOption, TaskRow } from "@/lib/data/company-detail";
import type { CompanyStatus } from "@/lib/labels";

export function TasksTab({
  companyId,
  companyName,
  tasks,
  categories,
  demo,
  canWriteTasks,
  companyStatus,
  showToast,
}: {
  companyId: string;
  companyName: string;
  tasks: TaskRow[];
  categories: CategoryOption[];
  demo: boolean;
  canWriteTasks: boolean;
  companyStatus: CompanyStatus;
  showToast: (message: string, options?: ToastOptions) => void;
}) {
  const editable = canWriteTasks && companyStatus !== "ended";
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusView, setStatusView] = useState<"active" | "completed" | "all">(
    "active",
  );
  const [stateById, setStateById] = useState<Record<string, TaskStateSnapshot>>(
    () =>
      Object.fromEntries(
        tasks.map((task) => [
          task.id,
          {
            stage: task.stage,
            workStatus: task.workStatus,
            updatedAt: task.updatedAt,
          },
        ]),
      ),
  );
  const taskWithState = (task: TaskRow): TaskRow => {
    const state = stateById[task.id];
    return state
      ? {
          ...task,
          stage: state.stage,
          workStatus: state.workStatus,
          updatedAt: state.updatedAt,
        }
      : task;
  };
  const currentTasks = tasks.map(taskWithState);
  const activeCount = currentTasks.filter(
    (task) => task.workStatus !== "completed",
  ).length;
  const completedCount = currentTasks.length - activeCount;
  const visibleTasks = currentTasks.filter((task) => {
    if (statusView === "all") return true;
    return statusView === "completed"
      ? task.workStatus === "completed"
      : task.workStatus !== "completed";
  });
  const selected =
    currentTasks.find((task) => task.id === selectedId) ?? null;

  return (
    <>
      <Panel>
        <PanelHead
          title="Task"
          count={tasks.length > 0 ? `${tasks.length}건` : undefined}
        >
          {editable ? (
            <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
              <IconPlus /> Task 추가
            </Button>
          ) : null}
        </PanelHead>

        {tasks.length === 0 ? (
          <EmptyState
            bare
            icon={<IconTarget />}
            title="등록된 Task가 없습니다"
            description="인증 갱신, 정부지원사업 신청 같은 Task를 등록하면 단계와 마감이 한눈에 추적됩니다."
            action={
              editable ? (
              <Button variant="cta" onClick={() => setAdding(true)}>
                <IconPlus /> Task 추가
              </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="task-view-tabs" role="group" aria-label="Task 상태 보기">
              <button
                type="button"
                className={`pill-tab${statusView === "active" ? " is-active" : ""}`}
                onClick={() => setStatusView("active")}
              >
                진행 {activeCount}
              </button>
              <button
                type="button"
                className={`pill-tab${statusView === "completed" ? " is-active" : ""}`}
                onClick={() => setStatusView("completed")}
              >
                완료 {completedCount}
              </button>
              <button
                type="button"
                className={`pill-tab${statusView === "all" ? " is-active" : ""}`}
                onClick={() => setStatusView("all")}
              >
                전체 {currentTasks.length}
              </button>
            </div>
            <div className="tasks">
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className={`task${selectedId === task.id ? " is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="task-main"
                    onClick={() => setSelectedId(task.id)}
                    aria-label={`${task.title} 상세 열기`}
                  >
                    <div className="tname">{task.title}</div>
                    <div className="tmeta">
                      <CategoryChip name={task.categoryName} />
                      <Stepper stage={task.stage} />
                    </div>
                  </button>
                  <div className="spacer" />
                  <TaskDday
                    workStatus={task.workStatus}
                    daysLeft={task.daysLeft}
                  />
                  {task.assigneeName ? (
                    <span className="owner">
                      <span className="avatar">{task.assigneeName.slice(0, 1)}</span>
                      {task.assigneeName}
                    </span>
                  ) : (
                    <span className="task-unassigned">미배정</span>
                  )}
                  <TaskStateControls
                    companyId={companyId}
                    taskId={task.id}
                    taskTitle={task.title}
                    stage={task.stage}
                    workStatus={task.workStatus}
                    updatedAt={task.updatedAt}
                    canEdit={editable}
                    compact
                    showToast={showToast}
                    onChange={(snapshot) =>
                      setStateById((current) => ({
                        ...current,
                        [task.id]: snapshot,
                      }))
                    }
                  />
                </div>
              ))}
              {visibleTasks.length === 0 ? (
                <div className="task-filter-empty">
                  {statusView === "completed"
                    ? "완료된 Task가 없습니다."
                    : "진행 중인 Task가 없습니다."}
                </div>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      {selected ? (
        <TaskSlideOver
          key={selected.id}
          companyId={companyId}
          companyName={companyName}
          task={selected}
          categories={categories}
          demo={demo}
          canEdit={editable}
          showToast={showToast}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {adding && editable ? (
        <AddTaskSlideOver
          companyId={companyId}
          categories={categories}
          demo={demo}
          showToast={showToast}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
