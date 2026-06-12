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
    supabase.from("company").select("*").order("name"),
    supabase.from("credential").select("company_id, type"),
    supabase.from("deadline_item").select("source, company_id, days_left"),
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

  const nearest = new Map<string, number>();
  const upcoming = new Map<string, number>();
  const expired = new Map<string, number>();
  for (const item of deadlines.data ?? []) {
    if (!item.company_id || item.days_left === null) continue;
    if (item.days_left >= 0) {
      upcoming.set(item.company_id, (upcoming.get(item.company_id) ?? 0) + 1);
      const current = nearest.get(item.company_id);
      if (current === undefined || item.days_left < current) {
        nearest.set(item.company_id, item.days_left);
      }
    } else if (item.source === "credential") {
      expired.set(item.company_id, (expired.get(item.company_id) ?? 0) + 1);
    }
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
      nearestDaysLeft: nearest.get(co.id) ?? null,
      upcomingCount: upcoming.get(co.id) ?? 0,
      expiredCount: expired.get(co.id) ?? 0,
    })),
  };
}
