"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTaskStage,
  updateTaskWorkStatus,
} from "@/lib/actions/tasks";
import type { TaskStage, TaskWorkStatus } from "@/lib/database.types";
import {
  TASK_STAGE_LABEL,
  TASK_STAGE_ORDER,
  TASK_WORK_STATUS_LABEL,
  TASK_WORK_STATUS_ORDER,
} from "@/lib/labels";
import type { ToastOptions } from "@/components/ui/Toast";
import { TaskWorkStatusBadge } from "./Stepper";

export interface TaskStateSnapshot {
  stage: TaskStage;
  workStatus: TaskWorkStatus;
  updatedAt: string;
}

export function TaskStateControls({
  companyId,
  taskId,
  taskTitle,
  stage: initialStage,
  workStatus: initialWorkStatus,
  updatedAt: initialUpdatedAt,
  canEdit = true,
  compact = false,
  showToast,
  onChange,
}: {
  companyId: string;
  taskId: string;
  taskTitle: string;
  stage: TaskStage;
  workStatus: TaskWorkStatus;
  updatedAt: string;
  canEdit?: boolean;
  compact?: boolean;
  showToast: (message: string, options?: ToastOptions) => void;
  onChange?: (snapshot: TaskStateSnapshot) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState(initialStage);
  const [workStatus, setWorkStatus] = useState(initialWorkStatus);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);

  useEffect(() => {
    setStage(initialStage);
    setWorkStatus(initialWorkStatus);
    setUpdatedAt(initialUpdatedAt);
  }, [initialStage, initialUpdatedAt, initialWorkStatus]);

  function publish(
    nextStage: TaskStage,
    nextStatus: TaskWorkStatus,
    nextUpdatedAt: string,
  ) {
    setStage(nextStage);
    setWorkStatus(nextStatus);
    setUpdatedAt(nextUpdatedAt);
    onChange?.({
      stage: nextStage,
      workStatus: nextStatus,
      updatedAt: nextUpdatedAt,
    });
  }

  function changeStage(nextStage: TaskStage) {
    if (!canEdit || pending || nextStage === stage) return;
    const previous = stage;
    const expected = updatedAt;
    setStage(nextStage);
    onChange?.({ stage: nextStage, workStatus, updatedAt });

    startTransition(async () => {
      const result = await updateTaskStage(
        companyId,
        taskId,
        nextStage,
        expected,
      );
      if (!result.ok || !result.updatedAt) {
        if (
          result.conflict &&
          result.stage &&
          result.workStatus &&
          result.updatedAt
        ) {
          publish(result.stage, result.workStatus, result.updatedAt);
        } else {
          setStage(previous);
          onChange?.({ stage: previous, workStatus, updatedAt: expected });
        }
        showToast(result.error ?? "단계 변경에 실패했습니다.");
        if (result.conflict) router.refresh();
        return;
      }

      const appliedAt = result.updatedAt;
      publish(result.stage ?? nextStage, result.workStatus ?? workStatus, appliedAt);
      showToast(`‘${taskTitle}’ 단계를 ${TASK_STAGE_LABEL[nextStage]}(으)로 변경했습니다.`, {
        actionLabel: "되돌리기",
        durationMs: 5000,
        onAction: async () => {
          const undo = await updateTaskStage(
            companyId,
            taskId,
            previous,
            appliedAt,
          );
          if (!undo.ok || !undo.updatedAt) {
            if (
              undo.conflict &&
              undo.stage &&
              undo.workStatus &&
              undo.updatedAt
            ) {
              publish(undo.stage, undo.workStatus, undo.updatedAt);
            }
            showToast(undo.error ?? "되돌리기에 실패했습니다.");
            router.refresh();
            return;
          }
          publish(
            undo.stage ?? previous,
            undo.workStatus ?? workStatus,
            undo.updatedAt,
          );
          showToast("단계 변경을 되돌렸습니다.");
          router.refresh();
        },
      });
      router.refresh();
    });
  }

  function changeWorkStatus(nextStatus: TaskWorkStatus) {
    if (!canEdit || pending || nextStatus === workStatus) return;
    const previous = workStatus;
    const expected = updatedAt;
    setWorkStatus(nextStatus);
    onChange?.({ stage, workStatus: nextStatus, updatedAt });

    startTransition(async () => {
      const result = await updateTaskWorkStatus(
        companyId,
        taskId,
        nextStatus,
        expected,
      );
      if (!result.ok || !result.updatedAt) {
        if (
          result.conflict &&
          result.stage &&
          result.workStatus &&
          result.updatedAt
        ) {
          publish(result.stage, result.workStatus, result.updatedAt);
        } else {
          setWorkStatus(previous);
          onChange?.({ stage, workStatus: previous, updatedAt: expected });
        }
        showToast(result.error ?? "업무상태 변경에 실패했습니다.");
        if (result.conflict) router.refresh();
        return;
      }

      const appliedAt = result.updatedAt;
      publish(result.stage ?? stage, result.workStatus ?? nextStatus, appliedAt);
      showToast(
        `‘${taskTitle}’ 상태를 ${TASK_WORK_STATUS_LABEL[nextStatus]}(으)로 변경했습니다.`,
        {
          actionLabel: "되돌리기",
          durationMs: 5000,
          onAction: async () => {
            const undo = await updateTaskWorkStatus(
              companyId,
              taskId,
              previous,
              appliedAt,
            );
            if (!undo.ok || !undo.updatedAt) {
              if (
                undo.conflict &&
                undo.stage &&
                undo.workStatus &&
                undo.updatedAt
              ) {
                publish(undo.stage, undo.workStatus, undo.updatedAt);
              }
              showToast(undo.error ?? "되돌리기에 실패했습니다.");
              router.refresh();
              return;
            }
            publish(
              undo.stage ?? stage,
              undo.workStatus ?? previous,
              undo.updatedAt,
            );
            showToast("업무상태 변경을 되돌렸습니다.");
            router.refresh();
          },
        },
      );
      router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <div className="task-state-controls is-readonly">
        <span className="task-stage-pill">{TASK_STAGE_LABEL[stage]}</span>
        <TaskWorkStatusBadge status={workStatus} />
      </div>
    );
  }

  return (
    <div
      className={`task-state-controls${compact ? " is-compact" : ""}`}
      aria-busy={pending}
    >
      <label>
        <span className="sr-only">{taskTitle} 진행단계</span>
        <select
          className="task-state-select task-state-select--stage"
          value={stage}
          disabled={pending}
          aria-label={`${taskTitle} 진행단계`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            changeStage(event.target.value as TaskStage);
          }}
        >
          {TASK_STAGE_ORDER.map((value) => (
            <option key={value} value={value}>
              {TASK_STAGE_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">{taskTitle} 업무상태</span>
        <select
          className={`task-state-select task-state-select--${workStatus}`}
          value={workStatus}
          disabled={pending}
          aria-label={`${taskTitle} 업무상태`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            changeWorkStatus(event.target.value as TaskWorkStatus);
          }}
        >
          {TASK_WORK_STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {TASK_WORK_STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
