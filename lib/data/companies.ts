import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANIES } from "@/lib/demo-data";

export interface CompanyListRow {
  id: string;
  name: string;
  industry: string | null;
  foundedDate: string | null;
  revenue: number | null;
  headcount: number | null;
  conditionTags: string[];
  createdAt: string;
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

export async function getCompaniesData(): Promise<CompaniesData> {
  const supabase = await createClient();
  if (!supabase) return DEMO_COMPANIES();

  const [companies, credentials, deadlines] = await Promise.all([
    // 목록 표시에 필요한 컬럼만 — 전량(select *) 조회 축소 (GWJ-019)
    supabase
      .from("company")
      .select(
        "id, name, industry, founded_date, revenue, headcount, condition_tags, created_at",
      )
      .order("name"),
    supabase.from("credential").select("company_id, type"),
    supabase
      .from("deadline_item")
      .select("source, company_id, days_left, title"),
  ]);

  const firstError = companies.error ?? credentials.error ?? deadlines.error;
  if (firstError) {
    throw new Error(`기업 목록을 불러오지 못했습니다: ${firstError.message}`);
  }

  const credsByCompany = new Map<string, string[]>();
  for (const cred of credentials.data ?? []) {
    const list = credsByCompany.get(cred.company_id) ?? [];
    list.push(cred.type);
    credsByCompany.set(cred.company_id, list);
  }

  const upcomingItems = new Map<string, { title: string; daysLeft: number }[]>();
  const expired = new Map<string, number>();
  for (const item of deadlines.data ?? []) {
    if (!item.company_id || item.days_left === null) continue;
    if (item.days_left >= 0) {
      const list = upcomingItems.get(item.company_id) ?? [];
      list.push({ title: item.title ?? "항목", daysLeft: item.days_left });
      upcomingItems.set(item.company_id, list);
    } else if (item.source === "credential") {
      expired.set(item.company_id, (expired.get(item.company_id) ?? 0) + 1);
    }
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
      credentialTypes: credsByCompany.get(co.id) ?? [],
      nearestDaysLeft: upcomingItems.get(co.id)?.[0]?.daysLeft ?? null,
      upcomingCount: upcomingItems.get(co.id)?.length ?? 0,
      upcomingItems: upcomingItems.get(co.id) ?? [],
      expiredCount: expired.get(co.id) ?? 0,
    })),
  };
}
