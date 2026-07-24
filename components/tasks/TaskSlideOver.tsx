"use client";

// 과제 상세/추가 슬라이드오버 — 기업 상세 관리포인트 탭 / 보드 공용 (스펙 3·4절 동일 구조)
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import type { ToastOptions } from "@/components/ui/Toast";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { InputField } from "@/components/ui/Input";
import { SlideOver } from "@/components/ui/SlideOver";
import {
  IconAlert,
  IconBuilding,
  IconFile,
  IconInfo,
  IconPlus,
  IconX,
} from "@/components/ui/icons";
import {
  TASK_STAGE_LABEL,
  TASK_STAGE_ORDER,
  TASK_WORK_STATUS_LABEL,
  TASK_WORK_STATUS_ORDER,
} from "@/lib/labels";
import { addTask, updateTask } from "@/lib/actions/tasks";
import type { CategoryOption, TaskRow } from "@/lib/data/company-detail";
import { TaskDday } from "./Stepper";
import {
  TaskStateControls,
  type TaskStateSnapshot,
} from "./TaskStateControls";

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${size}B`;
}

function makeSelectedFileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface SelectedTaskFile {
  id: string;
  file: File;
}

/** 과제 상세 — 단계 변경 라디오 / 메모 / 산출물 링크 / [변경 저장] */
export function TaskSlideOver({
  companyId,
  companyName,
  task,
  categories,
  demo,
  canEdit = true,
  showToast,
  onClose,
}: {
  companyId: string;
  /** 보드처럼 여러 기업이 섞인 화면에서 헤더에 기업명 표시 */
  companyName?: string;
  task: TaskRow;
  categories: CategoryOption[];
  demo: boolean;
  canEdit?: boolean;
  showToast: (message: string, options?: ToastOptions) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [stateSnapshot, setStateSnapshot] = useState<TaskStateSnapshot>({
    stage: task.stage,
    workStatus: task.workStatus,
    updatedAt: task.updatedAt,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedTaskFile[]>([]);
  const [pending, startTransition] = useTransition();
  const editable = canEdit && isEditing;
  const detailFormId = `task-detail-form-${task.id}`;
  const detailFilesId = `${detailFormId}-files`;

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [
        ...prev,
        ...files.map((file) => ({ id: makeSelectedFileId(), file })),
      ]);
    }
    e.currentTarget.value = "";
  }

  function removeFile(id: string) {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable) return;
    const formData = new FormData(e.currentTarget);
    formData.delete("task_files");
    selectedFiles.forEach(({ file }) => formData.append("task_files", file));
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
    <SlideOver ariaLabel="Task 상세" onClose={onClose}>
        <div className="slideover-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{task.title}</h2>
            <div className="so-submeta">
              {companyName ? (
                <span className="so-eyebrow">
                  <IconBuilding /> {companyName}
                </span>
              ) : null}
              <CategoryChip name={task.categoryName} />
              <TaskDday
                workStatus={stateSnapshot.workStatus}
                daysLeft={task.daysLeft}
              />
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconX />
          </button>
        </div>
        <form id={detailFormId} className="slideover-form" onSubmit={handleSubmit}>
          <div className="slideover-body">
            {demo ? (
              <div className="auth-notice">
                <b>데모 모드</b> — 변경 내용은 저장되지 않습니다.
              </div>
            ) : null}
            {!canEdit ? (
              <div className="auth-notice">
                보기 권한만 있어 Task를 수정할 수 없습니다.
              </div>
            ) : !isEditing ? (
              <div className="auth-notice">
                수정하려면 하단의 수정하기 버튼을 눌러 주세요.
              </div>
            ) : null}
            {error ? (
              <div className="auth-error">
                <IconAlert /> {error}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="task-detail-company">기업</label>
              <input
                id="task-detail-company"
                className="input"
                value={companyName ?? "선택된 기업"}
                disabled
                readOnly
              />
            </div>
            <InputField
              label="Task명 *"
              name="title"
              required
              defaultValue={task.title}
              placeholder="벤처기업확인 갱신"
              disabled={!editable}
            />
            <div className="field">
              <label>진행단계 · 업무상태</label>
              <TaskStateControls
                companyId={companyId}
                taskId={task.id}
                taskTitle={task.title}
                stage={stateSnapshot.stage}
                workStatus={stateSnapshot.workStatus}
                updatedAt={stateSnapshot.updatedAt}
                canEdit={canEdit}
                showToast={showToast}
                onChange={setStateSnapshot}
              />
              <p className="form-hint">
                단계와 상태는 상세 수정 모드와 관계없이 바로 변경됩니다.
              </p>
            </div>
            <CategorySelect
              name="category_id"
              categories={categories}
              defaultValue={task.categoryId}
              demo={demo}
              disabled={!editable}
            />
            <InputField
              label="마감일"
              name="due_date"
              type="date"
              defaultValue={task.dueDate ?? ""}
              disabled={!editable}
            />
            <div className="field">
              <label htmlFor="task-detail-memo">메모</label>
              <textarea
                id="task-detail-memo"
                name="memo"
                className="memo-input"
                defaultValue={task.memo ?? ""}
                placeholder="진행 상황, 준비 서류 등"
                disabled={!editable}
              />
            </div>
            <div className="field">
              <label htmlFor={detailFilesId}>파일</label>
              <label
                className={[
                  "task-file-upload",
                  !editable ? "is-disabled" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                htmlFor={detailFilesId}
              >
                <input
                  id={detailFilesId}
                  name="task_files"
                  type="file"
                  multiple
                  disabled={!editable}
                  onChange={handleFiles}
                />
                <span className="task-file-upload__icon">
                  <IconPlus />
                </span>
                <span>파일 추가하기</span>
              </label>
              {selectedFiles.length > 0 ? (
                <div className="task-file-list" aria-label="첨부 파일 목록">
                  {selectedFiles.map(({ id, file }) => (
                    <div key={id} className="task-file-item">
                      <IconFile />
                      <span className="task-file-name">{file.name}</span>
                      <span className="task-file-size">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        className="task-file-remove"
                        onClick={() => removeFile(id)}
                        disabled={!editable}
                        aria-label={`${file.name} 삭제`}
                      >
                        <IconX />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="form-hint">
                <IconInfo /> 수정하기를 누른 뒤 파일을 선택하고 변경 저장을
                누르면 Task에 첨부됩니다.
              </p>
            </div>
          </div>
        </form>
        {canEdit ? (
          <div className="slideover-foot">
            {isEditing ? (
              <Button
                variant="cta"
                type="submit"
                form={detailFormId}
                full
                disabled={pending}
              >
                {pending ? "저장 중…" : "변경 저장"}
              </Button>
            ) : (
              <button
                type="button"
                className="btn btn--cta btn--full"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setError(null);
                  setIsEditing(true);
                }}
              >
                수정하기
              </button>
            )}
          </div>
        ) : null}
    </SlideOver>
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
  showToast: (message: string, options?: ToastOptions) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedTaskFile[]>([]);
  const [pending, startTransition] = useTransition();

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [
        ...prev,
        ...files.map((file) => ({ id: makeSelectedFileId(), file })),
      ]);
    }
    e.currentTarget.value = "";
  }

  function removeFile(id: string) {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.delete("task_files");
    selectedFiles.forEach(({ file }) => formData.append("task_files", file));
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
    <SlideOver ariaLabel="Task 추가" onClose={onClose}>
        <div className="slideover-head">
          <h2>Task 추가</h2>
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
              label="Task명 *"
              name="title"
              required
              placeholder="벤처기업확인 갱신"
              autoFocus={!companies}
            />
            <div className="form-grid2">
              <CategorySelect name="category_id" categories={categories} demo={demo} />
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
            <div className="field">
              <label htmlFor="task-work-status">업무상태</label>
              <select
                id="task-work-status"
                name="work_status"
                className="input"
                defaultValue="planned"
              >
                {TASK_WORK_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {TASK_WORK_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
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
            <div className="field">
              <label htmlFor="task-files">파일</label>
              <label className="task-file-upload" htmlFor="task-files">
                <input
                  id="task-files"
                  name="task_files"
                  type="file"
                  multiple
                  onChange={handleFiles}
                />
                <span className="task-file-upload__icon">
                  <IconPlus />
                </span>
                <span>파일 추가하기</span>
              </label>
              {selectedFiles.length > 0 ? (
                <div className="task-file-list" aria-label="첨부 파일 목록">
                  {selectedFiles.map(({ id, file }) => (
                    <div
                      key={id}
                      className="task-file-item"
                    >
                      <IconFile />
                      <span className="task-file-name">{file.name}</span>
                      <span className="task-file-size">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        className="task-file-remove"
                        onClick={() => removeFile(id)}
                        aria-label={`${file.name} 삭제`}
                      >
                        <IconX />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
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
    </SlideOver>
  );
}
