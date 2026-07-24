"use client";

// 과제 4단계 스테퍼 + D-day 표시 — 기업 상세 관리포인트 탭 / 보드 공용
import { Badge } from "@/components/ui/Badge";
import { DdayBadge } from "@/components/ui/DdayBadge";
import {
  TASK_STAGE_LABEL,
  TASK_STAGE_ORDER,
  TASK_WORK_STATUS_LABEL,
} from "@/lib/labels";
import type { TaskStage, TaskWorkStatus } from "@/lib/database.types";

export function stageIndex(stage: TaskStage): number {
  return TASK_STAGE_ORDER.indexOf(stage);
}

export function Stepper({ stage }: { stage: TaskStage }) {
  const current = stageIndex(stage);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div className="stepper" aria-hidden="true">
        {TASK_STAGE_ORDER.map((s, i) => (
          <div key={s} className="seg">
            <div
              className={`dot${
                i < current
                  ? " is-done"
                  : i === current
                    ? " is-current"
                    : ""
              }`}
            />
            {i < TASK_STAGE_ORDER.length - 1 ? (
              <div className={`bar${i < current ? " is-done" : ""}`} />
            ) : null}
          </div>
        ))}
      </div>
      <span className="stage-cap">{TASK_STAGE_LABEL[stage]}</span>
    </div>
  );
}

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

export function TaskWorkStatusBadge({
  status,
}: {
  status: TaskWorkStatus;
}) {
  const tone =
    status === "completed"
      ? "success"
      : status === "on_hold"
        ? "critical"
        : status === "waiting"
          ? "attention"
          : status === "in_progress"
            ? "primary"
            : "neutral";
  return <Badge tone={tone}>{TASK_WORK_STATUS_LABEL[status]}</Badge>;
}
