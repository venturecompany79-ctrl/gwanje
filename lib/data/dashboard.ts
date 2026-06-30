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
  companyId: string | null;
}): string {
  if (alert.refTable === "campaign") return "/app/campaigns";
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
  "category_id, category_name, company_id, company_name, days_left, due_date, id, source, status, tenant_id, title";

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
      supabase.from("company").select("id", { count: "exact", head: true }),
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
        .neq("stage", "result"),
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

/** 우측 위젯 — 최근 알림 + 최근 자료 */
export async function getDashboardActivity(): Promise<DashboardActivityResult> {
  const supabase = await createClient();
  if (!supabase) {
    const demo = DEMO_DASHBOARD();
    return { alerts: demo.alerts, files: demo.files };
  }

  const now = new Date();
  const [notifications, documents] = await Promise.all([
    supabase
      .from("notification")
      .select(
        "id, type, is_urgent, title, body, created_at, company_id, ref_table, ref_id",
      )
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("document")
      .select("id, file_type, name, company_id, created_at")
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const firstError = notifications.error ?? documents.error;
  if (firstError) {
    throw new Error(`대시보드 활동을 불러오지 못했습니다: ${firstError.message}`);
  }

  // 문서의 기업명은 별도 1회 조회로 매핑 (deadline_item과 달리 뷰가 없음)
  const docRows = documents.data ?? [];
  const docCompanyIds = [...new Set(docRows.map((d) => d.company_id))];
  const companyNames = new Map<string, string>();
  if (docCompanyIds.length > 0) {
    const { data: cos } = await supabase
      .from("company")
      .select("id, name")
      .in("id", docCompanyIds);
    for (const co of cos ?? []) companyNames.set(co.id, co.name);
  }

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
