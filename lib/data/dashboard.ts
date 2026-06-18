import { createClient } from "@/lib/supabase/server";
import type {
  CredentialStatus,
  DeadlineItem,
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

const DEADLINE_SOURCES = ["credential", "task", "schedule"] as const;
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
  "etc",
] as const;

function isDeadlineSource(value: string | null): value is DeadlineItem["source"] {
  return DEADLINE_SOURCES.some((source) => source === value);
}

function isDeadlineStatus(
  value: string | null,
): value is CredentialStatus | TaskStage | ScheduleType {
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

export async function getDashboardData(
  filter: DeadlineFilter = null,
): Promise<DashboardData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_DASHBOARD(filter);

  const now = new Date();

  // 필터별 마감 패널 쿼리 — KPI 카운트와 동일한 조건으로 목록을 맞춘다 (GWJ-009)
  let deadlineQuery = supabase
    .from("deadline_item")
    .select("*")
    .gte("days_left", 0)
    .order("due_date", { ascending: true });
  if (filter === "due7") {
    deadlineQuery = deadlineQuery.lte("days_left", 7).limit(50);
  } else if (filter === "expire30") {
    deadlineQuery = deadlineQuery
      .eq("source", "credential")
      .lte("days_left", 30)
      .limit(50);
  } else {
    deadlineQuery = deadlineQuery.limit(8);
  }

  const [
    companyCount,
    due7,
    expire30,
    activeTasks,
    deadlines,
    overdue,
    notifications,
    documents,
    unread,
  ] = await Promise.all([
    supabase.from("company").select("id", { count: "exact", head: true }),
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .gte("days_left", 0)
      .lte("days_left", 7),
    supabase
      .from("deadline_item")
      .select("id", { count: "exact", head: true })
      .eq("source", "credential")
      .gte("days_left", 0)
      .lte("days_left", 30),
    supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .neq("stage", "result"),
    deadlineQuery,
    // 기한 지남 — 가장 오래된 것 먼저(가장 시급). 보드의 result 단계는 뷰에서 이미 제외됨.
    supabase
      .from("deadline_item")
      .select("*")
      .lt("days_left", 0)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("notification")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("document")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2),
    supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
  ]);

  const firstError =
    companyCount.error ??
    due7.error ??
    expire30.error ??
    activeTasks.error ??
    deadlines.error ??
    overdue.error ??
    notifications.error ??
    documents.error ??
    unread.error;
  if (firstError) {
    throw new Error(`대시보드 데이터를 불러오지 못했습니다: ${firstError.message}`);
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
    demo: false,
    kpi: {
      companyCount: companyCount.count ?? 0,
      due7: due7.count ?? 0,
      expire30: expire30.count ?? 0,
      activeTasks: activeTasks.count ?? 0,
    },
    deadlines: normalizeDeadlineItems(deadlines.data ?? []),
    overdue: normalizeDeadlineItems(overdue.data ?? []),
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
    unreadCount: unread.count ?? 0,
  };
}
