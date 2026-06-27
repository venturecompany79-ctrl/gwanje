"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCategory } from "@/lib/actions/settings";
import type { CategoryOption } from "@/lib/data/company-detail";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

/**
 * 분류(category) 셀렉트 + 인라인 "새 분류 추가".
 * 폼 안에서 name으로 category_id를 제출한다. 설정 화면을 거치지 않고
 * 즉석에서 분류를 만들어 바로 선택할 수 있다(자격·과제 등 공용).
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
  const fieldId = `cat-select-${name}`;
  const [options, setOptions] = useState<CategoryOption[]>(categories);
  const [value, setValue] = useState(defaultValue ?? "");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitNewCategory() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("분류 이름을 입력해 주세요.");
      return;
    }
    const duplicate = options.find((c) => c.name === trimmed);
    if (duplicate) {
      setValue(duplicate.id);
      setAdding(false);
      setNewName("");
      setError(null);
      return;
    }

    // 데모 모드는 저장되지 않으므로 로컬에만 추가해 미리보기
    if (demo) {
      const localId = crypto.randomUUID();
      setOptions((prev) => [...prev, { id: localId, name: trimmed }]);
      setValue(localId);
      setAdding(false);
      setNewName("");
      setError(null);
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
      setAdding(false);
      setNewName("");
      setError(null);
      // 다른 화면(보드 필터·칩)과 동기화
      router.refresh();
    });
  }

  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {/* 폼 제출용 — 선택값을 hidden으로 전달 */}
      <input type="hidden" name={name} value={value} />
      {adding ? (
        <div className="cat-add-row">
          <input
            type="text"
            className="input"
            value={newName}
            autoFocus
            placeholder="예: 정부지원사업"
            onChange={(e) => {
              setNewName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewCategory();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
                setNewName("");
                setError(null);
              }
            }}
            aria-label="새 분류 이름"
          />
          <Button
            type="button"
            size="sm"
            variant="cta"
            onClick={submitNewCategory}
            disabled={pending}
          >
            {pending ? "추가 중…" : "추가"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError(null);
            }}
            disabled={pending}
          >
            취소
          </Button>
        </div>
      ) : (
        <div className="cat-select-row">
          <select
            id={fieldId}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">선택 안 함</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAdding(true)}
          >
            <IconPlus /> 새 분류
          </Button>
        </div>
      )}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
