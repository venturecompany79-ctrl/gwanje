import type { NextRequest } from "next/server";
import type { TaskStage } from "@/lib/database.types";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

const TASK_STAGES: TaskStage[] = ["diagnosis", "proposal", "application", "result"];

interface UpdateTaskBody {
  stage?: TaskStage;
  memo?: string | null;
}

function optionalMemo(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireMobileContext(request, "tasks.write");
  if (ctx instanceof Response) return ctx;

  const { id } = await context.params;
  if (!id) return mobileError("Task를 찾을 수 없습니다.");

  const body = await mobileJson<UpdateTaskBody>(request);
  if (!body) return mobileError("수정할 내용이 없습니다.");

  const update: {
    stage?: TaskStage;
    memo?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (body.stage !== undefined) {
    if (!TASK_STAGES.includes(body.stage)) {
      return mobileError("단계 값이 올바르지 않습니다.");
    }
    update.stage = body.stage;
  }

  const memo = optionalMemo(body.memo);
  if (memo !== undefined) update.memo = memo;

  if (update.stage === undefined && memo === undefined) {
    return mobileError("수정할 내용이 없습니다.");
  }

  const { data, error } = await ctx.supabase
    .from("task")
    .update(update)
    .eq("id", id)
    .select("id, company_id, title, stage, due_date, memo, updated_at")
    .maybeSingle();
  if (error) {
    return mobileError(`저장에 실패했습니다: ${error.message}`, 500);
  }
  if (!data) return mobileError("Task를 찾을 수 없습니다.", 404);

  return mobileOk({ task: data });
}
