import { DEMO_COMPANY_DETAIL } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { todayKstDate } from "@/lib/datetime";
import { enabledSources } from "@/lib/gov-programs/config";
import { demoGovPrograms } from "@/lib/gov-programs/demo-data";
import {
  PROGRAM_MATCH_THRESHOLD,
  queryTextForCompany,
  scoreProgram,
  supportFieldsForCompany,
  type ProgramMatch,
} from "@/lib/gov-programs/match";
import type { CompanyProfile } from "@/lib/data/company-detail";

export interface CompanyProgramMatchesData {
  demo: boolean;
  enabledSources: string[];
  matches: ProgramMatch[];
}

interface Options {
  limit?: number;
}

const DEFAULT_LIMIT = 10;
const CANDIDATE_LIMIT = 80;

function sortAndLimit(
  company: CompanyProfile,
  programs: ProgramMatch["program"][],
  limit: number,
): ProgramMatch[] {
  return programs
    .map((program) => scoreProgram(company, program))
    .filter((match) => match.score >= PROGRAM_MATCH_THRESHOLD)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aEnd = a.program.apply_end ?? "9999-12-31";
      const bEnd = b.program.apply_end ?? "9999-12-31";
      return aEnd.localeCompare(bEnd);
    })
    .slice(0, limit);
}

export async function getCompanyProgramMatches(
  companyId: string,
  options: Options = {},
): Promise<CompanyProgramMatchesData | null> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const supabase = await createClient();
  if (!supabase) {
    const detail = DEMO_COMPANY_DETAIL(companyId);
    if (!detail) return null;
    return {
      demo: true,
      enabledSources: ["bizinfo", "kstartup", "smes", "msit"],
      matches: sortAndLimit(detail.company, demoGovPrograms(), limit),
    };
  }

  const sources = enabledSources();
  const { data: company, error: companyError } = await supabase
    .from("company")
    .select(
      "id, name, biz_no, industry, founded_date, revenue, headcount, ceo_name, contact_name, contact_phone, contact_email, condition_tags, memo",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (companyError?.code === "22P02") return null;
  if (companyError) {
    throw new Error(`기업 정보를 불러오지 못했습니다: ${companyError.message}`);
  }
  if (!company) return null;

  if (sources.length === 0) {
    return { demo: false, enabledSources: [], matches: [] };
  }

  const profile: CompanyProfile = {
    id: company.id,
    name: company.name,
    bizNo: company.biz_no,
    industry: company.industry,
    foundedDate: company.founded_date,
    revenue: company.revenue,
    headcount: company.headcount,
    ceoName: company.ceo_name,
    contactName: company.contact_name,
    contactPhone: company.contact_phone,
    contactEmail: company.contact_email,
    conditionTags: company.condition_tags ?? [],
    memo: company.memo,
  };

  const { data: programs, error } = await supabase.rpc(
    "match_gov_program_candidates",
    {
      q: queryTextForCompany(profile),
      tags: profile.conditionTags,
      fields: supportFieldsForCompany(profile),
      today: todayKstDate(),
      max_rows: CANDIDATE_LIMIT,
    },
  );
  if (error) {
    throw new Error(`지원사업 후보를 불러오지 못했습니다: ${error.message}`);
  }

  return {
    demo: false,
    enabledSources: sources,
    matches: sortAndLimit(profile, programs ?? [], limit),
  };
}
