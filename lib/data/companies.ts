import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANIES } from "@/lib/demo-data";
import { daysFromToday, todayKstDate } from "@/lib/datetime";
import type { CompanyStatus } from "@/lib/labels";
import type { Database, Json } from "@/lib/database.types";

export interface CompanyListRow {
  id: string;
  name: string;
  industry: string | null;
  foundedDate: string | null;
  revenue: number | null;
  headcount: number | null;
  conditionTags: string[];
  createdAt: string;
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
  upcomingItems: { title: string; daysLeft: number }[];
  /** 만료된 자격 수 */
  expiredCount: number;
}

export interface CompaniesData {
  /** true면 Supabase 미연결 — 데모 데이터 표시 중 */
  demo: boolean;
  /** true면 목록 제한을 초과한 기업이 있어 일부만 반환됨 */
  hasMore: boolean;
  companies: CompanyListRow[];
}

export const COMPANY_LIST_LIMIT = 500;
const UPCOMING_DEADLINE_WINDOW_DAYS = 365;

type CompanyListStatsRpcRow =
  Database["public"]["Functions"]["get_company_list_stats"]["Returns"][number];

function parseUpcomingItems(value: Json): CompanyListRow["upcomingItems"] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return [];
    const { title, daysLeft } = item;
    if (typeof title !== "string" || typeof daysLeft !== "number") return [];
    return [{ title, daysLeft }];
  });
}

export async function getCompaniesData(): Promise<CompaniesData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_COMPANIES();

  const today = todayKstDate();
  const companies = await supabase
    .from("company")
    .select(
      "id, name, industry, founded_date, revenue, headcount, condition_tags, created_at, status, contract_end_date, ended_at, ended_reason",
    )
    .order("name")
    .order("id")
    .limit(COMPANY_LIST_LIMIT + 1);

  if (companies.error) {
    throw new Error(`기업 목록을 불러오지 못했습니다: ${companies.error.message}`);
  }

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

  return {
    demo: false,
    hasMore: (companies.data?.length ?? 0) > COMPANY_LIST_LIMIT,
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
      };
    }),
  };
}
