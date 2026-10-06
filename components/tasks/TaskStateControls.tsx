"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskWorkStatus } from "@/lib/actions/tasks";
import type { TaskWorkStatus } from "@/lib/database.types";
import {
  TASK_WORK_STATUS_LABEL,
  TASK_WORK_STATUS_ORDER,
} from "@/lib/labels";
import type { ToastOptions } from "@/components/ui/Toast";
import { TaskWorkStatusBadge } from "./Stepper";

export interface TaskStateSnapshot {
  workStatus: TaskWorkStatus;
  updatedAt: string;
}

export function TaskStateControls({
  companyId,
  taskId,
  taskTitle,
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
  workStatus: TaskWorkStatus;
  updatedAt: string;
  canEdit?: boolean;
  compact?: boolean;
  showToast: (message: string, options?: ToastOptions) => void;
  onChange?: (snapshot: TaskStateSnapshot) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [workStatus, setWorkStatus] = useState(initialWorkStatus);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);

  useEffect(() => {
    setWorkStatus(initialWorkStatus);
    setUpdatedAt(initialUpdatedAt);
  }, [initialUpdatedAt, initialWorkStatus]);

  function publish(nextStatus: TaskWorkStatus, nextUpdatedAt: string) {
    setWorkStatus(nextStatus);
    setUpdatedAt(nextUpdatedAt);
    onChange?.({ workStatus: nextStatus, updatedAt: nextUpdatedAt });
  }

  function changeWorkStatus(nextStatus: TaskWorkStatus) {
    if (!canEdit || pending || nextStatus === workStatus) return;
    const previous = workStatus;
    const expected = updatedAt;
    setWorkStatus(nextStatus);
    onChange?.({ workStatus: nextStatus, updatedAt });

    startTransition(async () => {
      const result = await updateTaskWorkStatus(
        companyId,
        taskId,
        nextStatus,
        expected,
      );
      if (!result.ok || !result.updatedAt) {
        if (result.conflict && result.workStatus && result.updatedAt) {
          publish(result.workStatus, result.updatedAt);
        } else {
          setWorkStatus(previous);
          onChange?.({ workStatus: previous, updatedAt: expected });
        }
        showToast(result.error ?? "상태 변경에 실패했습니다.");
        if (result.conflict) router.refresh();
        return;
      }

      const appliedAt = result.updatedAt;
      publish(result.workStatus ?? nextStatus, appliedAt);
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
              if (undo.conflict && undo.workStatus && undo.updatedAt) {
                publish(undo.workStatus, undo.updatedAt);
              }
              showToast(undo.error ?? "되돌리기에 실패했습니다.");
              router.refresh();
              return;
            }
            publish(undo.workStatus ?? previous, undo.updatedAt);
            showToast("상태 변경을 되돌렸습니다.");
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
        <span className="sr-only">{taskTitle} 상태</span>
        <select
          className={`task-state-select task-state-select--${workStatus}`}
          value={workStatus}
          disabled={pending}
          aria-label={`${taskTitle} 상태`}
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
