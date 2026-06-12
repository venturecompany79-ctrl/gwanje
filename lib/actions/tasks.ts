"use server";

// 과제(관리포인트) 공용 서버 액션 — 기업 상세 탭 + 관리포인트 보드 공용
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskStage } from "@/lib/database.types";
import {
  DEMO_ERROR,
  getTenantContext,
  optionalText,
  type ActionResult,
} from "@/lib/actions/shared";

const TASK_STAGES: TaskStage[] = ["diagnosis", "proposal", "application", "result"];

function revalidateTaskScreens(companyId: string) {
  revalidatePath(`/app/companies/${companyId}`);
  revalidatePath("/app/companies");
  revalidatePath("/app/board");
  revalidatePath("/app");
}

export async function addTask(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  if (!companyId) return { ok: false, error: "기업을 선택해 주세요." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "과제명을 입력해 주세요." };

  const stage = String(formData.get("stage") ?? "diagnosis") as TaskStage;
  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const ctx = await getTenantContext(supabase);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase.from("task").insert({
    tenant_id: ctx.tenantId,
    company_id: companyId,
    title,
    category_id: optionalText(formData, "category_id"),
    stage,
    due_date: optionalText(formData, "due_date"),
    assignee_id: ctx.userId,
    memo: optionalText(formData, "memo"),
  });
  if (error) return { ok: false, error: `저장에 실패했습니다: ${error.message}` };

  revalidateTaskScreens(companyId);
  return { ok: true, error: null };
}

/** 과제 슬라이드오버 [변경 저장] — 단계 + 메모 */
export async function updateTask(
  companyId: string,
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const stage = String(formData.get("stage") ?? "") as TaskStage;
  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const { error } = await supabase
    .from("task")
    .update({
      stage,
      memo: optionalText(formData, "memo"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: `저장에 실패했습니다: ${error.message}` };

  revalidateTaskScreens(companyId);
  return { ok: true, error: null };
}

/** 칸반 드래그 이동 — 단계만 변경 (메모 보존) */
export async function updateTaskStage(
  companyId: string,
  taskId: string,
  stage: TaskStage,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const { error } = await supabase
    .from("task")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { ok: false, error: `변경에 실패했습니다: ${error.message}` };

  revalidateTaskScreens(companyId);
  return { ok: true, error: null };
}
