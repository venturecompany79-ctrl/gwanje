import { createClient } from "@/lib/supabase/server";
import { shiftDateString, todayKstDate } from "@/lib/datetime";
import type {
  CredentialStatus,
  DeadlineItem,
  IpDeadlineType,
  NotificationType,
  ScheduleType,
  TaskStage,
} from "@/lib/database.types";
import { DEMO_DASHBOARD } from "@/lib/demo-data";
import { formatKstMonthDay, formatKstTime } from "@/lib/datetime";
import { getMemberContext } from "@/lib/actions/shared";
import {
  DEMO_CONSULTANTS,
  type ConsultantOption,
} from "@/lib/data/consultants";
import { hasPermission } from "@/lib/permissions";

export interface DashboardKpi {
  companyCount: number;
  due7: number;
  expire30: number;
  activeTasks: number;
}

export interface DashboardAlert {
  id: string;
  type: NotificationType;
  urgent: boolean;
  title: string;
  sub: string | null;
  timeAgo: string;
  companyId: string | null;
  refTable: string | null;
  refId: string | null;
}

export interface DashboardFile {
  id: string;
  fileType: string;
  name: string;
  companyId: string;
  companyName: string;
  when: string;
}

/** deadline_item / notification 의 source·ref_table → 기업상세 탭 키 매핑 (credential은 탭키가 cert) */
const SOURCE_TAB: Record<string, string> = {
  credential: "cert",
  ip_deadline: "ip",
  task: "tasks",
  schedule: "schedule",
};

/** 마감 항목 → 이동 경로. company_id 없으면 null(비링크) */
export function deadlineHref(item: {
  company_id: string | null;
  source: string;
}): string | null {
  if (!item.company_id) return null;
  const tab = SOURCE_TAB[item.source];
  return tab
    ? `/app/companies/${item.company_id}?tab=${tab}`
    : `/app/companies/${item.company_id}`;
}

/** 알림 → 참조 대상 경로. 참조 불가 시 알림 센터로 폴백 */
export function notificationHref(alert: {
  refTable: string | null;
  refId?: string | null;
  companyId: string | null;
}): string {
  if (alert.refTable === "campaign") return "/app/campaigns";
  if (alert.companyId && alert.refTable === "gov_program") {
    const query = alert.refId ? `?program=${encodeURIComponent(alert.refId)}` : "";
    return `/app/companies/${alert.companyId}/gov-programs${query}`;
  }
  if (alert.companyId && alert.refTable && SOURCE_TAB[alert.refTable]) {
    return `/app/companies/${alert.companyId}?tab=${SOURCE_TAB[alert.refTable]}`;
  }
  if (alert.companyId) return `/app/companies/${alert.companyId}`;
  return "/app/notifications";
}

export interface DashboardData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  kpi: DashboardKpi;
  deadlines: DeadlineItem[];
  /** 기한이 지난(자격 만료·과제 마감 초과) 항목 — 가장 시급, 별도 강조 */
  overdue: DeadlineItem[];
  alerts: DashboardAlert[];
  files: DashboardFile[];
  unreadCount: number;
}

export type DashboardScope = "mine" | "team";
export type DashboardQueueFilter =
  | "all"
  | "overdue"
  | "due7"
  | "unassigned"
  | "active";
export type DashboardConsultantFilter = string | "unassigned" | null;
export type DashboardConsultantOption = ConsultantOption;

export interface DashboardQuery {
  scope: DashboardScope;
  consultantId: DashboardConsultantFilter;
  queueFilter: DashboardQueueFilter;
  /** 기존 KPI 딥링크와의 호환용 필터 */
  legacyDeadlineFilter: DeadlineFilter;
}

export interface DashboardRiskSummary {
  companyCount: number;
  overdue: number;
  due7: number;
  unassigned: number;
  activeTasks: number;
}

export type DashboardRiskSeverity =
  | "critical"
  | "warning"
  | "attention"
  | "neutral";

export interface DashboardQueueItem {
  id: string;
  source: DeadlineItem["source"];
  title: string;
  companyId: string | null;
  companyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  dueDate: string | null;
  daysLeft: number | null;
  status: string;
  severity: DashboardRiskSeverity;
  primaryConsultantId: string | null;
  primaryConsultantName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  href: string | null;
}

export interface ConsultantHealthRow {
  consultantId: string;
  consultantName: string;
  consultantTitle: string | null;
  companyCount: number;
  overdue: number;
  due7: number;
  activeTasks: number;
  unassigned: number;
}

export interface DashboardOverviewResult {
  demo: boolean;
  requestedScope: DashboardScope;
  scope: DashboardScope;
  canViewTeam: boolean;
  canUseAssistant: boolean;
  currentProfileId: string | null;
  risk: DashboardRiskSummary;
  consultants: DashboardConsultantOption[];
  mostOverdue: DeadlineItem | null;
  mostUrgent: DeadlineItem | null;
  lastUpdatedAt: string;
}

export interface DashboardQueueResult {
  demo: boolean;
  requestedScope: DashboardScope;
  scope: DashboardScope;
  filter: DashboardQueueFilter;
  items: DashboardQueueItem[];
}

export interface DashboardTeamResult {
  demo: boolean;
  canViewTeam: boolean;
  rows: ConsultantHealthRow[];
}

function formatTimeAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMin = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (diffMin < 5) return "방금";
  if (diffMin < 60) return `${diffMin}분`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간`;
  // 절대 시각·날짜는 KST 기준 표기 (운영 UTC와 무관하게 일관)
  if (diffHour < 48) return `어제 ${formatKstTime(then)}`;
  return formatKstMonthDay(then);
}

const DEADLINE_SOURCES = ["credential", "task", "schedule", "ip_deadline"] as const;
const DEADLINE_STATUSES = [
  "valid",
  "expiring",
  "expired",
  "diagnosis",
  "proposal",
  "application",
  "result",
  "expiry",
  "deadline",
  "meeting",
  "renewal",
  "office_action",
  "registration_fee",
  "annuity",
  "etc",
] as const;

const DEADLINE_SELECT =
  "category_id, category_name, company_id, company_name, days_left, due_date, id, primary_consultant_id, source, status, tenant_id, title";

function isDeadlineSource(value: string | null): value is DeadlineItem["source"] {
  return DEADLINE_SOURCES.some((source) => source === value);
}

function isDeadlineStatus(
  value: string | null,
): value is CredentialStatus | TaskStage | ScheduleType | IpDeadlineType {
  return DEADLINE_STATUSES.some((status) => status === value);
}

function normalizeDeadlineItems(rows: unknown[]): DeadlineItem[] {
  return rows.flatMap((row) => {
    const item = row as Partial<DeadlineItem> & {
      days_left?: number | null;
      due_date?: string | null;
      id?: string | null;
      source?: string | null;
      status?: string | null;
      tenant_id?: string | null;
      title?: string | null;
    };

    const source = item.source ?? null;
    const status = item.status ?? null;

    if (
      item.days_left === null ||
      item.days_left === undefined ||
      !item.due_date ||
      !item.id ||
      !isDeadlineSource(source) ||
      !isDeadlineStatus(status) ||
      !item.tenant_id ||
      !item.title
    ) {
      return [];
    }

    return [
      {
        category_id: item.category_id ?? null,
        category_name: item.category_name ?? null,
        company_id: item.company_id ?? null,
        company_name: item.company_name ?? null,
        days_left: item.days_left,
        due_date: item.due_date,
        id: item.id,
        primary_consultant_id: item.primary_consultant_id ?? null,
        source,
        status,
        tenant_id: item.tenant_id,
        title: item.title,
      },
    ];
  });
}

/** KPI 카드 딥링크용 마감 패널 필터 (GWJ-009) */
export type DeadlineFilter = "due7" | "expire30" | null;

export function parseDeadlineFilter(params: {
  due?: string;
  expire?: string;
}): DeadlineFilter {
  if (params.due === "7") return "due7";
  if (params.expire === "30") return "expire30";
  return null;
}

type DashboardSearchParams = {
  scope?: string | string[];
  consultant?: string | string[];
  risk?: string | string[];
  due?: string | string[];
  expire?: string | string[];
};

const DASHBOARD_QUEUE_FILTERS: DashboardQueueFilter[] = [
  "all",
  "overdue",
  "due7",
  "unassigned",
  "active",
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** URL의 관제 범위·담당자·KPI 필터를 허용 목록으로 정규화한다. */
export function parseDashboardSearchParams(
  params: DashboardSearchParams,
): DashboardQuery {
  const scope = firstParam(params.scope) === "team" ? "team" : "mine";
  const consultant = firstParam(params.consultant);
  const consultantId: DashboardConsultantFilter =
    consultant === "unassigned"
      ? "unassigned"
      : consultant && isUuid(consultant)
        ? consultant
        : null;
  const risk = firstParam(params.risk);
  const queueFilter = DASHBOARD_QUEUE_FILTERS.includes(
    risk as DashboardQueueFilter,
  )
    ? (risk as DashboardQueueFilter)
    : "all";

  return {
    scope,
    consultantId,
    queueFilter,
    legacyDeadlineFilter: parseDeadlineFilter({
      due: firstParam(params.due),
      expire: firstParam(params.expire),
    }),
  };
}

function normalizeDashboardQuery(
  query: Partial<DashboardQuery> = {},
): DashboardQuery {
  const scope: DashboardScope = query.scope === "team" ? "team" : "mine";
  const consultantId =
    query.consultantId === "unassigned"
      ? "unassigned"
      : typeof query.consultantId === "string" && isUuid(query.consultantId)
        ? query.consultantId
        : null;
  const queueFilter = DASHBOARD_QUEUE_FILTERS.includes(
    query.queueFilter as DashboardQueueFilter,
  )
    ? (query.queueFilter as DashboardQueueFilter)
    : "all";

  return {
    scope,
    consultantId,
    queueFilter,
    legacyDeadlineFilter: query.legacyDeadlineFilter ?? null,
  };
}

export const DEADLINE_FILTER_LABEL: Record<"due7" | "expire30", string> = {
  due7: "7일 내 마감",
  expire30: "30일 내 자격 만료",
};

// GWJ-019: 대시보드를 독립 로더 3개로 분리 → 각 패널을 Suspense로 스트리밍한다.
// (캐시는 도입하지 않음 — 매 요청 조회는 유지, 단지 블로킹을 패널 단위로 쪼갠다)

export interface DashboardKpiResult {
  demo: boolean;
  kpi: DashboardKpi;
  /** 헤드라인용 — 가장 시급한 기한 지남/임박 1건 (가벼운 limit 1 조회) */
  mostOverdue: DeadlineItem | null;
  mostUrgent: DeadlineItem | null;
}
export interface DashboardDeadlinesResult {
  deadlines: DeadlineItem[];
  overdue: DeadlineItem[];
}
export interface DashboardActivityResult {
  alerts: DashboardAlert[];
  files: DashboardFile[];
}

/** KPI 카운트 + 빈 상태 판단용 — head count 쿼리라 가볍다(레이아웃 분기 기준) */
export async function getDashboardKpi(): Promise<DashboardKpiResult> {
  const supabase = await createClient();
  if (!supabase) {
    const demo = DEMO_DASHBOARD();
    return {
      demo: true,
      kpi: demo.kpi,
      mostOverdue: demo.overdue[0] ?? null,
      mostUrgent: demo.deadlines[0] ?? null,
    };
  }

  // days_left(뷰 계산 컬럼) 대신 due_date 범위로 필터 → 인덱스 활용 (GWJ-019 ②).
  // KST today/경계는 deadline_item 뷰의 (now() at time zone 'Asia/Seoul')::date 와 동일 규칙.
  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);
  const plus30 = shiftDateString(today, 30);

  const [companyCount, due7, expire30, activeTasks, overdueTop, urgentTop] =
    await Promise.all([
      supabase
        .from("company")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
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
        .from("deadline_item")
        .select(DEADLINE_SELECT)
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(1),
      supabase
        .from("deadline_item")
        .select(DEADLINE_SELECT)
        .gte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(1),
    ]);

  const firstError =
    companyCount.error ??
    due7.error ??
    expire30.error ??
    activeTasks.error ??
    overdueTop.error ??
    urgentTop.error;
  if (firstError) {
    throw new Error(`대시보드 KPI를 불러오지 못했습니다: ${firstError.message}`);
  }

  return {
    demo: false,
    kpi: {
      companyCount: companyCount.count ?? 0,
      due7: due7.count ?? 0,
      expire30: expire30.count ?? 0,
      activeTasks: activeTasks.count ?? 0,
    },
    mostOverdue: normalizeDeadlineItems(overdueTop.data ?? [])[0] ?? null,
    mostUrgent: normalizeDeadlineItems(urgentTop.data ?? [])[0] ?? null,
  };
}

/** 마감 패널 — 다가오는(필터 반영) + 기한 지남 */
export async function getDashboardDeadlines(
  filter: DeadlineFilter = null,
): Promise<DashboardDeadlinesResult> {
  const supabase = await createClient();
  if (!supabase) {
    const demo = DEMO_DASHBOARD(filter);
    return { deadlines: demo.deadlines, overdue: filter ? [] : demo.overdue };
  }

  // days_left 대신 due_date 범위 필터 → 인덱스 활용 (GWJ-019 ②). KST 경계는 뷰와 동일.
  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);
  const plus30 = shiftDateString(today, 30);

  // 필터별 마감 패널 쿼리 — KPI 카운트와 동일한 조건으로 목록을 맞춘다 (GWJ-009)
  let deadlineQuery = supabase
    .from("deadline_item")
    .select(DEADLINE_SELECT)
    .gte("due_date", today)
    .order("due_date", { ascending: true });
  if (filter === "due7") {
    deadlineQuery = deadlineQuery.lte("due_date", plus7).limit(50);
  } else if (filter === "expire30") {
    deadlineQuery = deadlineQuery
      .eq("source", "credential")
      .lte("due_date", plus30)
      .limit(50);
  } else {
    deadlineQuery = deadlineQuery.limit(8);
  }

  const [deadlines, overdue] = await Promise.all([
    deadlineQuery,
    // 기한 지남 — 가장 오래된 것 먼저(가장 시급). 보드의 result 단계는 뷰에서 이미 제외됨.
    // 필터 적용 시엔 해당 조건 목록만 보여주므로 overdue는 비운다.
    filter
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("deadline_item")
          .select(DEADLINE_SELECT)
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(8),
  ]);

  const firstError = deadlines.error ?? overdue.error;
  if (firstError) {
    throw new Error(`마감 목록을 불러오지 못했습니다: ${firstError.message}`);
  }

  return {
    deadlines: normalizeDeadlineItems(deadlines.data ?? []),
    overdue: normalizeDeadlineItems(overdue.data ?? []),
  };
}

/** 우측 위젯 — 최근 알림 + 최근 자료 (현재 관제 범위의 기업만) */
export async function getDashboardActivity(
  input: Partial<DashboardQuery> = {},
): Promise<DashboardActivityResult> {
  const supabase = await createClient();
  if (!supabase) {
    const demo = DEMO_DASHBOARD();
    return { alerts: demo.alerts, files: demo.files };
  }

  const access = await resolveDashboardAccess(supabase, input);
  const companies = await getScopedCompanies(supabase, access);
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return { alerts: [], files: [] };

  const now = new Date();
  const [notifications, documents] = await Promise.all([
    supabase
      .from("notification")
      .select(
        "id, type, is_urgent, title, body, created_at, company_id, ref_table, ref_id",
      )
      .in("company_id", companyIds)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("document")
      .select("id, file_type, name, company_id, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const firstError = notifications.error ?? documents.error;
  if (firstError) {
    throw new Error(`대시보드 활동을 불러오지 못했습니다: ${firstError.message}`);
  }

  // 이미 조회한 관제 기업으로 문서의 기업명을 매핑한다.
  const docRows = documents.data ?? [];
  const companyNames = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  return {
    alerts: (notifications.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      urgent: n.is_urgent,
      title: n.title,
      sub: n.body,
      timeAgo: formatTimeAgo(n.created_at, now),
      companyId: n.company_id,
      refTable: n.ref_table,
      refId: n.ref_id,
    })),
    files: docRows.map((d) => ({
      id: d.id,
      fileType: d.file_type ?? "파일",
      name: d.name,
      companyId: d.company_id,
      companyName: companyNames.get(d.company_id) ?? "—",
      when: formatTimeAgo(d.created_at, now),
    })),
  };
}

type DashboardSupabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

interface DashboardAccess {
  requestedScope: DashboardScope;
  scope: DashboardScope;
  canViewTeam: boolean;
  canUseAssistant: boolean;
  currentProfileId: string;
  consultantId: DashboardConsultantFilter;
  queueFilter: DashboardQueueFilter;
}

interface ScopedCompany {
  id: string;
  name: string;
  primary_consultant_id: string | null;
}

async function resolveDashboardAccess(
  supabase: DashboardSupabase,
  input: Partial<DashboardQuery> = {},
): Promise<DashboardAccess> {
  const query = normalizeDashboardQuery(input);
  const member = await getMemberContext(supabase);
  if ("error" in member) throw new Error(member.error);

  const canViewTeam = member.role === "owner" || member.role === "manager";
  const scope: DashboardScope =
    query.scope === "team" && canViewTeam ? "team" : "mine";

  return {
    requestedScope: query.scope,
    scope,
    canViewTeam,
    canUseAssistant: hasPermission(member, "ai.assistant.use"),
    currentProfileId: member.userId,
    consultantId: scope === "team" ? query.consultantId : member.userId,
    queueFilter: query.queueFilter,
  };
}

async function getScopedCompanies(
  supabase: DashboardSupabase,
  access: DashboardAccess,
): Promise<ScopedCompany[]> {
  let request = supabase
    .from("company")
    .select("id, name, primary_consultant_id")
    .eq("status", "active")
    .order("name")
    .order("id");

  if (access.consultantId === "unassigned") {
    request = request.is("primary_consultant_id", null);
  } else if (access.consultantId) {
    request = request.eq("primary_consultant_id", access.consultantId);
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`관제 대상 기업을 불러오지 못했습니다: ${error.message}`);
  }
  return data ?? [];
}

function severityFor(
  daysLeft: number | null,
  unassigned: boolean,
): DashboardRiskSeverity {
  if (daysLeft !== null && daysLeft < 0) return "critical";
  if (daysLeft !== null && daysLeft <= 3) return "warning";
  if (unassigned || (daysLeft !== null && daysLeft <= 7)) return "attention";
  return "neutral";
}

const SEVERITY_ORDER: Record<DashboardRiskSeverity, number> = {
  critical: 0,
  warning: 1,
  attention: 2,
  neutral: 3,
};

function sortQueueItems(items: DashboardQueueItem[]): DashboardQueueItem[] {
  return items.sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    const due =
      (a.daysLeft ?? Number.MAX_SAFE_INTEGER) -
      (b.daysLeft ?? Number.MAX_SAFE_INTEGER);
    if (due !== 0) return due;
    const company = (a.companyName ?? "").localeCompare(
      b.companyName ?? "",
      "ko",
    );
    return company !== 0 ? company : a.title.localeCompare(b.title, "ko");
  });
}

function demoQueueItem(
  item: DeadlineItem,
  index: number,
): DashboardQueueItem {
  const consultant = DEMO_CONSULTANTS[index % DEMO_CONSULTANTS.length];
  const unassigned = item.source === "task" && index % 3 === 1;
  return {
    id: item.id,
    source: item.source,
    title: item.title,
    companyId: item.company_id,
    companyName: item.company_name,
    categoryId: item.category_id,
    categoryName: item.category_name,
    dueDate: item.due_date,
    daysLeft: item.days_left,
    status: item.status,
    severity: severityFor(item.days_left, unassigned),
    primaryConsultantId: consultant.id,
    primaryConsultantName: consultant.name,
    assigneeId: item.source === "task" && !unassigned ? consultant.id : null,
    assigneeName:
      item.source === "task" && !unassigned ? consultant.name : null,
    href: deadlineHref(item),
  };
}

function demoOverview(query: DashboardQuery): DashboardOverviewResult {
  const dashboard = DEMO_DASHBOARD();
  const all = [...dashboard.overdue, ...dashboard.deadlines];
  return {
    demo: true,
    requestedScope: query.scope,
    scope: query.scope,
    canViewTeam: true,
    canUseAssistant: true,
    currentProfileId: DEMO_CONSULTANTS[0].id,
    risk: {
      companyCount: query.scope === "mine" ? 6 : dashboard.kpi.companyCount,
      overdue: dashboard.overdue.length,
      due7: all.filter((item) => item.days_left >= 0 && item.days_left <= 7)
        .length,
      unassigned: 2,
      activeTasks: query.scope === "mine" ? 9 : dashboard.kpi.activeTasks,
    },
    consultants: DEMO_CONSULTANTS,
    mostOverdue: dashboard.overdue[0] ?? null,
    mostUrgent:
      dashboard.deadlines.find((item) => item.days_left >= 0) ?? null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/** 관제 헤더·KPI에 필요한 가벼운 집계 로더. */
export async function getDashboardOverview(
  input: Partial<DashboardQuery> = {},
): Promise<DashboardOverviewResult> {
  const query = normalizeDashboardQuery(input);
  const supabase = await createClient();
  if (!supabase) return demoOverview(query);

  const access = await resolveDashboardAccess(supabase, query);
  const [companies, profiles] = await Promise.all([
    getScopedCompanies(supabase, access),
    supabase
      .from("profile")
      .select("id, name, title")
      .eq("status", "active")
      .order("name")
      .order("id"),
  ]);
  if (profiles.error) {
    throw new Error(`컨설턴트 목록을 불러오지 못했습니다: ${profiles.error.message}`);
  }

  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) {
    return {
      demo: false,
      requestedScope: access.requestedScope,
      scope: access.scope,
      canViewTeam: access.canViewTeam,
      canUseAssistant: access.canUseAssistant,
      currentProfileId: access.currentProfileId,
      risk: {
        companyCount: 0,
        overdue: 0,
        due7: 0,
        unassigned: 0,
        activeTasks: 0,
      },
      consultants: profiles.data ?? [],
      mostOverdue: null,
      mostUrgent: null,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);
  const [overdue, due7, activeTasks, unassigned, overdueTop, urgentTop] =
    await Promise.all([
      supabase
        .from("deadline_item")
        .select("id", { count: "exact", head: true })
        .in("company_id", companyIds)
        .lt("due_date", today),
      supabase
        .from("deadline_item")
        .select("id", { count: "exact", head: true })
        .in("company_id", companyIds)
        .gte("due_date", today)
        .lte("due_date", plus7),
      supabase
        .from("task")
        .select("id", { count: "exact", head: true })
        .in("company_id", companyIds)
        .neq("work_status", "completed"),
      supabase
        .from("task")
        .select("id", { count: "exact", head: true })
        .in("company_id", companyIds)
        .neq("work_status", "completed")
        .is("assignee_id", null),
      supabase
        .from("deadline_item")
        .select(DEADLINE_SELECT)
        .in("company_id", companyIds)
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(1),
      supabase
        .from("deadline_item")
        .select(DEADLINE_SELECT)
        .in("company_id", companyIds)
        .gte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(1),
    ]);

  const firstError =
    overdue.error ??
    due7.error ??
    activeTasks.error ??
    unassigned.error ??
    overdueTop.error ??
    urgentTop.error;
  if (firstError) {
    throw new Error(`대시보드 현황을 불러오지 못했습니다: ${firstError.message}`);
  }

  return {
    demo: false,
    requestedScope: access.requestedScope,
    scope: access.scope,
    canViewTeam: access.canViewTeam,
    canUseAssistant: access.canUseAssistant,
    currentProfileId: access.currentProfileId,
    risk: {
      companyCount: companies.length,
      overdue: overdue.count ?? 0,
      due7: due7.count ?? 0,
      unassigned: unassigned.count ?? 0,
      activeTasks: activeTasks.count ?? 0,
    },
    consultants: profiles.data ?? [],
    mostOverdue: normalizeDeadlineItems(overdueTop.data ?? [])[0] ?? null,
    mostUrgent: normalizeDeadlineItems(urgentTop.data ?? [])[0] ?? null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/** 위험도·기한·미배정 상태를 한 행 형식으로 통합한 우선 처리 큐. */
export async function getDashboardQueue(
  input: Partial<DashboardQuery> = {},
): Promise<DashboardQueueResult> {
  const query = normalizeDashboardQuery(input);
  const supabase = await createClient();
  if (!supabase) {
    const dashboard = DEMO_DASHBOARD();
    let items = [...dashboard.overdue, ...dashboard.deadlines].map(demoQueueItem);
    if (query.queueFilter === "overdue") {
      items = items.filter((item) => (item.daysLeft ?? 0) < 0);
    } else if (query.queueFilter === "due7") {
      items = items.filter(
        (item) => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 7,
      );
    } else if (query.queueFilter === "unassigned") {
      items = items.filter((item) => item.source === "task" && !item.assigneeId);
    } else if (query.queueFilter === "active") {
      items = items.filter((item) => item.source === "task");
    }
    return {
      demo: true,
      requestedScope: query.scope,
      scope: query.scope,
      filter: query.queueFilter,
      items: sortQueueItems(items),
    };
  }

  const access = await resolveDashboardAccess(supabase, query);
  const companies = await getScopedCompanies(supabase, access);
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) {
    return {
      demo: false,
      requestedScope: access.requestedScope,
      scope: access.scope,
      filter: access.queueFilter,
      items: [],
    };
  }

  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);
  let deadlineRequest = supabase
    .from("deadline_item")
    .select(DEADLINE_SELECT)
    .in("company_id", companyIds)
    .order("due_date", { ascending: true })
    .limit(500);
  if (access.queueFilter === "overdue") {
    deadlineRequest = deadlineRequest.lt("due_date", today);
  } else if (access.queueFilter === "due7") {
    deadlineRequest = deadlineRequest
      .gte("due_date", today)
      .lte("due_date", plus7);
  } else {
    deadlineRequest = deadlineRequest.lte("due_date", plus7);
  }

  const [deadlines, tasks, profiles, categories] = await Promise.all([
    deadlineRequest,
    supabase
      .from("task")
      .select(
        "id, title, company_id, category_id, stage, work_status, due_date, assignee_id",
      )
      .in("company_id", companyIds)
      .neq("work_status", "completed")
      .limit(500),
    supabase
      .from("profile")
      .select("id, name")
      .eq("status", "active"),
    supabase.from("category").select("id, name"),
  ]);
  const firstError =
    deadlines.error ?? tasks.error ?? profiles.error ?? categories.error;
  if (firstError) {
    throw new Error(`우선 처리 큐를 불러오지 못했습니다: ${firstError.message}`);
  }

  const deadlineItems = normalizeDeadlineItems(deadlines.data ?? []);
  const taskById = new Map((tasks.data ?? []).map((task) => [task.id, task]));
  const consultantName = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.name]),
  );
  const categoryName = new Map(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );
  const companyById = new Map(companies.map((company) => [company.id, company]));

  let items: DashboardQueueItem[] = deadlineItems.map((item) => {
    const task = item.source === "task" ? taskById.get(item.id) : undefined;
    const company = item.company_id ? companyById.get(item.company_id) : undefined;
    const unassigned = item.source === "task" && !task?.assignee_id;
    return {
      id: item.id,
      source: item.source,
      title: item.title,
      companyId: item.company_id,
      companyName: item.company_name,
      categoryId: item.category_id,
      categoryName: item.category_name,
      dueDate: item.due_date,
      daysLeft: item.days_left,
      status: item.status,
      severity: severityFor(item.days_left, unassigned),
      primaryConsultantId: company?.primary_consultant_id ?? null,
      primaryConsultantName: company?.primary_consultant_id
        ? (consultantName.get(company.primary_consultant_id) ?? null)
        : null,
      assigneeId: task?.assignee_id ?? null,
      assigneeName: task?.assignee_id
        ? (consultantName.get(task.assignee_id) ?? null)
        : null,
      href: deadlineHref(item),
    };
  });

  if (access.queueFilter === "unassigned") {
    items = items.filter((item) => item.source === "task" && !item.assigneeId);
  } else if (access.queueFilter === "active") {
    items = items.filter((item) => item.source === "task");
  }

  const includedTaskIds = new Set(
    items.filter((item) => item.source === "task").map((item) => item.id),
  );
  const shouldAppendTask = (task: NonNullable<typeof tasks.data>[number]) => {
    if (includedTaskIds.has(task.id)) return false;
    if (access.queueFilter === "active") return true;
    if (access.queueFilter === "unassigned" || access.queueFilter === "all") {
      return task.assignee_id === null;
    }
    return false;
  };

  for (const task of (tasks.data ?? []).filter(shouldAppendTask)) {
    const company = companyById.get(task.company_id);
    const daysLeft = task.due_date
      ? Math.round(
          (new Date(`${task.due_date}T00:00:00+09:00`).getTime() -
            new Date(`${today}T00:00:00+09:00`).getTime()) /
            86_400_000,
        )
      : null;
    items.push({
      id: task.id,
      source: "task",
      title: task.title,
      companyId: task.company_id,
      companyName: company?.name ?? null,
      categoryId: task.category_id,
      categoryName: task.category_id
        ? (categoryName.get(task.category_id) ?? null)
        : null,
      dueDate: task.due_date,
      daysLeft,
      status: task.stage,
      severity: severityFor(daysLeft, task.assignee_id === null),
      primaryConsultantId: company?.primary_consultant_id ?? null,
      primaryConsultantName: company?.primary_consultant_id
        ? (consultantName.get(company.primary_consultant_id) ?? null)
        : null,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_id
        ? (consultantName.get(task.assignee_id) ?? null)
        : null,
      href: `/app/companies/${task.company_id}?tab=tasks`,
    });
  }

  return {
    demo: false,
    requestedScope: access.requestedScope,
    scope: access.scope,
    filter: access.queueFilter,
    items: sortQueueItems(items).slice(0, 200),
  };
}

function demoTeamRows(): ConsultantHealthRow[] {
  return [
    {
      consultantId: DEMO_CONSULTANTS[0].id,
      consultantName: DEMO_CONSULTANTS[0].name,
      consultantTitle: DEMO_CONSULTANTS[0].title,
      companyCount: 6,
      overdue: 1,
      due7: 3,
      activeTasks: 9,
      unassigned: 1,
    },
    {
      consultantId: DEMO_CONSULTANTS[1].id,
      consultantName: DEMO_CONSULTANTS[1].name,
      consultantTitle: DEMO_CONSULTANTS[1].title,
      companyCount: 5,
      overdue: 0,
      due7: 1,
      activeTasks: 8,
      unassigned: 0,
    },
    {
      consultantId: DEMO_CONSULTANTS[2].id,
      consultantName: DEMO_CONSULTANTS[2].name,
      consultantTitle: DEMO_CONSULTANTS[2].title,
      companyCount: 3,
      overdue: 0,
      due7: 1,
      activeTasks: 5,
      unassigned: 1,
    },
  ];
}

/** 관리자용 컨설턴트별 관제 건강도. 일반 멤버는 행을 반환하지 않는다. */
export async function getDashboardTeam(
  input: Partial<DashboardQuery> = {},
): Promise<DashboardTeamResult> {
  const supabase = await createClient();
  if (!supabase) return { demo: true, canViewTeam: true, rows: demoTeamRows() };

  const access = await resolveDashboardAccess(supabase, {
    ...normalizeDashboardQuery(input),
    scope: "team",
  });
  if (!access.canViewTeam) {
    return { demo: false, canViewTeam: false, rows: [] };
  }

  const today = todayKstDate();
  const plus7 = shiftDateString(today, 7);
  const [profiles, companies, deadlines, tasks] = await Promise.all([
    supabase
      .from("profile")
      .select("id, name, title")
      .eq("status", "active")
      .order("name")
      .order("id"),
    supabase
      .from("company")
      .select("id, primary_consultant_id")
      .eq("status", "active"),
    supabase
      .from("deadline_item")
      .select("company_id, days_left, primary_consultant_id")
      .lte("due_date", plus7),
    supabase
      .from("task")
      .select("company_id, assignee_id")
      .neq("work_status", "completed"),
  ]);
  const firstError =
    profiles.error ?? companies.error ?? deadlines.error ?? tasks.error;
  if (firstError) {
    throw new Error(`팀 관제 현황을 불러오지 못했습니다: ${firstError.message}`);
  }

  const companyData = companies.data ?? [];
  const deadlineData = deadlines.data ?? [];
  const taskData = tasks.data ?? [];
  const rows: ConsultantHealthRow[] = (profiles.data ?? []).map((profile) => {
    const companyIds = new Set(
      companyData
        .filter((company) => company.primary_consultant_id === profile.id)
        .map((company) => company.id),
    );
    const consultantDeadlines = deadlineData.filter(
      (deadline) => deadline.primary_consultant_id === profile.id,
    );
    const consultantTasks = taskData.filter((task) => companyIds.has(task.company_id));
    return {
      consultantId: profile.id,
      consultantName: profile.name,
      consultantTitle: profile.title,
      companyCount: companyIds.size,
      overdue: consultantDeadlines.filter(
        (deadline) => (deadline.days_left ?? 0) < 0,
      ).length,
      due7: consultantDeadlines.filter(
        (deadline) =>
          deadline.days_left !== null &&
          deadline.days_left >= 0 &&
          deadline.days_left <= 7,
      ).length,
      activeTasks: consultantTasks.length,
      unassigned: consultantTasks.filter((task) => task.assignee_id === null).length,
    };
  });

  const unassignedCompanyIds = new Set(
    companyData
      .filter((company) => company.primary_consultant_id === null)
      .map((company) => company.id),
  );
  if (unassignedCompanyIds.size > 0) {
    const unassignedDeadlines = deadlineData.filter(
      (deadline) => deadline.primary_consultant_id === null,
    );
    const unassignedTasks = taskData.filter((task) =>
      unassignedCompanyIds.has(task.company_id),
    );
    rows.push({
      consultantId: "unassigned",
      consultantName: "미배정",
      consultantTitle: "주담당자 지정 필요",
      companyCount: unassignedCompanyIds.size,
      overdue: unassignedDeadlines.filter(
        (deadline) => (deadline.days_left ?? 0) < 0,
      ).length,
      due7: unassignedDeadlines.filter(
        (deadline) =>
          deadline.days_left !== null &&
          deadline.days_left >= 0 &&
          deadline.days_left <= 7,
      ).length,
      activeTasks: unassignedTasks.length,
      unassigned: unassignedTasks.filter((task) => task.assignee_id === null).length,
    });
  }

  rows.sort((a, b) => {
    if (a.consultantId === "unassigned") return -1;
    if (b.consultantId === "unassigned") return 1;
    if (a.overdue !== b.overdue) return b.overdue - a.overdue;
    if (a.due7 !== b.due7) return b.due7 - a.due7;
    return a.consultantName.localeCompare(b.consultantName, "ko");
  });

  return { demo: false, canViewTeam: true, rows };
}
