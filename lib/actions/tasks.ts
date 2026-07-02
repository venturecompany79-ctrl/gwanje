"use server";

// 과제(관리포인트) 공용 서버 액션 — 기업 상세 탭 + 관리포인트 보드 공용
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_DOCUMENTS_BUCKET,
  COMPANY_DOCUMENTS_MAX_BYTES,
  getFileExtension,
} from "@/lib/storage";
import type { TaskStage } from "@/lib/database.types";
import {
  DEMO_ERROR,
  assertCompanyAccess,
  requirePermission,
  type Supabase,
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

function isFormFile(value: FormDataEntryValue): value is File {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    name?: unknown;
    size?: unknown;
    type?: unknown;
    arrayBuffer?: unknown;
  };
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function getTaskFiles(formData: FormData): File[] {
  return formData
    .getAll("task_files")
    .filter(isFormFile)
    .filter((file) => file.name.trim().length > 0);
}

function taskFilePath(
  tenantId: string,
  companyId: string,
  taskId: string,
  file: File,
): string {
  const extension = getFileExtension(file.name);
  const suffix = extension ? `.${extension}` : "";
  return `${tenantId}/${companyId}/tasks/${taskId}/${crypto.randomUUID()}${suffix}`;
}

async function removeUploadedTaskFiles(
  supabase: Supabase,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage
    .from(COMPANY_DOCUMENTS_BUCKET)
    .remove(paths);
  if (error) {
    console.error("[removeUploadedTaskFiles]", error.message);
  }
}

async function uploadTaskFiles(
  supabase: Supabase,
  ctx: { tenantId: string; userId: string },
  companyId: string,
  taskId: string,
  files: File[],
): Promise<ActionResult> {
  if (files.length === 0) return { ok: true, error: null };

  const oversized = files.find((file) => file.size > COMPANY_DOCUMENTS_MAX_BYTES);
  if (oversized) {
    return {
      ok: false,
      error: `${oversized.name} 파일이 50MB 제한을 초과했습니다.`,
    };
  }

  const uploadedPaths: string[] = [];
  const rows: {
    tenant_id: string;
    task_id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string | null;
    uploaded_by: string;
  }[] = [];

  for (const file of files) {
    const path = taskFilePath(ctx.tenantId, companyId, taskId, file);
    const { error } = await supabase.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      await removeUploadedTaskFiles(supabase, uploadedPaths);
      console.error("[uploadTaskFiles:storage]", error.message);
      return { ok: false, error: `파일 업로드에 실패했습니다: ${error.message}` };
    }

    uploadedPaths.push(path);
    rows.push({
      tenant_id: ctx.tenantId,
      task_id: taskId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: ctx.userId,
    });
  }

  const { error } = await supabase.from("task_file").insert(rows);
  if (error) {
    await removeUploadedTaskFiles(supabase, uploadedPaths);
    console.error("[uploadTaskFiles:metadata]", error.code, error.message);
    return {
      ok: false,
      error: `파일 정보를 저장하지 못했습니다: ${error.message}`,
    };
  }

  return { ok: true, error: null };
}

export async function addTask(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  if (!companyId) return { ok: false, error: "기업을 선택해 주세요." };

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const access = await assertCompanyAccess(supabase, companyId, allowed.tenantId);
  if (!access.ok) return access;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "과제명을 입력해 주세요." };

  const stage = String(formData.get("stage") ?? "diagnosis") as TaskStage;
  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const files = getTaskFiles(formData);
  const { data: createdTask, error } = await supabase
    .from("task")
    .insert({
      tenant_id: allowed.tenantId,
      company_id: companyId,
      title,
      category_id: optionalText(formData, "category_id"),
      stage,
      due_date: optionalText(formData, "due_date"),
      assignee_id: allowed.userId,
      memo: optionalText(formData, "memo"),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[addTask]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

  const uploadResult = await uploadTaskFiles(
    supabase,
    { tenantId: allowed.tenantId, userId: allowed.userId },
    companyId,
    createdTask.id,
    files,
  );
  if (!uploadResult.ok) {
    await supabase.from("task").delete().eq("id", createdTask.id);
    return uploadResult;
  }

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

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

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
  if (error) {
    console.error("[updateTask]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }

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

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  const { error } = await supabase
    .from("task")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) {
    console.error("[updateTaskStage]", error.code, error.message);
    return { ok: false, error: `변경에 실패했습니다: ${error.message}` };
  }

  revalidateTaskScreens(companyId);
  return { ok: true, error: null };
}
