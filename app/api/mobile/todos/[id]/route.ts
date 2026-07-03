import type { NextRequest } from "next/server";
import { cleanTodoContent, isTodoTag, type TodoTag } from "@/lib/todos";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

interface UpdateTodoBody {
  content?: string;
  tag?: TodoTag | null;
  completed?: boolean;
}

function normalizeTag(value: unknown): TodoTag | null {
  return typeof value === "string" && isTodoTag(value) ? value : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireMobileContext(request);
  if (ctx instanceof Response) return ctx;

  const { id } = await context.params;
  if (!id) return mobileError("노트를 찾을 수 없습니다.");

  const body = await mobileJson<UpdateTodoBody>(request);
  if (!body) return mobileError("수정할 내용이 없습니다.");

  const update: {
    content?: string;
    tag?: TodoTag | null;
    completed?: boolean;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (body.content !== undefined) {
    const content = cleanTodoContent(body.content);
    if (!content) return mobileError("빈 노트는 저장할 수 없습니다.");
    update.content = content;
  }
  if (body.tag !== undefined) update.tag = normalizeTag(body.tag);
  if (body.completed !== undefined) update.completed = Boolean(body.completed);

  const { data, error } = await ctx.supabase
    .from("todo_note")
    .update(update)
    .eq("id", id)
    .select("id, note_date, content, tag, completed, sort_order, created_at, updated_at")
    .maybeSingle();
  if (error) {
    return mobileError(`저장에 실패했습니다: ${error.message}`, 500);
  }
  if (!data) return mobileError("노트를 찾을 수 없습니다.", 404);

  return mobileOk({ note: data });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireMobileContext(request);
  if (ctx instanceof Response) return ctx;

  const { id } = await context.params;
  if (!id) return mobileError("노트를 찾을 수 없습니다.");

  const { error } = await ctx.supabase.from("todo_note").delete().eq("id", id);
  if (error) {
    return mobileError(`삭제에 실패했습니다: ${error.message}`, 500);
  }

  return mobileOk({ id });
}
