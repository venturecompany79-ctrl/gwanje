"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { daysFromToday, isValidDateString, todayKstDate } from "@/lib/datetime";
import {
  TODO_BOARD_DAY_COUNT,
  cleanTodoContent,
  isTodoTag,
  type TodoTag,
} from "@/lib/todos";
import {
  DEMO_ERROR,
  getTenantContext,
  type ActionResult,
} from "@/lib/actions/shared";

interface TodoDraftInput {
  content: string;
  tag: TodoTag | null;
}

interface TodoPatchInput {
  content?: string;
  tag?: TodoTag | null;
  completed?: boolean;
  noteDate?: string;
}

function normalizeTag(value: TodoTag | null | undefined): TodoTag | null {
  if (value === null || value === undefined) return null;
  return isTodoTag(value) ? value : null;
}

/**
 * 노트 작성 가능한 날짜인지 검증한다.
 * - "YYYY-MM-DD" 형식
 * - 미래 금지(오늘 이하)
 * - 보드가 보여주는 최근 TODO_BOARD_DAY_COUNT일 범위 이내
 */
function resolveNoteDate(value: string | undefined): string | null {
  if (value === undefined) return todayKstDate();
  if (!isValidDateString(value)) return null;
  const offset = daysFromToday(value);
  if (offset > 0 || offset < -(TODO_BOARD_DAY_COUNT - 1)) return null;
  return value;
}

export async function createTodoNotes(
  drafts: TodoDraftInput[],
  noteDate?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const targetDate = resolveNoteDate(noteDate);
  if (!targetDate) {
    return { ok: false, error: "작성할 수 없는 날짜입니다." };
  }

  const cleaned = drafts
    .map((draft) => ({
      content: cleanTodoContent(draft.content),
      tag: normalizeTag(draft.tag),
    }))
    .filter((draft) => draft.content.length > 0);

  if (cleaned.length === 0) return { ok: true, error: null };

  const { data: lastNote, error: lastError } = await supabase
    .from("todo_note")
    .select("sort_order")
    .eq("note_date", targetDate)
    .eq("user_id", ctx.userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    console.error("[createTodoNotes:last]", lastError.code, lastError.message);
    return { ok: false, error: `저장에 실패했습니다: ${lastError.message}` };
  }

  const baseOrder = (lastNote?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("todo_note").insert(
    cleaned.map((draft, index) => ({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      note_date: targetDate,
      content: draft.content,
      tag: draft.tag,
      sort_order: baseOrder + index,
    })),
  );

  if (error) {
    console.error("[createTodoNotes]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/board");
  return { ok: true, error: null };
}

export async function updateTodoNote(
  noteId: string,
  patch: TodoPatchInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!noteId) return { ok: false, error: "노트를 찾을 수 없습니다." };

  const update: {
    content?: string;
    tag?: TodoTag | null;
    completed?: boolean;
    note_date?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (patch.content !== undefined) {
    const content = cleanTodoContent(patch.content);
    if (!content) return { ok: false, error: "빈 노트는 저장할 수 없습니다." };
    update.content = content;
  }
  if (patch.tag !== undefined) update.tag = normalizeTag(patch.tag);
  if (patch.completed !== undefined) update.completed = patch.completed;
  if (patch.noteDate !== undefined) {
    const noteDate = resolveNoteDate(patch.noteDate);
    if (!noteDate) return { ok: false, error: "작성할 수 없는 날짜입니다." };
    update.note_date = noteDate;
  }

  const { error } = await supabase
    .from("todo_note")
    .update(update)
    .eq("id", noteId);

  if (error) {
    console.error("[updateTodoNote]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/board");
  return { ok: true, error: null };
}

export async function deleteTodoNote(noteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };
  if (!noteId) return { ok: false, error: "노트를 찾을 수 없습니다." };

  const { error } = await supabase.from("todo_note").delete().eq("id", noteId);
  if (error) {
    console.error("[deleteTodoNote]", error.code, error.message);
    return { ok: false, error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/app/board");
  return { ok: true, error: null };
}
