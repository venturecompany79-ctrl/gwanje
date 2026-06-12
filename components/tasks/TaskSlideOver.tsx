"use client";

// 과제 상세/추가 슬라이드오버 — 기업 상세 관리포인트 탭 / 보드 공용 (스펙 3·4절 동일 구조)
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { InputField } from "@/components/ui/Input";
import {
  IconAlert,
  IconBuilding,
  IconInfo,
  IconPlus,
  IconX,
} from "@/components/ui/icons";
import { TASK_STAGE_LABEL, TASK_STAGE_ORDER } from "@/lib/labels";
import { addTask, updateTask } from "@/lib/actions/tasks";
import type { TaskStage } from "@/lib/database.types";
import type { CategoryOption, TaskRow } from "@/lib/data/company-detail";
import { TaskDday } from "./Stepper";

/** 과제 상세 — 단계 변경 라디오 / 메모 / 산출물 링크 / [변경 저장] */
export function TaskSlideOver({
  companyId,
  companyName,
  task,
  demo,
  showToast,
  onClose,
}: {
  companyId: string;
  /** 보드처럼 여러 기업이 섞인 화면에서 헤더에 기업명 표시 */
  companyName?: string;
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
            {companyName ? (
              <div className="so-eyebrow">
                <IconBuilding /> {companyName}
              </div>
            ) : null}
            <h2>{task.title}</h2>
            <div className="so-submeta">
              <CategoryChip name={task.categoryName} />
              <TaskDday stage={task.stage} daysLeft={task.daysLeft} />
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

/** 과제 추가 — companies를 주면(보드) 기업 선택 셀렉트가 첫 필드로 노출 */
export function AddTaskSlideOver({
  companyId,
  companies,
  categories,
  demo,
  showToast,
  onClose,
}: {
  /** 기업 상세처럼 기업이 고정된 화면에서 사용 */
  companyId?: string;
  /** 보드처럼 기업을 선택해야 하는 화면에서 사용 */
  companies?: { id: string; name: string }[];
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
    const targetCompanyId =
      companyId ?? String(formData.get("company_id") ?? "");
    startTransition(async () => {
      const result = await addTask(targetCompanyId, formData);
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
            {companies ? (
              <div className="field">
                <label htmlFor="task-company">기업 *</label>
                <select
                  id="task-company"
                  name="company_id"
                  className="input"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    기업 선택
                  </option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <InputField
              label="과제명 *"
              name="title"
              required
              placeholder="벤처기업확인 갱신"
              autoFocus={!companies}
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
