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
  IconPlus,
  IconTag,
  IconX,
} from "@/components/ui/icons";
import {
  createTodoNotes,
  deleteTodoNote,
  updateTodoNote,
} from "@/lib/actions/todos";
import { dayDiffString, formatDotDateString } from "@/lib/datetime";
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
  date: string;
}

interface TodoDateGroup {
  date: string;
  label: string;
  notes: TodoNoteRow[];
  isToday: boolean;
}

type TagMenuTarget =
  | { kind: "note"; id: string }
  | { kind: "draft"; id: string };

const TODO_TAG_TONE: Record<TodoTag, string> = {
  상담: "consult",
  미팅: "meeting",
  서류: "doc",
  기타: "etc",
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

function groupLabel(offset: number): string {
  if (offset === 0) return "오늘";
  if (offset === 1) return "어제";
  return `${offset}일 전`;
}

function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
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
  const draftRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const handledAddRequestRef = useRef(addRequest);
  const composingTargetsRef = useRef<Set<string>>(new Set());

  const addDraft = useCallback(
    (date: string, afterId?: string) => {
      const next: TodoDraft = {
        id: makeDraftId(),
        content: "",
        tag: null,
        date,
      };
      setDrafts((prev) => {
        if (!afterId) return [...prev, next];
        const index = prev.findIndex((draft) => draft.id === afterId);
        if (index === -1) return [...prev, next];
        return [...prev.slice(0, index + 1), next, ...prev.slice(index + 1)];
      });
      setFocusDraftId(next.id);
    },
    [],
  );

  useEffect(() => {
    setNotes(data.notes);
  }, [data.notes]);

  useEffect(() => {
    if (addRequest === handledAddRequestRef.current) return;
    handledAddRequestRef.current = addRequest;
    if (!data.canCreate) return;
    addDraft(data.today);
  }, [addDraft, addRequest, data.canCreate, data.today]);

  useEffect(() => {
    if (!focusDraftId) return;
    draftRefs.current[focusDraftId]?.focus();
    setFocusDraftId(null);
  }, [focusDraftId, drafts.length]);

  const dateGroups = useMemo<TodoDateGroup[]>(() => {
    const byDate = new Map<string, TodoNoteRow[]>();
    notes.forEach((note) => {
      const list = byDate.get(note.noteDate) ?? [];
      list.push(note);
      byDate.set(note.noteDate, list);
    });

    // 30일을 미리 깔지 않는다. 오늘(앵커) + 노트가 있는 날 + 작성 중인 날만 카드로.
    const dates = new Set<string>([data.today]);
    notes.forEach((note) => dates.add(note.noteDate));
    drafts.forEach((draft) => dates.add(draft.date));

    return Array.from(dates)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        label: groupLabel(dayDiffString(data.today, date)),
        isToday: date === data.today,
        notes: (byDate.get(date) ?? []).sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.createdAt.localeCompare(b.createdAt),
        ),
      }));
  }, [data.today, notes, drafts]);

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
    e: ReactKeyboardEvent<HTMLTextAreaElement>,
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
    e: ReactKeyboardEvent<HTMLTextAreaElement>,
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

  function changeDraftDate(id: string, date: string) {
    updateDraft(id, { date });
  }

  function changeNoteDate(note: TodoNoteRow, date: string) {
    if (date === note.noteDate) return;
    const previousDate = note.noteDate;
    applyNoteLocal(note.id, { noteDate: date });
    startTransition(async () => {
      const result = await updateTodoNote(note.id, { noteDate: date });
      if (!result.ok) {
        applyNoteLocal(note.id, { noteDate: previousDate });
        showToast(result.error ?? "날짜 변경에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function saveDrafts(date: string) {
    const filled = drafts.filter(
      (draft) => draft.date === date && draft.content.trim().length > 0,
    );
    const clearDate = () =>
      setDrafts((prev) => prev.filter((draft) => draft.date !== date));

    if (filled.length === 0) {
      clearDate();
      setTagMenu(null);
      return;
    }

    startTransition(async () => {
      const result = await createTodoNotes(
        filled.map((draft) => ({
          content: draft.content,
          tag: draft.tag,
        })),
        date,
      );
      if (!result.ok) {
        showToast(result.error ?? "노트 저장에 실패했습니다.");
        return;
      }
      clearDate();
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
        className={`todo-item${note.completed ? " is-completed" : ""}${note.editable ? "" : " is-readonly"}`}
      >
        <button
          type="button"
          className={`todo-check${note.completed ? " is-on" : ""}`}
          onClick={() => toggleNote(note)}
          disabled={!note.editable}
          aria-label={note.completed ? "완료 해제" : "완료 처리"}
        >
          {note.completed ? <IconCheck /> : null}
        </button>
        <div className="todo-item-body">
          <div className="todo-edit-row">
            <input
              type="date"
              className="todo-draft-date"
              value={note.noteDate}
              onChange={(e) => {
                if (note.editable && e.target.value) {
                  changeNoteDate(note, e.target.value);
                }
              }}
              disabled={!note.editable}
              aria-label="노트 날짜"
            />
            {data.canViewTeam ? (
              <span className="todo-author">{note.userName}</span>
            ) : null}
            <button
              type="button"
              className={`todo-tag${note.tag ? "" : " is-empty"}${tagToneClass(note.tag)}`}
              onClick={() => {
                if (note.editable) openTagMenu(target);
              }}
              disabled={!note.editable}
            >
              {note.tag ? `[${note.tag}]` : "태그"}
            </button>
            <textarea
              ref={(node) => {
                if (node) autoResizeTextarea(node);
              }}
              className="todo-text-input"
              rows={1}
              value={note.content}
              onChange={(e) => {
                if (!note.editable) return;
                autoResizeTextarea(e.currentTarget);
                applyNoteLocal(note.id, { content: e.target.value });
                markNoteDirty(note.id);
              }}
              onBlur={(e) =>
                note.editable
                  ? saveNoteContent({ ...note, content: e.currentTarget.value })
                  : undefined
              }
              readOnly={!note.editable}
              onCompositionStart={() => handleCompositionStart(target)}
              onCompositionEnd={() => handleCompositionEnd(target)}
              onKeyDown={(e) => {
                if (!note.editable) return;
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
                if (e.key === "Enter" && !e.shiftKey) {
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
              disabled={!note.editable}
              aria-label="노트 삭제"
            >
              <IconX />
            </button>
          </div>
          {note.editable && isTarget(tagMenu, target) ? (
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
            <input
              type="date"
              className="todo-draft-date"
              value={draft.date}
              onChange={(e) => {
                if (e.target.value) changeDraftDate(draft.id, e.target.value);
              }}
              aria-label="노트 날짜"
            />
            <button
              type="button"
              className={`todo-tag${draft.tag ? "" : " is-empty"}${tagToneClass(draft.tag)}`}
              onClick={() => openTagMenu(target)}
            >
              {draft.tag ? `[${draft.tag}]` : "태그"}
            </button>
            <textarea
              ref={(node) => {
                draftRefs.current[draft.id] = node;
                if (node) autoResizeTextarea(node);
              }}
              className="todo-text-input"
              rows={1}
              value={draft.content}
              onChange={(e) => {
                autoResizeTextarea(e.currentTarget);
                updateDraft(draft.id, { content: e.target.value });
              }}
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const content = e.currentTarget.value;
                  updateDraft(draft.id, { content });
                  if (!content.trim()) {
                    removeDraft(draft.id);
                    return;
                  }
                  addDraft(draft.date, draft.id);
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
      {data.canViewTeam ? (
        <div className="journal-filter">
          <label htmlFor="journal-filter">업무일지 보기</label>
          <select
            id="journal-filter"
            className="select-pill"
            value={data.selectedUserId}
            onChange={(e) => {
              const value = e.target.value;
              const href =
                value === "me"
                  ? "/app/board"
                  : `/app/board?journal=${encodeURIComponent(value)}`;
              router.push(href);
            }}
          >
            <option value="me">내 업무일지</option>
            <option value="all">전체 팀원</option>
            {data.members
              .filter((member) => member.id !== data.currentUserId)
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
        </div>
      ) : null}
      {dateGroups.map((group) => {
        const groupDrafts = drafts.filter(
          (draft) => draft.date === group.date,
        );
        const itemCount = group.notes.length + groupDrafts.length;
        return (
          <section
            key={group.date}
            className={`todo-group${
              group.isToday ? " todo-group--today" : " todo-group--past"
            }${itemCount === 0 ? " is-empty" : ""}`}
          >
            <div className="todo-group-head">
              <div>
                <div className="todo-date">
                  <IconCalendar />
                  {formatDotDateString(group.date)}
                  <span>{group.label}</span>
                </div>
                <p>
                  {itemCount > 0
                    ? `${itemCount}개의 체크노트`
                    : group.isToday
                      ? "오늘 남긴 노트가 없습니다"
                      : "기록 없음"}
                </p>
              </div>
              <div className="todo-group-actions">
                {groupDrafts.length > 0 ? (
                  <Button
                    variant="cta"
                    size="sm"
                    type="button"
                    onClick={() => saveDrafts(group.date)}
                    disabled={pending}
                  >
                    {pending ? "저장 중…" : "저장"}
                  </Button>
                ) : data.canCreate ? (
                  <button
                    type="button"
                    className="todo-add-note"
                    onClick={() => addDraft(group.date)}
                  >
                    <IconPlus /> 노트 추가
                  </button>
                ) : null}
              </div>
            </div>

            <div
              className={`todo-list${group.isToday ? "" : " todo-list--past"}`}
            >
              {group.notes.map(renderNote)}
              {groupDrafts.map(renderDraft)}
              {groupDrafts.length > 0 ? (
                <div className="todo-draft-footer">
                  <button
                    type="button"
                    className="todo-add-note"
                    onClick={() => addDraft(group.date)}
                  >
                    <IconPlus /> 노트 추가
                  </button>
                  <span className="todo-draft-hint">Shift+Enter 줄바꿈</span>
                </div>
              ) : null}
              {itemCount === 0 ? (
                <button
                  type="button"
                  className="todo-empty todo-empty--action"
                  onClick={() => {
                    if (data.canCreate) addDraft(group.date);
                  }}
                  disabled={!data.canCreate}
                >
                  <IconList />
                  {!data.canCreate
                    ? "선택한 팀원의 업무일지가 없습니다."
                    : group.isToday
                    ? "오늘 남길 노트를 추가하세요."
                    : "이 날짜에 노트를 추가하세요."}
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
