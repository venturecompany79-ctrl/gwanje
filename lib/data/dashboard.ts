import { createClient } from "@/lib/supabase/server";
import type {
  CredentialStatus,
  DeadlineItem,
  NotificationType,
  ScheduleType,
  TaskStage,
} from "@/lib/database.types";
import { DEMO_DASHBOARD } from "@/lib/demo-data";

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
}

export interface DashboardFile {
  id: string;
  fileType: string;
  name: string;
  companyName: string;
  when: string;
}

export interface DashboardData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  kpi: DashboardKpi;
  deadlines: DeadlineItem[];
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
  const hh = String(then.getHours()).padStart(2, "0");
  const mm = String(then.getMinutes()).padStart(2, "0");
  if (diffHour < 48) return `어제 ${hh}:${mm}`;
  return `${then.getMonth() + 1}/${then.getDate()}`;
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

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_DASHBOARD();

  const now = new Date();

  const [
    companyCount,
    due7,
    expire30,
    activeTasks,
    deadlines,
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
    supabase
      .from("deadline_item")
      .select("*")
      .gte("days_left", 0)
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
    alerts: (notifications.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      urgent: n.is_urgent,
      title: n.title,
      sub: n.body,
      timeAgo: formatTimeAgo(n.created_at, now),
    })),
    files: docRows.map((d) => ({
      id: d.id,
      fileType: d.file_type ?? "파일",
      name: d.name,
      companyName: companyNames.get(d.company_id) ?? "—",
      when: formatTimeAgo(d.created_at, now),
    })),
    unreadCount: unread.count ?? 0,
  };
}
