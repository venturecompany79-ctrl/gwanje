"use server";

// 과제(관리포인트) 공용 서버 액션 — 기업 상세 탭 + 관리포인트 보드 공용
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_DOCUMENTS_BUCKET,
  COMPANY_DOCUMENTS_MAX_BYTES,
  getFileExtension,
  normalizeCompanyDocumentMimeType,
} from "@/lib/storage";
import type { TaskStage, TaskWorkStatus } from "@/lib/database.types";
import { daysFromToday } from "@/lib/datetime";
import type { TaskRow } from "@/lib/data/company-detail";
import {
  DEMO_ERROR,
  assertCompanyAccess,
  parseOptionalDate,
  requirePermission,
  type Supabase,
  optionalText,
  type ActionResult,
} from "@/lib/actions/shared";

const TASK_STAGES: TaskStage[] = ["diagnosis", "proposal", "application", "result"];
const TASK_WORK_STATUSES: TaskWorkStatus[] = [
  "planned",
  "in_progress",
  "waiting",
  "on_hold",
  "completed",
];

export interface TaskStateMutationResult extends ActionResult {
  taskId?: string;
  stage?: TaskStage;
  workStatus?: TaskWorkStatus;
  updatedAt?: string;
  conflict?: boolean;
}

export interface CompanyPortfolioTasksResult {
  ok: boolean;
  error: string | null;
  tasks: TaskRow[];
}

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
    const contentType = normalizeCompanyDocumentMimeType(file.name, file.type);
    if (!contentType) {
      await removeUploadedTaskFiles(supabase, uploadedPaths);
      return {
        ok: false,
        error: `${file.name} 파일 형식은 지원하지 않습니다. PDF, 이미지, Office, HWP/HWPX, CSV 파일만 업로드할 수 있습니다.`,
      };
    }

    const path = taskFilePath(ctx.tenantId, companyId, taskId, file);
    const { error } = await supabase.storage
      .from(COMPANY_DOCUMENTS_BUCKET)
      .upload(path, file, {
        contentType,
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
      mime_type: contentType,
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
  const workStatus = String(
    formData.get("work_status") ?? "planned",
  ) as TaskWorkStatus;
  if (!TASK_WORK_STATUSES.includes(workStatus)) {
    return { ok: false, error: "업무상태 값이 올바르지 않습니다." };
  }

  const dueDate = parseOptionalDate(formData, "due_date", "마감일");
  if (!dueDate.ok) return { ok: false, error: dueDate.error };

  const files = getTaskFiles(formData);
  const { data: createdTask, error } = await supabase
    .from("task")
    .insert({
      tenant_id: allowed.tenantId,
      company_id: companyId,
      title,
      category_id: optionalText(formData, "category_id"),
      stage,
      work_status: workStatus,
      due_date: dueDate.value,
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

/** 과제 슬라이드오버 [변경 저장] — 기본 정보 + 메모 + 첨부 파일 */
export async function updateTask(
  companyId: string,
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "과제명을 입력해 주세요." };

  const dueDate = parseOptionalDate(formData, "due_date", "마감일");
  if (!dueDate.ok) return { ok: false, error: dueDate.error };

  const files = getTaskFiles(formData);
  const { data, error } = await supabase
    .from("task")
    .update({
      title,
      category_id: optionalText(formData, "category_id"),
      due_date: dueDate.value,
      memo: optionalText(formData, "memo"),
    })
    .eq("id", taskId)
    .eq("company_id", companyId)
    .select("id");
  if (error) {
    console.error("[updateTask]", error.code, error.message);
    return { ok: false, error: `저장에 실패했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "과제를 찾을 수 없습니다." };
  }

  const uploadResult = await uploadTaskFiles(
    supabase,
    { tenantId: allowed.tenantId, userId: allowed.userId },
    companyId,
    taskId,
    files,
  );
  if (!uploadResult.ok) return uploadResult;

  revalidateTaskScreens(companyId);
  return { ok: true, error: null };
}

/** 칸반 드래그 이동 — 단계만 변경 (메모 보존) */
export async function updateTaskStage(
  companyId: string,
  taskId: string,
  stage: TaskStage,
  expectedUpdatedAt?: string,
): Promise<TaskStateMutationResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (!TASK_STAGES.includes(stage)) {
    return { ok: false, error: "단계 값이 올바르지 않습니다." };
  }

  let updateQuery = supabase
    .from("task")
    .update({ stage })
    .eq("id", taskId)
    .eq("company_id", companyId);
  if (expectedUpdatedAt) {
    updateQuery = updateQuery.eq("updated_at", expectedUpdatedAt);
  }
  const { data, error } = await updateQuery.select(
    "id, stage, work_status, updated_at",
  );
  if (error) {
    console.error("[updateTaskStage]", error.code, error.message);
    return { ok: false, error: `변경에 실패했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    if (expectedUpdatedAt) {
      const { data: current } = await supabase
        .from("task")
        .select("id, stage, work_status, updated_at")
        .eq("id", taskId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (current) {
        return {
          ok: false,
          error: "다른 사용자가 먼저 변경했습니다. 최신 상태를 다시 불러왔습니다.",
          conflict: true,
          taskId: current.id,
          stage: current.stage,
          workStatus: current.work_status,
          updatedAt: current.updated_at,
        };
      }
    }
    return { ok: false, error: "과제를 찾을 수 없습니다." };
  }

  revalidateTaskScreens(companyId);
  const task = data[0];
  return {
    ok: true,
    error: null,
    taskId: task.id,
    stage: task.stage,
    workStatus: task.work_status,
    updatedAt: task.updated_at,
  };
}

/** 기업 관제표/Task 행의 빠른 업무상태 변경. */
export async function updateTaskWorkStatus(
  companyId: string,
  taskId: string,
  workStatus: TaskWorkStatus,
  expectedUpdatedAt?: string,
): Promise<TaskStateMutationResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: DEMO_ERROR };

  const allowed = await requirePermission(supabase, "tasks.write");
  if ("error" in allowed) return { ok: false, error: allowed.error };

  if (!TASK_WORK_STATUSES.includes(workStatus)) {
    return { ok: false, error: "업무상태 값이 올바르지 않습니다." };
  }

  let updateQuery = supabase
    .from("task")
    .update({ work_status: workStatus })
    .eq("id", taskId)
    .eq("company_id", companyId);
  if (expectedUpdatedAt) {
    updateQuery = updateQuery.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error } = await updateQuery.select(
    "id, stage, work_status, updated_at",
  );
  if (error) {
    console.error("[updateTaskWorkStatus]", error.code, error.message);
    return { ok: false, error: `변경에 실패했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    if (expectedUpdatedAt) {
      const { data: current } = await supabase
        .from("task")
        .select("id, stage, work_status, updated_at")
        .eq("id", taskId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (current) {
        return {
          ok: false,
          error: "다른 사용자가 먼저 변경했습니다. 최신 상태를 다시 불러왔습니다.",
          conflict: true,
          taskId: current.id,
          stage: current.stage,
          workStatus: current.work_status,
          updatedAt: current.updated_at,
        };
      }
    }
    return { ok: false, error: "과제를 찾을 수 없습니다." };
  }

  revalidateTaskScreens(companyId);
  const task = data[0];
  return {
    ok: true,
    error: null,
    taskId: task.id,
    stage: task.stage,
    workStatus: task.work_status,
    updatedAt: task.updated_at,
  };
}

/** 기업 관제표의 펼침 행에서 필요한 Task만 지연 조회한다. */
export async function getCompanyPortfolioTasks(
  companyId: string,
): Promise<CompanyPortfolioTasksResult> {
  const supabase = await createClient();
  if (!supabase) {
    const { DEMO_COMPANY_DETAIL } = await import("@/lib/demo-data");
    return {
      ok: true,
      error: null,
      tasks:
        DEMO_COMPANY_DETAIL(companyId)?.tasks.filter(
          (task) => task.workStatus !== "completed",
        ) ?? [],
    };
  }

  const allowed = await requirePermission(supabase, "tasks.read");
  if ("error" in allowed) {
    return { ok: false, error: allowed.error, tasks: [] };
  }
  const access = await assertCompanyAccess(supabase, companyId, allowed.tenantId);
  if (!access.ok) return { ok: false, error: access.error, tasks: [] };

  const [tasks, categories, profiles] = await Promise.all([
    supabase
      .from("task")
      .select(
        "id, title, category_id, stage, work_status, due_date, assignee_id, memo, updated_at",
      )
      .eq("company_id", companyId)
      .neq("work_status", "completed"),
    supabase.from("category").select("id, name"),
    supabase.from("profile").select("id, name"),
  ]);

  const firstError = tasks.error ?? categories.error ?? profiles.error;
  if (firstError) {
    return {
      ok: false,
      error: `Task를 불러오지 못했습니다: ${firstError.message}`,
      tasks: [],
    };
  }

  const categoryName = new Map(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );
  const profileName = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.name]),
  );

  const rows: TaskRow[] = (tasks.data ?? [])
    .map((task) => ({
      id: task.id,
      title: task.title,
      categoryId: task.category_id,
      categoryName: task.category_id
        ? (categoryName.get(task.category_id) ?? null)
        : null,
      stage: task.stage,
      workStatus: task.work_status,
      dueDate: task.due_date,
      daysLeft: task.due_date ? daysFromToday(task.due_date) : null,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_id
        ? (profileName.get(task.assignee_id) ?? null)
        : null,
      memo: task.memo,
      updatedAt: task.updated_at,
    }))
    .sort((a, b) => {
      const activeA = a.workStatus === "completed" ? 1 : 0;
      const activeB = b.workStatus === "completed" ? 1 : 0;
      if (activeA !== activeB) return activeA - activeB;
      const overdueA = a.daysLeft !== null && a.daysLeft < 0 ? 0 : 1;
      const overdueB = b.daysLeft !== null && b.daysLeft < 0 ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      const holdA = a.workStatus === "on_hold" ? 0 : 1;
      const holdB = b.workStatus === "on_hold" ? 0 : 1;
      if (holdA !== holdB) return holdA - holdB;
      return (
        (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
        (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
      );
    });

  return { ok: true, error: null, tasks: rows };
}
