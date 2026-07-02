import { createClient } from "@/lib/supabase/server";
import {
  getCurrentIdentity,
  readCurrentMemberProfile,
  type CurrentMemberProfile,
} from "@/lib/data/current-member";
import { DEMO_BOARD } from "@/lib/demo-data";
import {
  hasPermission,
  normalizePermissions,
} from "@/lib/permissions";
import {
  daysFromToday,
  type CategoryOption,
  type TaskRow,
} from "@/lib/data/company-detail";

export interface BoardTask extends TaskRow {
  companyId: string;
  companyName: string;
}

export interface CompanyOption {
  id: string;
  name: string;
}

export interface BoardData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  tasks: BoardTask[];
  companies: CompanyOption[];
  categories: CategoryOption[];
  canWriteTasks: boolean;
}

const TASK_COLUMNS =
  "id, title, category_id, stage, due_date, assignee_id, memo, company_id";
const ACTIVE_TASK_LIMIT = 500;
const COMPLETED_TASK_LIMIT = 100;

export async function getBoardData(): Promise<BoardData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_BOARD();

  const identity = await getCurrentIdentity(supabase);
  const [
    activeTasks,
    completedTasks,
    companies,
    categories,
    profiles,
    currentProfile,
  ] = await Promise.all([
    supabase
      .from("task")
      .select(TASK_COLUMNS)
      .neq("stage", "result")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(ACTIVE_TASK_LIMIT),
    supabase
      .from("task")
      .select(TASK_COLUMNS)
      .eq("stage", "result")
      .order("updated_at", { ascending: false })
      .limit(COMPLETED_TASK_LIMIT),
    supabase.from("company").select("id, name").order("name"),
    supabase.from("category").select("id, name").order("sort_order"),
    supabase.from("profile").select("id, name"),
    identity
      ? readCurrentMemberProfile(supabase, identity.userId)
      : Promise.resolve<CurrentMemberProfile | null>(null),
  ]);

  const firstError =
    activeTasks.error ??
    completedTasks.error ??
    companies.error ??
    categories.error ??
    profiles.error;
  if (firstError) {
    throw new Error(`관리포인트를 불러오지 못했습니다: ${firstError.message}`);
  }

  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const categoryName = new Map(
    (categories.data ?? []).map((c) => [c.id, c.name]),
  );
  const profileName = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));
  const role = currentProfile?.role ?? "viewer";
  const permissions = currentProfile
    ? normalizePermissions(role, currentProfile.permissions)
    : [];
  const status = currentProfile?.status ?? "disabled";

  return {
    demo: false,
    canWriteTasks: hasPermission(
      { role, permissions, status },
      "tasks.write",
    ),
    tasks: [...(activeTasks.data ?? []), ...(completedTasks.data ?? [])]
      .map((t) => ({
        id: t.id,
        title: t.title,
        categoryId: t.category_id,
        categoryName: t.category_id
          ? (categoryName.get(t.category_id) ?? null)
          : null,
        stage: t.stage,
        dueDate: t.due_date,
        daysLeft: t.due_date ? daysFromToday(t.due_date) : null,
        assigneeName: t.assignee_id
          ? (profileName.get(t.assignee_id) ?? null)
          : null,
        memo: t.memo,
        companyId: t.company_id,
        companyName: companyName.get(t.company_id) ?? "—",
      }))
      // 컬럼 안에서 마감 임박순, 마감 없는 과제는 마지막
      .sort(
        (a, b) =>
          (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
          (b.daysLeft ?? Number.MAX_SAFE_INTEGER),
      ),
    companies: companies.data ?? [],
    categories: categories.data ?? [],
  };
}
