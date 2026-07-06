import type { NextRequest } from "next/server";
import { daysFromToday, isValidDateString, todayKstDate } from "@/lib/datetime";
import {
  TODO_BOARD_DAY_COUNT,
  TODO_NOTE_FUTURE_DAYS,
  cleanTodoContent,
  isTodoTag,
  type TodoTag,
} from "@/lib/todos";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

interface CreateTodoBody {
  content?: string;
  tag?: TodoTag | null;
  noteDate?: string;
}

function normalizeTag(value: unknown): TodoTag | null {
  return typeof value === "string" && isTodoTag(value) ? value : null;
}

function resolveNoteDate(value: string | undefined): string | null {
  if (value === undefined) return todayKstDate();
  if (!isValidDateString(value)) return null;
  const offset = daysFromToday(value);
  // 과거는 오늘 포함 최근 TODO_BOARD_DAY_COUNT일, 미래는 오늘 이후 TODO_NOTE_FUTURE_DAYS일까지 허용.
  if (offset > TODO_NOTE_FUTURE_DAYS || offset < -(TODO_BOARD_DAY_COUNT - 1)) {
    return null;
  }
  return value;
}

export async function POST(request: NextRequest) {
  const ctx = await requireMobileContext(request);
  if (ctx instanceof Response) return ctx;

  const body = await mobileJson<CreateTodoBody>(request);
  const content = cleanTodoContent(body?.content ?? "");
  if (!content) return mobileError("노트 내용을 입력해 주세요.");

  const noteDate = resolveNoteDate(body?.noteDate);
  if (!noteDate) return mobileError("작성할 수 없는 날짜입니다.");

  const { data: lastNote, error: lastError } = await ctx.supabase
    .from("todo_note")
    .select("sort_order")
    .eq("note_date", noteDate)
    .eq("user_id", ctx.member.userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) {
    return mobileError(`저장에 실패했습니다: ${lastError.message}`, 500);
  }

  const { data, error } = await ctx.supabase
    .from("todo_note")
    .insert({
      tenant_id: ctx.member.tenantId,
      user_id: ctx.member.userId,
      note_date: noteDate,
      content,
      tag: normalizeTag(body?.tag),
      sort_order: (lastNote?.sort_order ?? -1) + 1,
    })
    .select("id, note_date, content, tag, completed, sort_order, created_at, updated_at")
    .single();
  if (error) {
    return mobileError(`저장에 실패했습니다: ${error.message}`, 500);
  }

  return mobileOk({ note: data });
}
