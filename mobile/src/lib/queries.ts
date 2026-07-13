import type { Database } from "@root/lib/database.types";
import { supabase } from "@/lib/supabase";
import { daysFromDateString, shiftDateString, todayKstDate } from "@/lib/dates";

type DeadlineRow = Database["public"]["Views"]["deadline_item"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];
type CompanyTableRow = Database["public"]["Tables"]["company"]["Row"];
type TaskTableRow = Database["public"]["Tables"]["task"]["Row"];
type TodoNoteTableRow = Database["public"]["Tables"]["todo_note"]["Row"];
type CredentialTableRow = Database["public"]["Tables"]["credential"]["Row"];

export type TaskStage = Database["public"]["Enums"]["task_stage"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];

export type DeadlineItem = Pick<
  DeadlineRow,
  "company_id" | "company_name" | "days_left" | "due_date" | "id" | "source" | "title"
>;
export type TodoNoteRow = Pick<
  TodoNoteTableRow,
  "completed" | "content" | "created_at" | "id" | "sort_order" | "tag"
>;
export type TaskRow = Pick<
  TaskTableRow,
  "category_id" | "company_id" | "due_date" | "id" | "memo" | "stage" | "title"
>;
type TaskListRow = Pick<
  TaskTableRow,
  "company_id" | "due_date" | "id" | "stage" | "title"
>;
export type CompanyRow = Pick<
  CompanyTableRow,
  | "ceo_name"
  | "contact_email"
  | "contact_name"
  | "contact_phone"
  | "id"
  | "industry"
  | "name"
  | "region"
>;
export type CredentialRow = Pick<CredentialTableRow, "id" | "type">;

export const MOBILE_PAGE_SIZE = 30;

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
}

export interface HomeData {
  due7: number;
  activeTasks: number;
  /** 기한 지남 총 건수 — overdue 목록은 8건으로 잘리므로 KPI는 이 값을 쓴다 */
  overdueCount: number;
  overdue: DeadlineItem[];
  deadlines: DeadlineItem[];
}

export type NotificationItem = Pick<
  NotificationRow,
  "created_at" | "id" | "is_read" | "is_urgent" | "title" | "type"
> & {
  companyName: string | null;
};

export interface MobileTask extends TaskRow {
  companyName: string;
  daysLeft: number | null;
}

export type CompanyListItem = Pick<
  CompanyTableRow,
  "contact_name" | "id" | "industry" | "name" | "region"
> & {
  nearestDaysLeft: number | null;
};

export interface TaskListItem extends TaskListRow {
  companyName: string;
  daysLeft: number | null;
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
  categories: CategoryOption[];
}

export interface CompanyOptionPageOptions {
  offset?: number;
  query?: string;
}

export interface CompanyDetailData {
  company: CompanyRow;
  credentials: CredentialRow[];
  tasks: Pick<TaskTableRow, "due_date" | "id" | "stage" | "title">[];
  deadlines: Pick<
    DeadlineRow,
    "days_left" | "due_date" | "id" | "source" | "title"
  >[];
}

export interface TaskSummary {
  activeCount: number;
  overdueCount: number;
}

export interface NotificationSummary {
  unreadCount: number;
}

export interface TaskPageOptions {
  offset?: number;
  stage?: TaskStage;
}

export interface CompanyPageOptions {
  offset?: number;
  query?: string;
}

export interface NotificationPageOptions {
  offset?: number;
  type?: NotificationType;
}

function countValue(response: { count: number | null }) {
  return response.count ?? 0;
}

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function normalizeOffset(offset: number | undefined) {
  return Number.isFinite(offset) ? Math.max(0, Math.floor(offset ?? 0)) : 0;
}

function pageResult<T>(items: T[], hasMore: boolean): PageResult<T> {
  return {
    items,
    hasMore,
  };
}

/** PostgREST의 raw `or` 구문 안에서 검색어를 하나의 quoted value로 유지한다. */
function quotedIlikePattern(query: string) {
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

export async function loadHomeData(): Promise<HomeData> {
  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);

  const [due7, activeTasks, overdueTotal, overdue, deadlines] = await Promise.all([
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .gte("due_date", today)
      .lte("due_date", plus7),
    supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .neq("stage", "result"),
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today),
    supabase
      .from("deadline_item")
      .select("company_id, company_name, days_left, due_date, id, source, title")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("deadline_item")
      .select("company_id, company_name, days_left, due_date, id, source, title")
      .gte("due_date", today)
      .lte("due_date", plus7)
      .order("due_date", { ascending: true })
      .limit(12),
  ]);

  throwIfError(
    "홈 데이터를 불러오지 못했습니다",
    due7.error ?? activeTasks.error ?? overdueTotal.error ?? overdue.error ?? deadlines.error,
  );

  return {
    due7: countValue(due7),
    activeTasks: countValue(activeTasks),
    overdueCount: countValue(overdueTotal),
    overdue: overdue.data ?? [],
    deadlines: deadlines.data ?? [],
  };
}

export async function loadNotificationsPage({
  offset: rawOffset,
  type,
}: NotificationPageOptions = {}): Promise<PageResult<NotificationItem>> {
  const offset = normalizeOffset(rawOffset);
  let notificationsQuery = supabase
    .from("notification")
    .select("company_id, created_at, id, is_read, is_urgent, title, type")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + MOBILE_PAGE_SIZE);
  if (type) notificationsQuery = notificationsQuery.eq("type", type);

  const notifications = await notificationsQuery;
  throwIfError("알림을 불러오지 못했습니다", notifications.error);

  const notificationRows = (notifications.data ?? []).slice(0, MOBILE_PAGE_SIZE);
  const companyIds = [...new Set(notificationRows.flatMap((item) => item.company_id ?? []))];
  const companies =
    companyIds.length > 0
      ? await supabase.from("company").select("id, name").in("id", companyIds)
      : { data: [], error: null };
  throwIfError("알림의 기업 정보를 불러오지 못했습니다", companies.error);

  const companyNames = new Map((companies.data ?? []).map((company) => [company.id, company.name]));
  const items = notificationRows.map((notification) => ({
    created_at: notification.created_at,
    id: notification.id,
    is_read: notification.is_read,
    is_urgent: notification.is_urgent,
    title: notification.title,
    type: notification.type,
    companyName: notification.company_id
      ? companyNames.get(notification.company_id) ?? null
      : null,
  }));

  return pageResult(items, (notifications.data?.length ?? 0) > MOBILE_PAGE_SIZE);
}

export async function loadNotificationSummary(): Promise<NotificationSummary> {
  const unread = await supabase
    .from("notification")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  throwIfError("알림 요약을 불러오지 못했습니다", unread.error);
  return { unreadCount: countValue(unread) };
}

export async function loadNotesForDate(date: string): Promise<TodoNoteRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const notes = await supabase
    .from("todo_note")
    .select("completed, content, created_at, id, sort_order, tag")
    .eq("note_date", date || todayKstDate())
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });
  throwIfError("업무일지를 불러오지 못했습니다", notes.error);
  return notes.data ?? [];
}

export async function loadTasksPage({
  offset: rawOffset,
  stage,
}: TaskPageOptions = {}): Promise<PageResult<TaskListItem>> {
  const offset = normalizeOffset(rawOffset);
  let taskRows: TaskListRow[];
  let hasMore: boolean;

  if (stage) {
    const tasks = await supabase
      .from("task")
      .select("company_id, due_date, id, stage, title")
      .eq("stage", stage)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + MOBILE_PAGE_SIZE);
    throwIfError("Task를 불러오지 못했습니다", tasks.error);
    const rawRows = tasks.data ?? [];
    taskRows = rawRows.slice(0, MOBILE_PAGE_SIZE);
    hasMore = rawRows.length > MOBILE_PAGE_SIZE;
  } else {
    const activeTasks = await supabase
      .from("task")
      .select("company_id, due_date, id, stage, title", {
        count: "exact",
      })
      .neq("stage", "result")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + MOBILE_PAGE_SIZE);
    throwIfError("Task를 불러오지 못했습니다", activeTasks.error);

    const activeRows = activeTasks.data ?? [];
    const activeTotal = activeTasks.count ?? activeRows.length;
    const remaining = MOBILE_PAGE_SIZE + 1 - activeRows.length;
    const completedOffset = Math.max(0, offset - activeTotal);
    const completedTasks =
      remaining > 0
        ? await supabase
            .from("task")
            .select("company_id, due_date, id, stage, title")
            .eq("stage", "result")
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true })
            .range(completedOffset, completedOffset + remaining - 1)
        : { data: [], error: null };
    throwIfError("완료 Task를 불러오지 못했습니다", completedTasks.error);

    const rawRows = [...activeRows, ...(completedTasks.data ?? [])];
    taskRows = rawRows.slice(0, MOBILE_PAGE_SIZE);
    hasMore = rawRows.length > MOBILE_PAGE_SIZE;
  }

  const companyIds = [...new Set(taskRows.map((task) => task.company_id))];
  const companies =
    companyIds.length > 0
      ? await supabase.from("company").select("id, name").in("id", companyIds)
      : { data: [], error: null };
  throwIfError("Task 기업 정보를 불러오지 못했습니다", companies.error);

  const companyNames = new Map((companies.data ?? []).map((company) => [company.id, company.name]));
  const items = taskRows.map((task) => ({
    ...task,
    companyName: companyNames.get(task.company_id) ?? "-",
    daysLeft: daysFromDateString(task.due_date),
  }));

  return pageResult(items, hasMore);
}

export async function loadTaskSummary(): Promise<TaskSummary> {
  const today = todayKstDate();
  const [active, overdue] = await Promise.all([
    supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .neq("stage", "result"),
    supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .neq("stage", "result")
      .lt("due_date", today),
  ]);
  throwIfError("Task 요약을 불러오지 못했습니다", active.error ?? overdue.error);
  return {
    activeCount: countValue(active),
    overdueCount: countValue(overdue),
  };
}

export async function loadTask(id: string): Promise<MobileTask | null> {
  const task = await supabase
    .from("task")
    .select("category_id, company_id, due_date, id, memo, stage, title")
    .eq("id", id)
    .maybeSingle();
  throwIfError("Task를 불러오지 못했습니다", task.error);
  if (!task.data) return null;
  const company = await supabase
    .from("company")
    .select("id, name")
    .eq("id", task.data.company_id)
    .maybeSingle();
  throwIfError("Task 기업 정보를 불러오지 못했습니다", company.error);
  return {
    ...task.data,
    companyName: company.data?.name ?? "-",
    daysLeft: daysFromDateString(task.data.due_date),
  };
}

export async function loadTaskFormOptions(): Promise<TaskFormOptions> {
  const categories = await supabase
    .from("category")
    .select("id, name")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  throwIfError("분류 정보를 불러오지 못했습니다", categories.error);
  return {
    categories: categories.data ?? [],
  };
}

export async function loadCompanyOptionsPage({
  offset: rawOffset,
  query,
}: CompanyOptionPageOptions = {}): Promise<PageResult<CompanyOption>> {
  const offset = normalizeOffset(rawOffset);
  const normalizedQuery = query?.trim();
  let companiesQuery = supabase
    .from("company")
    .select("id, name, industry, region")
    .eq("status", "active")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + MOBILE_PAGE_SIZE);

  if (normalizedQuery) {
    const pattern = quotedIlikePattern(normalizedQuery);
    companiesQuery = companiesQuery.or(
      ["name", "industry", "region"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(","),
    );
  }

  const companies = await companiesQuery;
  throwIfError("기업을 불러오지 못했습니다", companies.error);
  const rawItems = companies.data ?? [];
  return pageResult(
    rawItems.slice(0, MOBILE_PAGE_SIZE),
    rawItems.length > MOBILE_PAGE_SIZE,
  );
}

export async function loadCompaniesPage({
  offset: rawOffset,
  query,
}: CompanyPageOptions = {}): Promise<PageResult<CompanyListItem>> {
  const offset = normalizeOffset(rawOffset);
  const normalizedQuery = query?.trim();
  let companiesQuery = supabase
    .from("company")
    .select("contact_name, id, industry, name, region")
    .eq("status", "active")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + MOBILE_PAGE_SIZE);
  if (normalizedQuery) {
    const pattern = quotedIlikePattern(normalizedQuery);
    companiesQuery = companiesQuery.or(
      ["name", "industry", "region", "contact_name", "ceo_name"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(","),
    );
  }

  const companies = await companiesQuery;
  throwIfError("기업을 불러오지 못했습니다", companies.error);

  const rawCompanies = companies.data ?? [];
  const companyRows = rawCompanies.slice(0, MOBILE_PAGE_SIZE);
  const companyIds = companyRows.map((company) => company.id);
  const stats =
    companyIds.length > 0
      ? await supabase.rpc("get_company_list_stats", {
          p_company_ids: companyIds,
          p_today: todayKstDate(),
          p_upcoming_window_days: 365,
        })
      : { data: [], error: null };
  throwIfError("기업 마감 정보를 불러오지 못했습니다", stats.error);

  const nearestByCompany = new Map(
    (stats.data ?? []).map((item) => [item.company_id, item.nearest_days_left]),
  );
  const items = companyRows.map((company) => ({
    ...company,
    nearestDaysLeft: nearestByCompany.get(company.id) ?? null,
  }));

  return pageResult(items, rawCompanies.length > MOBILE_PAGE_SIZE);
}

export async function loadCompanyDetail(id: string): Promise<CompanyDetailData | null> {
  const today = todayKstDate();
  const [company, credentials, tasks, deadlines] = await Promise.all([
    supabase
      .from("company")
      .select("ceo_name, contact_email, contact_name, contact_phone, id, industry, name, region")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("credential")
      .select("id, type")
      .eq("company_id", id)
      .order("expires_date", { ascending: true, nullsFirst: false })
      .limit(10),
    supabase
      .from("task")
      .select("due_date, id, stage, title")
      .eq("company_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(10),
    supabase
      .from("deadline_item")
      .select("days_left, due_date, id, source, title")
      .eq("company_id", id)
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(10),
  ]);
  throwIfError(
    "기업 상세를 불러오지 못했습니다",
    company.error ?? credentials.error ?? tasks.error ?? deadlines.error,
  );
  if (!company.data) return null;
  return {
    company: company.data,
    credentials: credentials.data ?? [],
    tasks: tasks.data ?? [],
    deadlines: deadlines.data ?? [],
  };
}
