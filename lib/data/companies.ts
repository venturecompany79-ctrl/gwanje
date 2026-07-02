import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANIES } from "@/lib/demo-data";
import { daysFromToday, todayKstDate } from "@/lib/datetime";
import type { CompanyStatus } from "@/lib/labels";

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
  companies: CompanyListRow[];
}

const COMPANY_LIST_LIMIT = 500;
const COMPANY_DETAIL_LIMIT = 2_000;
const UPCOMING_DEADLINE_WINDOW_DAYS = 365;

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
    .limit(COMPANY_LIST_LIMIT);

  if (companies.error) {
    throw new Error(`기업 목록을 불러오지 못했습니다: ${companies.error.message}`);
  }

  const companyIds = (companies.data ?? []).map((company) => company.id);
  let credentialRows: { company_id: string; type: string }[] = [];
  let upcomingDeadlineRows: {
    company_id: string | null;
    days_left: number | null;
    title: string | null;
  }[] = [];
  let expiredCredentialRows: { company_id: string | null }[] = [];

  if (companyIds.length > 0) {
    const [credentials, upcomingDeadlines, expiredCredentials] = await Promise.all([
      supabase
        .from("credential")
        .select("company_id, type")
        .in("company_id", companyIds)
        .limit(COMPANY_DETAIL_LIMIT),
      supabase
        .from("deadline_item")
        .select("company_id, days_left, title")
        .gte("due_date", today)
        .gte("days_left", 0)
        .lte("days_left", UPCOMING_DEADLINE_WINDOW_DAYS)
        .in("company_id", companyIds)
        .order("due_date", { ascending: true })
        .limit(COMPANY_DETAIL_LIMIT),
      supabase
        .from("deadline_item")
        .select("company_id")
        .eq("source", "credential")
        .lt("due_date", today)
        .in("company_id", companyIds)
        .limit(COMPANY_DETAIL_LIMIT),
    ]);

    const firstError =
      credentials.error ?? upcomingDeadlines.error ?? expiredCredentials.error;
    if (firstError) {
      throw new Error(`기업 목록을 불러오지 못했습니다: ${firstError.message}`);
    }

    credentialRows = credentials.data ?? [];
    upcomingDeadlineRows = upcomingDeadlines.data ?? [];
    expiredCredentialRows = expiredCredentials.data ?? [];
  }

  const credsByCompany = new Map<string, string[]>();
  for (const cred of credentialRows) {
    const list = credsByCompany.get(cred.company_id) ?? [];
    list.push(cred.type);
    credsByCompany.set(cred.company_id, list);
  }

  const upcomingItems = new Map<string, { title: string; daysLeft: number }[]>();
  const expired = new Map<string, number>();
  for (const item of upcomingDeadlineRows) {
    if (!item.company_id || item.days_left === null) continue;
    const list = upcomingItems.get(item.company_id) ?? [];
    list.push({ title: item.title ?? "항목", daysLeft: item.days_left });
    upcomingItems.set(item.company_id, list);
  }
  for (const item of expiredCredentialRows) {
    if (!item.company_id) continue;
    expired.set(item.company_id, (expired.get(item.company_id) ?? 0) + 1);
  }
  for (const list of upcomingItems.values()) {
    list.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  return {
    demo: false,
    companies: (companies.data ?? []).map((co) => ({
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
      credentialTypes: credsByCompany.get(co.id) ?? [],
      nearestDaysLeft: upcomingItems.get(co.id)?.[0]?.daysLeft ?? null,
      upcomingCount: upcomingItems.get(co.id)?.length ?? 0,
      upcomingItems: upcomingItems.get(co.id) ?? [],
      expiredCount: expired.get(co.id) ?? 0,
    })),
  };
}
