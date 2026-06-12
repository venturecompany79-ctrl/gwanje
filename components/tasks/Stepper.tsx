"use client";

// 과제 4단계 스테퍼 + D-day 표시 — 기업 상세 관리포인트 탭 / 보드 공용
import { Badge } from "@/components/ui/Badge";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { TASK_STAGE_LABEL, TASK_STAGE_ORDER } from "@/lib/labels";
import type { TaskStage } from "@/lib/database.types";

export function stageIndex(stage: TaskStage): number {
  return TASK_STAGE_ORDER.indexOf(stage);
}

export function Stepper({ stage }: { stage: TaskStage }) {
  const current = stageIndex(stage);
  const done = stage === "result";
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div className="stepper" aria-hidden="true">
        {TASK_STAGE_ORDER.map((s, i) => (
          <div key={s} className="seg">
            <div
              className={`dot${
                i < current || (done && i === current)
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
      <span className={`stage-cap${done ? " is-done" : ""}`}>
        {done ? "결과 · 완료" : TASK_STAGE_LABEL[stage]}
      </span>
    </div>
  );
}

export function TaskDday({
  stage,
  daysLeft,
}: {
  stage: TaskStage;
  daysLeft: number | null;
}) {
  if (stage === "result") return <Badge tone="soft-valid">완료</Badge>;
  if (daysLeft === null) return <span className="cell-muted">—</span>;
  return <DdayBadge daysLeft={daysLeft} />;
}
