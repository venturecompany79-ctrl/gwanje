import { createClient } from "@/lib/supabase/server";
import { DEMO_BOARD } from "@/lib/demo-data";
import { hasPermission, isMemberRole, normalizePermissions } from "@/lib/permissions";
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

export async function getBoardData(): Promise<BoardData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_BOARD();

  const { data: auth } = await supabase.auth.getUser();
  const [tasks, companies, categories, profiles, currentProfile] = await Promise.all([
    // 보드 카드에 필요한 컬럼만 — 전량(select *) 조회 축소 (GWJ-019 ③)
    supabase
      .from("task")
      .select(
        "id, title, category_id, stage, due_date, assignee_id, memo, company_id",
      ),
    supabase.from("company").select("id, name").order("name"),
    supabase.from("category").select("id, name").order("sort_order"),
    supabase.from("profile").select("id, name"),
    auth.user
      ? supabase
          .from("profile")
          .select("role, permissions, status")
          .eq("id", auth.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const firstError =
    tasks.error ??
    companies.error ??
    categories.error ??
    profiles.error ??
    currentProfile.error;
  if (firstError) {
    throw new Error(`관리포인트를 불러오지 못했습니다: ${firstError.message}`);
  }

  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const categoryName = new Map(
    (categories.data ?? []).map((c) => [c.id, c.name]),
  );
  const profileName = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));
  const role =
    currentProfile.data?.role && isMemberRole(currentProfile.data.role)
      ? currentProfile.data.role
      : "viewer";
  const permissions = normalizePermissions(
    role,
    currentProfile.data?.permissions ?? [],
  );

  return {
    demo: false,
    canWriteTasks: hasPermission(
      { role, permissions, status: currentProfile.data?.status === "active" ? "active" : "disabled" },
      "tasks.write",
    ),
    tasks: (tasks.data ?? [])
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
