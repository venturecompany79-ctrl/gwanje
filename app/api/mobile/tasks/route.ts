import type { NextRequest } from "next/server";
import type { TaskStage } from "@/lib/database.types";
import { isValidDateString } from "@/lib/datetime";
import {
  mobileError,
  mobileJson,
  mobileOk,
  requireMobileContext,
} from "@/lib/mobile/api";

const TASK_STAGES: TaskStage[] = ["diagnosis", "proposal", "application", "result"];

interface CreateTaskBody {
  companyId?: string;
  title?: string;
  categoryId?: string | null;
  dueDate?: string | null;
  stage?: TaskStage;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const ctx = await requireMobileContext(request, "tasks.write");
  if (ctx instanceof Response) return ctx;

  const body = await mobileJson<CreateTaskBody>(request);

  const companyId = cleanText(body?.companyId);
  if (!companyId) return mobileError("기업을 선택해 주세요.");

  const title = cleanText(body?.title);
  if (!title) return mobileError("Task 제목을 입력해 주세요.");

  const stage = body?.stage ?? "diagnosis";
  if (!TASK_STAGES.includes(stage)) {
    return mobileError("단계 값이 올바르지 않습니다.");
  }

  let dueDate: string | null = null;
  if (body?.dueDate) {
    if (!isValidDateString(body.dueDate)) {
      return mobileError("마감일 형식이 올바르지 않습니다.");
    }
    dueDate = body.dueDate;
  }

  const categoryId = cleanText(body?.categoryId) || null;

  // 테넌트 소속 기업인지 확인 (RLS도 막지만, 명확한 에러를 위해 선검증)
  const { data: company, error: companyError } = await ctx.supabase
    .from("company")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError) {
    return mobileError(`기업 확인에 실패했습니다: ${companyError.message}`, 500);
  }
  if (!company) return mobileError("기업을 찾을 수 없습니다.", 404);

  const { data, error } = await ctx.supabase
    .from("task")
    .insert({
      tenant_id: ctx.member.tenantId,
      company_id: companyId,
      title,
      category_id: categoryId,
      stage,
      due_date: dueDate,
      assignee_id: ctx.member.userId,
    })
    .select("id, company_id, title, stage, due_date, category_id, created_at")
    .single();
  if (error) {
    return mobileError(`저장에 실패했습니다: ${error.message}`, 500);
  }

  return mobileOk({ task: data });
}
