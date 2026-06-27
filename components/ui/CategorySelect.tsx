"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addCategory,
  deleteCategory,
  renameCategory,
} from "@/lib/actions/settings";
import type { CategoryOption } from "@/lib/data/company-detail";
import { Button } from "@/components/ui/Button";
import {
  IconArrow,
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/ui/icons";

/**
 * 분류(category) 드롭다운 — 선택 + 인라인 생성·수정·삭제.
 * 폼 안에서 name으로 category_id를 hidden input으로 제출한다.
 * 분류는 tenant RLS로 계정별 격리(다른 계정엔 안 보임). 자격·과제 공용.
 */
export function CategorySelect({
  name,
  categories,
  defaultValue,
  label = "분류",
  demo = false,
}: {
  name: string;
  categories: CategoryOption[];
  defaultValue?: string | null;
  label?: string;
  demo?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<CategoryOption[]>(categories);
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedName = options.find((c) => c.id === value)?.name ?? "선택 안 함";

  function resetTransient() {
    setCreating(false);
    setDraftName("");
    setEditingId(null);
    setEditName("");
    setConfirmDeleteId(null);
    setError(null);
  }

  function closeMenu() {
    setOpen(false);
    resetTransient();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        // state setter는 안정적이라 의존성 불필요 — closeMenu를 인라인으로 호출
        setOpen(false);
        setCreating(false);
        setDraftName("");
        setEditingId(null);
        setEditName("");
        setConfirmDeleteId(null);
        setError(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function selectOption(id: string) {
    setValue(id);
    closeMenu();
  }

  function submitCreate() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("분류 이름을 입력해 주세요.");
      return;
    }
    const dup = options.find((c) => c.name === trimmed);
    if (dup) {
      setValue(dup.id);
      closeMenu();
      return;
    }
    if (demo) {
      const localId = crypto.randomUUID();
      setOptions((prev) => [...prev, { id: localId, name: trimmed }]);
      setValue(localId);
      closeMenu();
      return;
    }
    startTransition(async () => {
      const result = await addCategory(trimmed);
      if (!result.ok || !result.categoryId) {
        setError(result.error ?? "분류 추가에 실패했습니다.");
        return;
      }
      setOptions((prev) => [...prev, { id: result.categoryId!, name: trimmed }]);
      setValue(result.categoryId);
      closeMenu();
      router.refresh();
    });
  }

  function submitRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      setError("분류 이름을 입력해 주세요.");
      return;
    }
    if (options.some((c) => c.id !== id && c.name === trimmed)) {
      setError("같은 이름의 분류가 이미 있습니다.");
      return;
    }
    const apply = () => {
      setOptions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      );
      setEditingId(null);
      setEditName("");
      setError(null);
    };
    if (demo) {
      apply();
      return;
    }
    startTransition(async () => {
      const result = await renameCategory(id, trimmed);
      if (!result.ok) {
        setError(result.error ?? "분류 수정에 실패했습니다.");
        return;
      }
      apply();
      router.refresh();
    });
  }

  function submitDelete(id: string) {
    const apply = () => {
      setOptions((prev) => prev.filter((c) => c.id !== id));
      if (value === id) setValue("");
      setConfirmDeleteId(null);
      setError(null);
    };
    if (demo) {
      apply();
      return;
    }
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (!result.ok) {
        setError(result.error ?? "분류 삭제에 실패했습니다.");
        return;
      }
      apply();
      router.refresh();
    });
  }

  return (
    <div className="field" ref={rootRef}>
      <label>{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="cat-dd">
        <button
          type="button"
          className="cat-dd-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? closeMenu() : setOpen(true))}
        >
          <span className={value ? undefined : "cat-dd-muted"}>
            {selectedName}
          </span>
          <IconArrow className={`cat-dd-caret${open ? " is-open" : ""}`} />
        </button>

        {open ? (
          <div className="cat-dd-menu" role="listbox">
            <button
              type="button"
              className={`cat-dd-opt${value === "" ? " is-sel" : ""}`}
              onClick={() => selectOption("")}
            >
              선택 안 함
            </button>

            {options.map((opt) =>
              editingId === opt.id ? (
                <div className="cat-dd-edit" key={opt.id}>
                  <input
                    type="text"
                    className="input"
                    value={editName}
                    autoFocus
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitRename(opt.id);
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                        setError(null);
                      }
                    }}
                    aria-label="분류 이름 수정"
                  />
                  <button
                    type="button"
                    className="cat-dd-icon"
                    onClick={() => submitRename(opt.id)}
                    disabled={pending}
                    aria-label="저장"
                  >
                    <IconCheck />
                  </button>
                  <button
                    type="button"
                    className="cat-dd-icon"
                    onClick={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                    disabled={pending}
                    aria-label="취소"
                  >
                    <IconX />
                  </button>
                </div>
              ) : confirmDeleteId === opt.id ? (
                <div className="cat-dd-confirm" key={opt.id}>
                  <span>‘{opt.name}’ 삭제?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => submitDelete(opt.id)}
                    disabled={pending}
                  >
                    삭제
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={pending}
                  >
                    취소
                  </Button>
                </div>
              ) : (
                <div
                  className={`cat-dd-opt-row${value === opt.id ? " is-sel" : ""}`}
                  key={opt.id}
                >
                  <button
                    type="button"
                    className="cat-dd-opt"
                    onClick={() => selectOption(opt.id)}
                  >
                    {opt.name}
                  </button>
                  <button
                    type="button"
                    className="cat-dd-icon"
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setError(null);
                      setEditingId(opt.id);
                      setEditName(opt.name);
                    }}
                    aria-label={`${opt.name} 수정`}
                  >
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="cat-dd-icon cat-dd-icon--danger"
                    onClick={() => {
                      setEditingId(null);
                      setError(null);
                      setConfirmDeleteId(opt.id);
                    }}
                    aria-label={`${opt.name} 삭제`}
                  >
                    <IconTrash />
                  </button>
                </div>
              ),
            )}

            <div className="cat-dd-sep" />

            {creating ? (
              <div className="cat-dd-edit">
                <input
                  type="text"
                  className="input"
                  value={draftName}
                  autoFocus
                  placeholder="새 분류 이름"
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCreate();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setCreating(false);
                      setDraftName("");
                      setError(null);
                    }
                  }}
                  aria-label="새 분류 이름"
                />
                <button
                  type="button"
                  className="cat-dd-icon"
                  onClick={submitCreate}
                  disabled={pending}
                  aria-label="추가"
                >
                  <IconCheck />
                </button>
                <button
                  type="button"
                  className="cat-dd-icon"
                  onClick={() => {
                    setCreating(false);
                    setDraftName("");
                    setError(null);
                  }}
                  disabled={pending}
                  aria-label="취소"
                >
                  <IconX />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="cat-dd-add"
                onClick={() => {
                  resetTransient();
                  setCreating(true);
                }}
              >
                <IconPlus /> 새 분류
              </button>
            )}

            {error ? <p className="cat-dd-error">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
