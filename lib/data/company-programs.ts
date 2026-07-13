import { DEMO_COMPANY_DETAIL } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { daysFromToday, todayKstDate } from "@/lib/datetime";
import { enabledSources } from "@/lib/gov-programs/config";
import { demoGovPrograms } from "@/lib/gov-programs/demo-data";
import { scoreProgram, type ProgramMatch } from "@/lib/gov-programs/match";
import {
  GOV_PROGRAM_SLIM_COLUMNS,
  type GovProgramSlim,
} from "@/lib/gov-programs/types";
import type { CompanyProfile } from "@/lib/data/company-detail";

export interface CompanyProgramMatchesData {
  demo: boolean;
  enabledSources: string[];
  matches: ProgramMatch[];
  total: number;
  hasMore: boolean;
}

// PostgREST 기본 max-rows와 동일한 상한. apply_end 오름차순 풀이므로
// 상한에 걸려도 마감이 가장 먼(덜 급한) 공고만 누락된다.
const POOL_LIMIT = 1000;
// 스코어링(전문 기준) 후 전송량 절감용 절단 — 클라이언트 검색 recall만 일부 저하.
const TARGET_TEXT_LIMIT = 400;

function toMatches(
  company: CompanyProfile,
  programs: GovProgramSlim[],
): ProgramMatch[] {
  return programs
    .map((program) => scoreProgram(company, program))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aEnd = a.program.apply_end ?? "9999-12-31";
      const bEnd = b.program.apply_end ?? "9999-12-31";
      return aEnd.localeCompare(bEnd);
    })
    .map((match) => ({
      ...match,
      program: {
        ...match.program,
        target_text:
          match.program.target_text?.slice(0, TARGET_TEXT_LIMIT) ?? null,
      },
    }));
}

export async function getCompanyProgramMatches(
  companyId: string,
): Promise<CompanyProgramMatchesData | null> {
  const supabase = await createClient();
  if (!supabase) {
    const detail = DEMO_COMPANY_DETAIL(companyId);
    if (!detail) return null;
    const matches = toMatches(detail.company, demoGovPrograms());
    return {
      demo: true,
      enabledSources: ["bizinfo", "kstartup", "smes", "msit"],
      matches,
      total: matches.length,
      hasMore: false,
    };
  }

  const sources = enabledSources();
  const { data: company, error: companyError } = await supabase
    .from("company")
    .select(
      "id, name, biz_no, industry, business_condition, region, founded_date, revenue, headcount, ceo_name, contact_name, contact_phone, contact_email, condition_tags, memo, primary_consultant_id, status, contract_start_date, contract_end_date, ended_at, ended_reason",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (companyError?.code === "22P02") return null;
  if (companyError) {
    throw new Error(`기업 정보를 불러오지 못했습니다: ${companyError.message}`);
  }
  if (!company) return null;

  if (sources.length === 0) {
    return {
      demo: false,
      enabledSources: [],
      matches: [],
      total: 0,
      hasMore: false,
    };
  }

  const profile: CompanyProfile = {
    id: company.id,
    name: company.name,
    bizNo: company.biz_no,
    industry: company.industry,
    businessCondition: company.business_condition,
    region: company.region,
    foundedDate: company.founded_date,
    revenue: company.revenue,
    headcount: company.headcount,
    ceoName: company.ceo_name,
    contactName: company.contact_name,
    contactPhone: company.contact_phone,
    contactEmail: company.contact_email,
    conditionTags: company.condition_tags ?? [],
    memo: company.memo,
    primaryConsultantId: company.primary_consultant_id,
    primaryConsultantName: null,
    status: (company.status as CompanyProfile["status"]) ?? "active",
    contractStartDate: company.contract_start_date,
    contractEndDate: company.contract_end_date,
    contractDaysLeft:
      company.status === "active" && company.contract_end_date
        ? daysFromToday(company.contract_end_date)
        : null,
    endedAt: company.ended_at,
    endedReason: company.ended_reason,
  };

  const { data: programs, error } = await supabase
    .from("gov_program")
    .select(GOV_PROGRAM_SLIM_COLUMNS)
    .or(`apply_end.is.null,apply_end.gte.${todayKstDate()}`)
    .order("apply_end", { ascending: true, nullsFirst: false })
    .limit(POOL_LIMIT);
  if (error) {
    throw new Error(`지원사업 공고를 불러오지 못했습니다: ${error.message}`);
  }

  const pool = (programs ?? []) as GovProgramSlim[];
  const matches = toMatches(profile, pool);
  return {
    demo: false,
    enabledSources: sources,
    matches,
    total: matches.length,
    hasMore: pool.length === POOL_LIMIT,
  };
}
