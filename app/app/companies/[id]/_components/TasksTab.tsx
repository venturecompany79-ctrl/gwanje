"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { DdayBadge } from "@/components/ui/DdayBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/Input";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  IconAlert,
  IconInfo,
  IconPlus,
  IconTarget,
  IconX,
} from "@/components/ui/icons";
import { TASK_STAGE_LABEL, TASK_STAGE_ORDER } from "@/lib/labels";
import type { TaskStage } from "@/lib/database.types";
import type { CategoryOption, TaskRow } from "@/lib/data/company-detail";
import { addTask, updateTask } from "../actions";

function stageIndex(stage: TaskStage): number {
  return TASK_STAGE_ORDER.indexOf(stage);
}

function Stepper({ stage }: { stage: TaskStage }) {
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

function TaskDday({ task }: { task: TaskRow }) {
  if (task.stage === "result") return <Badge tone="soft-valid">완료</Badge>;
  if (task.daysLeft === null) return <span className="cell-muted">—</span>;
  return <DdayBadge daysLeft={task.daysLeft} />;
}

/** 과제 상세 슬라이드오버 — 단계 변경 / 메모 / 산출물 링크 */
function TaskSlideOver({
  companyId,
  task,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  task: TaskRow;
  demo: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateTask(companyId, task.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      showToast("저장되었습니다");
      router.refresh();
    });
  }

  return (
    <div className="slideover-root">
      <div className="slideover-backdrop" onClick={onClose} />
      <aside
        className="slideover"
        role="dialog"
        aria-modal="true"
        aria-label="과제 상세"
      >
        <div className="slideover-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{task.title}</h2>
            <div className="so-submeta">
              <CategoryChip name={task.categoryName} />
              <TaskDday task={task} />
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconX />
          </button>
        </div>
        <form className="slideover-form" onSubmit={handleSubmit}>
          <div className="slideover-body">
            {demo ? (
              <div className="auth-notice">
                <b>데모 모드</b> — 변경 내용은 저장되지 않습니다.
              </div>
            ) : null}
            {error ? (
              <div className="auth-error">
                <IconAlert /> {error}
              </div>
            ) : null}

            <div className="so-sec">
              <div className="so-label">단계 변경</div>
              <div className="stage-opts" role="radiogroup" aria-label="단계 변경">
                {TASK_STAGE_ORDER.map((s, i) => (
                  <label
                    key={s}
                    className={`stage-opt${stage === s ? " is-on" : ""}`}
                  >
                    <input
                      type="radio"
                      name="stage"
                      value={s}
                      checked={stage === s}
                      onChange={() => setStage(s)}
                    />
                    <span className="ring" />
                    {TASK_STAGE_LABEL[s]}
                    <span className="idx num">{i + 1}/4</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="so-sec">
              <div className="so-label">메모</div>
              <textarea
                name="memo"
                className="memo-input"
                defaultValue={task.memo ?? ""}
                placeholder="진행 상황, 준비 서류 등"
                aria-label="메모"
              />
            </div>

            <div className="so-sec">
              <div className="so-label">산출물 링크</div>
              <p className="form-hint">
                <IconInfo /> 산출물 링크는 Phase2(스키마 확장)와 함께
                제공됩니다.
              </p>
              <button type="button" className="pill-btn" disabled style={{ marginTop: 8 }}>
                <IconPlus /> 링크 추가
              </button>
            </div>
          </div>
          <div className="slideover-foot">
            <Button variant="cta" type="submit" full disabled={pending}>
              {pending ? "저장 중…" : "변경 저장"}
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              닫기
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function AddTaskSlideOver({
  companyId,
  categories,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  categories: CategoryOption[];
  demo: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addTask(companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      showToast("저장되었습니다");
      router.refresh();
    });
  }

  return (
    <div className="slideover-root">
      <div className="slideover-backdrop" onClick={onClose} />
      <aside className="slideover" role="dialog" aria-modal="true" aria-label="과제 추가">
        <div className="slideover-head">
          <h2>과제 추가</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconX />
          </button>
        </div>
        <form className="slideover-form" onSubmit={handleSubmit}>
          <div className="slideover-body">
            {demo ? (
              <div className="auth-notice">
                <b>데모 모드</b> — 입력 내용은 저장되지 않습니다.
              </div>
            ) : null}
            {error ? (
              <div className="auth-error">
                <IconAlert /> {error}
              </div>
            ) : null}
            <InputField
              label="과제명 *"
              name="title"
              required
              placeholder="벤처기업확인 갱신"
              autoFocus
            />
            <div className="form-grid2">
              <div className="field">
                <label htmlFor="task-category">분류</label>
                <select id="task-category" name="category_id" className="input" defaultValue="">
                  <option value="">선택 안 함</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-stage">단계</label>
                <select id="task-stage" name="stage" className="input" defaultValue="diagnosis">
                  {TASK_STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <InputField label="마감일" name="due_date" type="date" />
            <div className="field">
              <label htmlFor="task-memo">메모</label>
              <textarea
                id="task-memo"
                name="memo"
                className="memo-input"
                placeholder="진행 상황, 준비 서류 등"
              />
            </div>
          </div>
          <div className="slideover-foot">
            <Button variant="cta" type="submit" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              닫기
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export function TasksTab({
  companyId,
  tasks,
  categories,
  demo,
  showToast,
}: {
  companyId: string;
  tasks: TaskRow[];
  categories: CategoryOption[];
  demo: boolean;
  showToast: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <Panel>
        <PanelHead
          title="관리포인트"
          count={tasks.length > 0 ? `${tasks.length}건` : undefined}
        >
          <Button variant="cta" size="sm" onClick={() => setAdding(true)}>
            <IconPlus /> 과제 추가
          </Button>
        </PanelHead>

        {tasks.length === 0 ? (
          <EmptyState
            bare
            icon={<IconTarget />}
            title="등록된 과제가 없습니다"
            description="인증 갱신, 정부지원 과제 신청 같은 관리포인트를 등록하면 단계와 마감이 한눈에 추적됩니다."
            action={
              <Button variant="cta" onClick={() => setAdding(true)}>
                <IconPlus /> 과제 추가
              </Button>
            }
          />
        ) : (
          <div className="tasks">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`task${selectedId === t.id ? " is-selected" : ""}`}
                onClick={() => setSelectedId(t.id)}
              >
                <div>
                  <div className="tname">{t.title}</div>
                  <div className="tmeta">
                    <CategoryChip name={t.categoryName} />
                    <Stepper stage={t.stage} />
                  </div>
                </div>
                <div className="spacer" />
                <TaskDday task={t} />
                {t.assigneeName ? (
                  <span className="owner">
                    <span className="avatar">{t.assigneeName.slice(0, 1)}</span>
                    {t.assigneeName}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {selected ? (
        <TaskSlideOver
          key={selected.id}
          companyId={companyId}
          task={selected}
          demo={demo}
          showToast={showToast}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {adding ? (
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
