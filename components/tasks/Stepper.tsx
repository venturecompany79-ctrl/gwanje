"use client";

// 과제 D-day·상태 배지 — 기업 상세 관리포인트 탭 / 보드 공용
import { Badge } from "@/components/ui/Badge";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { TASK_WORK_STATUS_LABEL } from "@/lib/labels";
import type { TaskWorkStatus } from "@/lib/database.types";

export function TaskDday({
  workStatus,
  daysLeft,
}: {
  workStatus: TaskWorkStatus;
  daysLeft: number | null;
}) {
  if (workStatus === "completed") {
    return <Badge tone="soft-valid">완료</Badge>;
  }
  if (daysLeft === null) return <span className="cell-muted">—</span>;
  return <DdayBadge daysLeft={daysLeft} />;
}

export function TaskWorkStatusBadge({ status }: { status: TaskWorkStatus }) {
  const tone =
    status === "completed"
      ? "success"
      : status === "waiting" || status === "on_hold"
        ? "attention"
        : status === "in_progress"
          ? "primary"
          : "neutral";
  return <Badge tone={tone}>{TASK_WORK_STATUS_LABEL[status]}</Badge>;
}
