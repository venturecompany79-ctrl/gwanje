import type { NextRequest } from "next/server";
import type { TaskStage, TaskWorkStatus } from "@/lib/database.types";
import { isValidDateString } from "@/lib/datetime";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

const TASK_STAGES: TaskStage[] = ["diagnosis", "proposal", "application", "result"];
const TASK_WORK_STATUSES: TaskWorkStatus[] = [
  "planned",
  "in_progress",
  "waiting",
  "on_hold",
  "completed",
];

interface UpdateTaskBody {
  title?: string;
  categoryId?: string | null;
  dueDate?: string | null;
  stage?: TaskStage;
  workStatus?: TaskWorkStatus;
  expectedUpdatedAt?: string;
  memo?: string | null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    title?: string;
    category_id?: string | null;
    due_date?: string | null;
    stage?: TaskStage;
    work_status?: TaskWorkStatus;
    memo?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) {
    const title = cleanText(body.title);
    if (!title) return mobileError("Task 제목을 입력해 주세요.");
    update.title = title;
  }

  if (body.categoryId !== undefined) {
    update.category_id = cleanText(body.categoryId) || null;
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") {
      update.due_date = null;
    } else if (isValidDateString(body.dueDate)) {
      update.due_date = body.dueDate;
    } else {
      return mobileError("마감일 형식이 올바르지 않습니다.");
    }
  }

  if (body.stage !== undefined) {
    if (!TASK_STAGES.includes(body.stage)) {
      return mobileError("단계 값이 올바르지 않습니다.");
    }
    update.stage = body.stage;
  }
  if (body.workStatus !== undefined) {
    if (!TASK_WORK_STATUSES.includes(body.workStatus)) {
      return mobileError("업무상태 값이 올바르지 않습니다.");
    }
    update.work_status = body.workStatus;
  }

  const memo = optionalMemo(body.memo);
  if (memo !== undefined) update.memo = memo;

  if (
    update.title === undefined &&
    update.category_id === undefined &&
    update.due_date === undefined &&
    update.stage === undefined &&
    update.work_status === undefined &&
    memo === undefined
  ) {
    return mobileError("수정할 내용이 없습니다.");
  }

  let query = ctx.supabase
    .from("task")
    .update(update)
    .eq("id", id);
  if (body.expectedUpdatedAt) {
    query = query.eq("updated_at", body.expectedUpdatedAt);
  }
  const { data, error } = await query
    .select(
      "id, company_id, title, category_id, stage, work_status, due_date, memo, updated_at",
    )
    .maybeSingle();
  if (error) {
    return mobileError(`저장에 실패했습니다: ${error.message}`, 500);
  }
  if (!data && body.expectedUpdatedAt) {
    return mobileError(
      "다른 사용자가 먼저 Task를 변경했습니다. 최신 내용을 확인해 주세요.",
      409,
    );
  }
  if (!data) return mobileError("Task를 찾을 수 없습니다.", 404);

  return mobileOk({ task: data });
}
