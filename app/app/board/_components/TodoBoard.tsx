"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  IconCalendar,
  IconCheck,
  IconList,
  IconTag,
  IconX,
} from "@/components/ui/icons";
import {
  createTodoNotes,
  deleteTodoNote,
  updateTodoNote,
} from "@/lib/actions/todos";
import { formatDotDateString } from "@/lib/datetime";
import {
  TODO_TAGS,
  type TodoBoardData,
  type TodoNoteRow,
  type TodoTag,
} from "@/lib/todos";

interface TodoDraft {
  id: string;
  content: string;
  tag: TodoTag | null;
}

type TagMenuTarget =
  | { kind: "note"; id: string }
  | { kind: "draft"; id: string };

const TODO_TAG_TONE: Record<TodoTag, string> = {
  업무: "work",
  미팅: "meeting",
  기록: "record",
};

function makeDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTarget(menu: TagMenuTarget | null, target: TagMenuTarget): boolean {
  return menu?.kind === target.kind && menu.id === target.id;
}

function targetKey(target: TagMenuTarget): string {
  return `${target.kind}:${target.id}`;
}

function tagToneClass(tag: TodoTag | null): string {
  return tag ? ` todo-tag--${TODO_TAG_TONE[tag]}` : "";
}

function tagOptionToneClass(tag: TodoTag): string {
  return ` todo-tag-option--${TODO_TAG_TONE[tag]}`;
}

function TagCommandMenu({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (tag: TodoTag) => void;
}) {
  return (
    <div className="todo-tag-menu" role="listbox" aria-label="태그 선택">
      {TODO_TAGS.map((tag, index) => (
        <button
          key={tag}
          type="button"
          className={`todo-tag-option${tagOptionToneClass(tag)}${activeIndex === index ? " is-active" : ""}`}
          role="option"
          aria-selected={activeIndex === index}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(tag);
          }}
        >
          <IconTag /> [{tag}]
        </button>
      ))}
    </div>
  );
}

export function TodoBoard({
  data,
  addRequest,
  showToast,
}: {
  data: TodoBoardData;
  addRequest: number;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<TodoNoteRow[]>(data.notes);
  const [drafts, setDrafts] = useState<TodoDraft[]>([]);
  const [dirtyNoteIds, setDirtyNoteIds] = useState<Set<string>>(new Set());
  const [tagMenu, setTagMenu] = useState<TagMenuTarget | null>(null);
  const [tagMenuIndex, setTagMenuIndex] = useState(0);
  const [focusDraftId, setFocusDraftId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draftRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const handledAddRequestRef = useRef(addRequest);
  const composingTargetsRef = useRef<Set<string>>(new Set());

  const addDraft = useCallback((afterId?: string) => {
    const next: TodoDraft = { id: makeDraftId(), content: "", tag: null };
    setDrafts((prev) => {
      if (!afterId) return [...prev, next];
      const index = prev.findIndex((draft) => draft.id === afterId);
      if (index === -1) return [...prev, next];
      return [...prev.slice(0, index + 1), next, ...prev.slice(index + 1)];
    });
    setFocusDraftId(next.id);
  }, []);

  useEffect(() => {
    setNotes(data.notes);
  }, [data.notes]);

  useEffect(() => {
    if (addRequest === handledAddRequestRef.current) return;
    handledAddRequestRef.current = addRequest;
    addDraft();
  }, [addDraft, addRequest]);

  useEffect(() => {
    if (!focusDraftId) return;
    draftRefs.current[focusDraftId]?.focus();
    setFocusDraftId(null);
  }, [focusDraftId, drafts.length]);

  const todayNotes = useMemo(
    () =>
      notes
        .filter((note) => note.noteDate === data.today)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [data.today, notes],
  );

  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id));
    setTagMenu((menu) =>
      menu?.kind === "draft" && menu.id === id ? null : menu,
    );
  }

  function updateDraft(id: string, patch: Partial<TodoDraft>) {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function applyNoteLocal(id: string, patch: Partial<TodoNoteRow>) {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...patch } : note)),
    );
  }

  function handleTagMenuKeys(
    e: ReactKeyboardEvent<HTMLInputElement>,
    target: TagMenuTarget,
    onSelect: (tag: TodoTag) => void,
  ): boolean {
    if (!isTarget(tagMenu, target)) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTagMenuIndex((index) => (index + 1) % TODO_TAGS.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setTagMenuIndex(
        (index) => (index - 1 + TODO_TAGS.length) % TODO_TAGS.length,
      );
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onSelect(TODO_TAGS[tagMenuIndex]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setTagMenu(null);
      return true;
    }
    return false;
  }

  function isComposingInput(
    e: ReactKeyboardEvent<HTMLInputElement>,
    target: TagMenuTarget,
  ): boolean {
    return (
      composingTargetsRef.current.has(targetKey(target)) ||
      e.nativeEvent.isComposing ||
      e.nativeEvent.keyCode === 229
    );
  }

  function handleCompositionStart(target: TagMenuTarget) {
    composingTargetsRef.current.add(targetKey(target));
  }

  function handleCompositionEnd(target: TagMenuTarget) {
    window.setTimeout(() => {
      composingTargetsRef.current.delete(targetKey(target));
    }, 0);
  }

  function openTagMenu(target: TagMenuTarget) {
    setTagMenu(target);
    setTagMenuIndex(0);
  }

  function saveDrafts() {
    const filled = drafts.filter((draft) => draft.content.trim().length > 0);
    if (filled.length === 0) {
      setDrafts([]);
      setTagMenu(null);
      return;
    }

    startTransition(async () => {
      const result = await createTodoNotes(
        filled.map((draft) => ({
          content: draft.content,
          tag: draft.tag,
        })),
      );
      if (!result.ok) {
        showToast(result.error ?? "노트 저장에 실패했습니다.");
        return;
      }
      setDrafts([]);
      setTagMenu(null);
      showToast("노트가 저장되었습니다");
      router.refresh();
    });
  }

  function toggleNote(note: TodoNoteRow) {
    const completed = !note.completed;
    applyNoteLocal(note.id, { completed });
    startTransition(async () => {
      const result = await updateTodoNote(note.id, { completed });
      if (!result.ok) {
        applyNoteLocal(note.id, { completed: note.completed });
        showToast(result.error ?? "체크 상태 변경에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function updateNoteTag(note: TodoNoteRow, tag: TodoTag | null) {
    const previousTag = note.tag;
    applyNoteLocal(note.id, { tag });
    setTagMenu(null);
    startTransition(async () => {
      const result = await updateTodoNote(note.id, { tag });
      if (!result.ok) {
        applyNoteLocal(note.id, { tag: previousTag });
        showToast(result.error ?? "태그 저장에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function markNoteDirty(id: string) {
    setDirtyNoteIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function clearNoteDirty(id: string) {
    setDirtyNoteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function saveNoteContent(note: TodoNoteRow) {
    if (!dirtyNoteIds.has(note.id)) return;
    const content = note.content.trim();
    if (!content) {
      removeNote(note);
      return;
    }

    clearNoteDirty(note.id);
    startTransition(async () => {
      const result = await updateTodoNote(note.id, { content });
      if (!result.ok) {
        showToast(result.error ?? "노트 저장에 실패했습니다.");
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  function removeNote(note: TodoNoteRow) {
    const previous = notes;
    setNotes((prev) => prev.filter((item) => item.id !== note.id));
    setTagMenu((menu) =>
      menu?.kind === "note" && menu.id === note.id ? null : menu,
    );
    startTransition(async () => {
      const result = await deleteTodoNote(note.id);
      if (!result.ok) {
        setNotes(previous);
        showToast(result.error ?? "노트 삭제에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function renderNote(note: TodoNoteRow) {
    const target: TagMenuTarget = { kind: "note", id: note.id };
    return (
      <div
        key={note.id}
        className={`todo-item${note.completed ? " is-completed" : ""}`}
      >
        <button
          type="button"
          className={`todo-check${note.completed ? " is-on" : ""}`}
          onClick={() => toggleNote(note)}
          aria-label={note.completed ? "완료 해제" : "완료 처리"}
        >
          {note.completed ? <IconCheck /> : null}
        </button>
        <div className="todo-item-body">
          <div className="todo-edit-row">
            <button
              type="button"
              className={`todo-tag${note.tag ? "" : " is-empty"}${tagToneClass(note.tag)}`}
              onClick={() => openTagMenu(target)}
            >
              {note.tag ? `[${note.tag}]` : "태그"}
            </button>
            <input
              className="todo-text-input"
              value={note.content}
              onChange={(e) => {
                applyNoteLocal(note.id, { content: e.target.value });
                markNoteDirty(note.id);
              }}
              onBlur={(e) =>
                saveNoteContent({ ...note, content: e.currentTarget.value })
              }
              onCompositionStart={() => handleCompositionStart(target)}
              onCompositionEnd={() => handleCompositionEnd(target)}
              onKeyDown={(e) => {
                const handled = handleTagMenuKeys(e, target, (tag) =>
                  updateNoteTag(note, tag),
                );
                if (handled) return;
                if (isComposingInput(e, target)) return;
                if (e.key === "/" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  openTagMenu(target);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              aria-label="노트 내용"
            />
            <button
              type="button"
              className="todo-row-action"
              onClick={() => removeNote(note)}
              aria-label="노트 삭제"
            >
              <IconX />
            </button>
          </div>
          {isTarget(tagMenu, target) ? (
            <TagCommandMenu
              activeIndex={tagMenuIndex}
              onSelect={(tag) => updateNoteTag(note, tag)}
            />
          ) : null}
        </div>
      </div>
    );
  }

  function renderDraft(draft: TodoDraft) {
    const target: TagMenuTarget = { kind: "draft", id: draft.id };
    return (
      <div key={draft.id} className="todo-item is-draft">
        <span className="todo-check todo-check--draft" aria-hidden="true" />
        <div className="todo-item-body">
          <div className="todo-edit-row">
            <button
              type="button"
              className={`todo-tag${draft.tag ? "" : " is-empty"}${tagToneClass(draft.tag)}`}
              onClick={() => openTagMenu(target)}
            >
              {draft.tag ? `[${draft.tag}]` : "태그"}
            </button>
            <input
              ref={(node) => {
                draftRefs.current[draft.id] = node;
              }}
              className="todo-text-input"
              value={draft.content}
              onChange={(e) =>
                updateDraft(draft.id, { content: e.target.value })
              }
              onCompositionStart={() => handleCompositionStart(target)}
              onCompositionEnd={() => handleCompositionEnd(target)}
              onKeyDown={(e) => {
                const handled = handleTagMenuKeys(e, target, (tag) => {
                  updateDraft(draft.id, { tag });
                  setTagMenu(null);
                });
                if (handled) return;
                if (isComposingInput(e, target)) return;
                if (e.key === "/" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  openTagMenu(target);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const content = e.currentTarget.value;
                  updateDraft(draft.id, { content });
                  if (!content.trim()) {
                    removeDraft(draft.id);
                    return;
                  }
                  addDraft(draft.id);
                }
              }}
              placeholder="빠르게 기록할 일을 입력"
              aria-label="새 노트 내용"
            />
            <button
              type="button"
              className="todo-row-action"
              onClick={() => removeDraft(draft.id)}
              aria-label="작성 취소"
            >
              <IconX />
            </button>
          </div>
          {isTarget(tagMenu, target) ? (
            <TagCommandMenu
              activeIndex={tagMenuIndex}
              onSelect={(tag) => {
                updateDraft(draft.id, { tag });
                setTagMenu(null);
              }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="todo-board">
      <section className="todo-group todo-group--today">
        <div className="todo-group-head">
          <div>
            <div className="todo-date">
              <IconCalendar />
              {formatDotDateString(data.today)}
              <span>오늘</span>
            </div>
            <p>{todayNotes.length + drafts.length}개의 체크노트</p>
          </div>
          {drafts.length > 0 ? (
            <Button
              variant="cta"
              size="sm"
              type="button"
              onClick={saveDrafts}
              disabled={pending}
            >
              {pending ? "저장 중…" : "저장"}
            </Button>
          ) : null}
        </div>

        <div className="todo-list">
          {todayNotes.map(renderNote)}
          {drafts.map(renderDraft)}
          {todayNotes.length === 0 && drafts.length === 0 ? (
            <div className="todo-empty">
              <IconList />
              오늘 남긴 노트가 없습니다.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
