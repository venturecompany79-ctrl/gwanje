import type { Database } from "@root/lib/database.types";
import { supabase } from "@/lib/supabase";
import { daysFromDateString, shiftDateString, todayKstDate } from "@/lib/dates";

export type DeadlineItem = Database["public"]["Views"]["deadline_item"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["company"]["Row"];
export type TaskRow = Database["public"]["Tables"]["task"]["Row"];
export type TodoNoteRow = Database["public"]["Tables"]["todo_note"]["Row"];
export type CredentialRow = Database["public"]["Tables"]["credential"]["Row"];
export type ScheduleRow = Database["public"]["Tables"]["schedule"]["Row"];

export interface HomeData {
  companyCount: number;
  due7: number;
  expire30: number;
  activeTasks: number;
  unreadCount: number;
  /** 기한 지남 총 건수 — overdue 목록은 8건으로 잘리므로 KPI는 이 값을 쓴다 */
  overdueCount: number;
  overdue: DeadlineItem[];
  deadlines: DeadlineItem[];
}

export interface NotificationItem extends NotificationRow {
  companyName: string | null;
  daysLeft: number | null;
}

export interface MobileTask extends TaskRow {
  companyName: string;
  categoryName: string | null;
  daysLeft: number | null;
}

export interface CompanyListItem extends CompanyRow {
  nearestDaysLeft: number | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface TaskFormOptions {
  companies: CompanyOption[];
  categories: CategoryOption[];
}

export interface CompanyDetailData {
  company: CompanyRow;
  credentials: CredentialRow[];
  tasks: TaskRow[];
  schedules: ScheduleRow[];
  deadlines: DeadlineItem[];
}

function countValue(response: { count: number | null }) {
  return response.count ?? 0;
}

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function loadHomeData(): Promise<HomeData> {
  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);
  const plus30 = shiftDateString(today, 30);

  const [
    companies,
    due7,
    expire30,
    activeTasks,
    unread,
    overdueTotal,
    overdue,
    deadlines,
  ] = await Promise.all([
    supabase.from("company").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .gte("due_date", today)
      .lte("due_date", plus7),
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .eq("source", "credential")
      .gte("due_date", today)
      .lte("due_date", plus30),
    supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .neq("work_status", "completed"),
    supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today),
    supabase
      .from("deadline_item")
      .select("*")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("deadline_item")
      .select("*")
      .gte("due_date", today)
      .lte("due_date", plus7)
      .order("due_date", { ascending: true })
      .limit(12),
  ]);

  throwIfError("홈 데이터를 불러오지 못했습니다", companies.error ?? due7.error ?? expire30.error ?? activeTasks.error ?? unread.error ?? overdueTotal.error ?? overdue.error ?? deadlines.error);

  return {
    companyCount: countValue(companies),
    due7: countValue(due7),
    expire30: countValue(expire30),
    activeTasks: countValue(activeTasks),
    unreadCount: countValue(unread),
    overdueCount: countValue(overdueTotal),
    overdue: overdue.data ?? [],
    deadlines: deadlines.data ?? [],
  };
}

export async function loadNotifications(): Promise<NotificationItem[]> {
  const [notifications, companies] = await Promise.all([
    supabase
      .from("notification")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("company").select("id, name"),
  ]);
  throwIfError("알림을 불러오지 못했습니다", notifications.error ?? companies.error);

  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const refIds = [
    ...new Set((notifications.data ?? []).map((n) => n.ref_id).filter(Boolean)),
  ] as string[];
  const deadlines =
    refIds.length > 0
      ? await supabase.from("deadline_item").select("source, id, days_left").in("id", refIds)
      : { data: [], error: null };
  throwIfError("알림 D-day를 불러오지 못했습니다", deadlines.error);

  const daysLeft = new Map(
    (deadlines.data ?? []).map((d) => [`${d.source}:${d.id}`, d.days_left]),
  );

  return (notifications.data ?? []).map((n) => ({
    ...n,
    companyName: n.company_id ? companyName.get(n.company_id) ?? null : null,
    daysLeft:
      n.ref_table && n.ref_id
        ? daysLeft.get(`${n.ref_table}:${n.ref_id}`) ?? null
        : null,
  }));
}

export async function loadNotesForDate(date: string): Promise<TodoNoteRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const notes = await supabase
    .from("todo_note")
    .select("*")
    .eq("note_date", date || todayKstDate())
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });
  throwIfError("업무일지를 불러오지 못했습니다", notes.error);
  return notes.data ?? [];
}

export async function loadTasks(): Promise<MobileTask[]> {
  const [tasks, companies, categories] = await Promise.all([
    supabase.from("task").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("company").select("id, name"),
    supabase.from("category").select("id, name"),
  ]);
  throwIfError("Task를 불러오지 못했습니다", tasks.error ?? companies.error ?? categories.error);
  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  return (tasks.data ?? []).map((task) => ({
    ...task,
    companyName: companyName.get(task.company_id) ?? "-",
    categoryName: task.category_id ? categoryName.get(task.category_id) ?? null : null,
    daysLeft: daysFromDateString(task.due_date),
  }));
}

export async function loadTask(id: string): Promise<MobileTask | null> {
  const task = await supabase.from("task").select("*").eq("id", id).maybeSingle();
  throwIfError("Task를 불러오지 못했습니다", task.error);
  if (!task.data) return null;
  const [company, category] = await Promise.all([
    supabase.from("company").select("id, name").eq("id", task.data.company_id).maybeSingle(),
    task.data.category_id
      ? supabase.from("category").select("id, name").eq("id", task.data.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  throwIfError("Task 정보를 불러오지 못했습니다", company.error ?? category.error);
  return {
    ...task.data,
    companyName: company.data?.name ?? "-",
    categoryName: category.data?.name ?? null,
    daysLeft: daysFromDateString(task.data.due_date),
  };
}

export async function loadTaskFormOptions(): Promise<TaskFormOptions> {
  const [companies, categories] = await Promise.all([
    supabase
      .from("company")
      .select("id, name, industry, region")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("category")
      .select("id, name")
      .order("sort_order", { ascending: true }),
  ]);
  throwIfError("작성 정보를 불러오지 못했습니다", companies.error ?? categories.error);
  return {
    companies: companies.data ?? [],
    categories: categories.data ?? [],
  };
}

export async function loadCompanies(): Promise<CompanyListItem[]> {
  const [companies, deadlines] = await Promise.all([
    supabase
      .from("company")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("deadline_item")
      .select("company_id, days_left")
      .gte("due_date", todayKstDate()),
  ]);
  throwIfError("기업을 불러오지 못했습니다", companies.error ?? deadlines.error);

  const nearest = new Map<string, number>();
  for (const item of deadlines.data ?? []) {
    if (!item.company_id || item.days_left === null || item.days_left < 0) continue;
    const current = nearest.get(item.company_id);
    if (current === undefined || item.days_left < current) nearest.set(item.company_id, item.days_left);
  }

  return (companies.data ?? []).map((company) => ({
    ...company,
    nearestDaysLeft: nearest.get(company.id) ?? null,
  }));
}

export async function loadCompanyDetail(id: string): Promise<CompanyDetailData | null> {
  const [company, credentials, tasks, schedules, deadlines] = await Promise.all([
    supabase.from("company").select("*").eq("id", id).maybeSingle(),
    supabase.from("credential").select("*").eq("company_id", id).order("expires_date", { ascending: true, nullsFirst: false }),
    supabase.from("task").select("*").eq("company_id", id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("schedule").select("*").eq("company_id", id).order("date", { ascending: true }),
    supabase.from("deadline_item").select("*").eq("company_id", id).order("due_date", { ascending: true }).limit(10),
  ]);
  throwIfError("기업 상세를 불러오지 못했습니다", company.error ?? credentials.error ?? tasks.error ?? schedules.error ?? deadlines.error);
  if (!company.data) return null;
  return {
    company: company.data,
    credentials: credentials.data ?? [],
    tasks: tasks.data ?? [],
    schedules: schedules.data ?? [],
    deadlines: deadlines.data ?? [],
  };
}
