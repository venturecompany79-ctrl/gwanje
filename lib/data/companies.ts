import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANIES } from "@/lib/demo-data";
import { daysFromToday, todayKstDate } from "@/lib/datetime";
import type { CompanyStatus } from "@/lib/labels";
import type {
  Database,
  Json,
  TaskStage,
  TaskWorkStatus,
} from "@/lib/database.types";
import { getMemberContext } from "@/lib/actions/shared";
import { hasPermission } from "@/lib/permissions";
import type { ConsultantOption } from "@/lib/data/consultants";
import type { CategoryOption } from "@/lib/data/company-detail";

export interface CompanyPriorityTask {
  id: string;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  stage: TaskStage;
  workStatus: TaskWorkStatus;
  dueDate: string | null;
  daysLeft: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  updatedAt: string;
}

export interface CompanyStageCounts {
  diagnosis: number;
  proposal: number;
  application: number;
  result: number;
}

export interface CompanyWorkStatusCounts {
  planned: number;
  in_progress: number;
  waiting: number;
  on_hold: number;
  completed: number;
}

export interface CompanyListRow {
  id: string;
  name: string;
  industry: string | null;
  foundedDate: string | null;
  revenue: number | null;
  headcount: number | null;
  conditionTags: string[];
  createdAt: string;
  primaryConsultantId: string | null;
  primaryConsultantName: string | null;
  /** 관리 상태 — active(관리중) / ended(종료) */
  status: CompanyStatus;
  /** 계약 종료일 (없으면 null) */
  contractEndDate: string | null;
  /** 계약 종료일까지 남은 일수 (활성·계약종료일 있을 때만, 없으면 null) */
  contractDaysLeft: number | null;
  /** 관리 종료 확정 시각 (종료 기업만) */
  endedAt: string | null;
  /** 관리 종료 사유 (종료 기업만) */
  endedReason: string | null;
  /** 보유 자격·인증 종류명 (칩 표시용) */
  credentialTypes: string[];
  /** 다가오는 항목 중 가장 임박한 D-day — deadline_item 뷰 기준, 없으면 null */
  nearestDaysLeft: number | null;
  /** 다가오는(D-0 이상) 항목 수 */
  upcomingCount: number;
  /** 다가오는 항목 상세 (임박순) — "외 N건" 툴팁용 (GWJ-020) */
  upcomingItems: {
    source: "credential" | "task" | "schedule" | "ip_deadline";
    title: string;
    daysLeft: number;
  }[];
  /** 만료된 자격 수 */
  expiredCount: number;
  activeTaskCount: number;
  overdueTaskCount: number;
  due7TaskCount: number;
  unassignedTaskCount: number;
  stageCounts: CompanyStageCounts;
  workStatusCounts: CompanyWorkStatusCounts;
  priorityTask: CompanyPriorityTask | null;
  latestTaskUpdatedAt: string | null;
}

export interface CompaniesData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  /** true면 목록 제한을 초과한 기업이 있어 일부만 반환됨 */
  hasMore: boolean;
  companies: CompanyListRow[];
  currentProfileId: string;
  canViewTeam: boolean;
  canWriteTasks: boolean;
  consultants: ConsultantOption[];
  categories: CategoryOption[];
}

export const COMPANY_LIST_LIMIT = 500;
const UPCOMING_DEADLINE_WINDOW_DAYS = 365;

type CompanyListStatsRpcRow =
  Database["public"]["Functions"]["get_company_list_stats"]["Returns"][number];

function parseUpcomingItems(value: Json): CompanyListRow["upcomingItems"] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return [];
    const { source, title, daysLeft } = item;
    if (
      (source !== "credential" &&
        source !== "task" &&
        source !== "schedule" &&
        source !== "ip_deadline") ||
      typeof title !== "string" ||
      typeof daysLeft !== "number"
    ) {
      return [];
    }
    return [{ source, title, daysLeft }];
  });
}

const TASK_STAGES: TaskStage[] = [
  "diagnosis",
  "proposal",
  "application",
  "result",
];
const TASK_WORK_STATUSES: TaskWorkStatus[] = [
  "planned",
  "in_progress",
  "waiting",
  "on_hold",
  "completed",
];

function parsePriorityTask(value: Json | null): CompanyPriorityTask | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const {
    id,
    title,
    categoryId,
    categoryName,
    stage,
    workStatus,
    dueDate,
    daysLeft,
    assigneeId,
    assigneeName,
    updatedAt,
  } = value;

  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof stage !== "string" ||
    !TASK_STAGES.includes(stage as TaskStage) ||
    typeof workStatus !== "string" ||
    !TASK_WORK_STATUSES.includes(workStatus as TaskWorkStatus) ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id,
    title,
    categoryId: typeof categoryId === "string" ? categoryId : null,
    categoryName: typeof categoryName === "string" ? categoryName : null,
    stage: stage as TaskStage,
    workStatus: workStatus as TaskWorkStatus,
    dueDate: typeof dueDate === "string" ? dueDate : null,
    daysLeft: typeof daysLeft === "number" ? daysLeft : null,
    assigneeId: typeof assigneeId === "string" ? assigneeId : null,
    assigneeName: typeof assigneeName === "string" ? assigneeName : null,
    updatedAt,
  };
}

export async function getCompaniesData(): Promise<CompaniesData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_COMPANIES();

  const today = todayKstDate();
  const [companies, profiles, categories, member] = await Promise.all([
    supabase
      .from("company")
      .select(
        "id, name, industry, founded_date, revenue, headcount, condition_tags, created_at, primary_consultant_id, status, contract_end_date, ended_at, ended_reason",
      )
      .order("name")
      .order("id")
      .limit(COMPANY_LIST_LIMIT + 1),
    supabase
      .from("profile")
      .select("id, name, title")
      .eq("status", "active")
      .order("name")
      .order("id"),
    supabase.from("category").select("id, name").order("sort_order"),
    getMemberContext(supabase),
  ]);

  if (companies.error) {
    throw new Error(`기업 목록을 불러오지 못했습니다: ${companies.error.message}`);
  }
  if (profiles.error) {
    throw new Error(`컨설턴트 목록을 불러오지 못했습니다: ${profiles.error.message}`);
  }
  if (categories.error) {
    throw new Error(`분류 목록을 불러오지 못했습니다: ${categories.error.message}`);
  }
  if ("error" in member) throw new Error(member.error);

  const visibleCompanies = (companies.data ?? []).slice(0, COMPANY_LIST_LIMIT);
  const companyIds = visibleCompanies.map((company) => company.id);
  let companyStatsRows: CompanyListStatsRpcRow[] = [];

  if (companyIds.length > 0) {
    const stats = await supabase.rpc("get_company_list_stats", {
      p_company_ids: companyIds,
      p_today: today,
      p_upcoming_window_days: UPCOMING_DEADLINE_WINDOW_DAYS,
    });
    if (stats.error) {
      throw new Error(`기업 목록을 불러오지 못했습니다: ${stats.error.message}`);
    }
    companyStatsRows = stats.data ?? [];
  }

  const statsByCompany = new Map(
    companyStatsRows.map((stats) => [stats.company_id, stats]),
  );
  const consultantName = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.name]),
  );

  return {
    demo: false,
    hasMore: (companies.data?.length ?? 0) > COMPANY_LIST_LIMIT,
    currentProfileId: member.userId,
    canViewTeam: member.role === "owner" || member.role === "manager",
    canWriteTasks: hasPermission(member, "tasks.write"),
    consultants: profiles.data ?? [],
    categories: categories.data ?? [],
    companies: visibleCompanies.map((co) => {
      const stats = statsByCompany.get(co.id);
      return {
        id: co.id,
        name: co.name,
        industry: co.industry,
        foundedDate: co.founded_date,
        revenue: co.revenue,
        headcount: co.headcount,
        conditionTags: co.condition_tags,
        createdAt: co.created_at,
        primaryConsultantId: co.primary_consultant_id,
        primaryConsultantName: co.primary_consultant_id
          ? (consultantName.get(co.primary_consultant_id) ?? null)
          : null,
        status: (co.status as CompanyStatus) ?? "active",
        contractEndDate: co.contract_end_date,
        contractDaysLeft:
          co.status === "active" && co.contract_end_date
            ? daysFromToday(co.contract_end_date)
            : null,
        endedAt: co.ended_at,
        endedReason: co.ended_reason,
        credentialTypes: stats?.credential_types ?? [],
        nearestDaysLeft: stats?.nearest_days_left ?? null,
        upcomingCount: stats?.upcoming_count ?? 0,
        upcomingItems: stats ? parseUpcomingItems(stats.upcoming_items) : [],
        expiredCount: stats?.expired_count ?? 0,
        activeTaskCount: stats?.active_task_count ?? 0,
        overdueTaskCount: stats?.overdue_task_count ?? 0,
        due7TaskCount: stats?.due7_task_count ?? 0,
        unassignedTaskCount: stats?.unassigned_task_count ?? 0,
        stageCounts: {
          diagnosis: stats?.diagnosis_task_count ?? 0,
          proposal: stats?.proposal_task_count ?? 0,
          application: stats?.application_task_count ?? 0,
          result: stats?.result_task_count ?? 0,
        },
        workStatusCounts: {
          planned: stats?.planned_task_count ?? 0,
          in_progress: stats?.in_progress_task_count ?? 0,
          waiting: stats?.waiting_task_count ?? 0,
          on_hold: stats?.on_hold_task_count ?? 0,
          completed: stats?.completed_task_count ?? 0,
        },
        priorityTask: stats ? parsePriorityTask(stats.priority_task) : null,
        latestTaskUpdatedAt: stats?.latest_task_updated_at ?? null,
      };
    }),
  };
}
