import { DEMO_COMPANY_DETAIL } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { daysFromToday, todayKstDate } from "@/lib/datetime";
import { enabledSources } from "@/lib/gov-programs/config";
import { demoGovPrograms } from "@/lib/gov-programs/demo-data";
import {
  SCORE_HIGH,
  SCORE_MID,
  scoreProgramForProfile,
  type MatchEligibility,
  type ProgramMatch,
} from "@/lib/gov-programs/match";
import { buildCompanyMatchProfile } from "@/lib/gov-programs/profile";
import type { CompanyMatchProfile } from "@/lib/gov-programs/profile-types";
import {
  extractProgramRegions,
  isNationalProgram,
  type RegionOption,
} from "@/lib/gov-programs/region";
import {
  GOV_PROGRAM_SLIM_COLUMNS,
  normalizeContentText,
  type GovProgramSlim,
} from "@/lib/gov-programs/types";
import type { CompanyProfile } from "@/lib/data/company-detail";

export type ProgramReviewDecision = "saved" | "excluded";
export type ProgramStatusFilter = "active" | "saved" | "task" | "excluded";
export type ProgramFitFilter = "all" | "high" | "review" | "exclude-low";
export type ProgramDueFilter = "all" | "7" | "14" | "30" | "60" | "none";
export type ProgramSortKey = "recommend" | "deadline" | "synced";

export interface CompanyProgramMatch extends ProgramMatch {
  reviewDecision: ProgramReviewDecision | null;
  linkedTaskId: string | null;
}

export interface CompanyProgramQuery {
  query?: string;
  field?: string;
  region?: string;
  due?: ProgramDueFilter;
  fit?: ProgramFitFilter;
  eligibility?: MatchEligibility | "all";
  status?: ProgramStatusFilter;
  sort?: ProgramSortKey;
  pinnedProgramId?: string;
  page?: number;
  pageSize?: number;
}

export interface CompanyProgramMatchesData {
  demo: boolean;
  enabledSources: string[];
  matches: CompanyProgramMatch[];
  profile: CompanyMatchProfile;
  total: number;
  filteredTotal: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  poolTruncated: boolean;
}

const POOL_LIMIT = 1000;
const DEFAULT_PAGE_SIZE = 30;

function companyProfileFromRow(
  company: DatabaseCompanyRow,
): CompanyProfile {
  return {
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
}

interface DatabaseCompanyRow {
  id: string;
  name: string;
  biz_no: string | null;
  industry: string | null;
  business_condition: string | null;
  region: string | null;
  founded_date: string | null;
  revenue: number | null;
  headcount: number | null;
  ceo_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  condition_tags: string[] | null;
  memo: string | null;
  primary_consultant_id: string | null;
  status: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  ended_at: string | null;
  ended_reason: string | null;
}

function demoProfile(company: CompanyProfile): CompanyMatchProfile {
  const sourceDetail = [
    company.industry,
    company.businessCondition,
    company.region,
    ...company.conditionTags,
    company.memo,
  ]
    .filter(Boolean)
    .join(" · ");
  const present = [
    company.industry,
    company.businessCondition,
    company.region,
    company.foundedDate,
    company.revenue,
    company.headcount,
    company.conditionTags.length > 0 ? "tags" : null,
  ].filter((value) => value !== null && value !== undefined && value !== "").length;
  return {
    company,
    completeness: Math.round((present / 7) * 100),
    missingInformation: [],
    sourceCounts: {
      company: 1,
      credential: 0,
      ip_right: 0,
      task: 0,
      meeting_report: 0,
      document: 0,
    },
    sources: [
      {
        kind: "company",
        id: company.id,
        label: `${company.name} 기본정보`,
        detail: sourceDetail,
        href: `/app/companies/${company.id}`,
        included: true,
        updatedAt: null,
      },
    ],
    keywords: normalizeContentText(sourceDetail).split(" ").filter((value) => value.length >= 2),
    fingerprint: `demo-${company.id}`,
    analyzedAt: new Date().toISOString(),
  };
}

function matchesDue(match: CompanyProgramMatch, due: ProgramDueFilter): boolean {
  if (due === "all") return true;
  if (due === "none") return !match.program.apply_end;
  if (!match.program.apply_end) return false;
  const days = daysFromToday(match.program.apply_end);
  return days >= 0 && days <= Number(due);
}

function matchesFit(match: CompanyProgramMatch, fit: ProgramFitFilter): boolean {
  if (fit === "all") return true;
  if (fit === "high") return match.score >= SCORE_HIGH;
  if (fit === "review") return match.score >= SCORE_MID && match.score < SCORE_HIGH;
  return match.score >= SCORE_MID;
}

function matchesStatus(match: CompanyProgramMatch, status: ProgramStatusFilter): boolean {
  if (status === "saved") return match.reviewDecision === "saved";
  if (status === "task") return match.linkedTaskId !== null;
  if (status === "excluded") return match.reviewDecision === "excluded";
  return match.reviewDecision !== "excluded";
}

function filterAndSort(
  matches: CompanyProgramMatch[],
  input: CompanyProgramQuery,
): CompanyProgramMatch[] {
  const query = normalizeContentText(input.query);
  const due = input.due ?? "all";
  const fit = input.fit ?? "all";
  const eligibility = input.eligibility ?? "all";
  const status = input.status ?? "active";
  const sort = input.sort ?? "recommend";

  const filtered = matches.filter((match) => {
    const program = match.program;
    if (input.field && input.field !== "all" && program.support_field !== input.field) return false;
    if (input.region && input.region !== "all") {
      if (input.region === "national") {
        if (!isNationalProgram(program)) return false;
      } else if (!extractProgramRegions(program).includes(input.region as RegionOption)) return false;
    }
    if (!matchesDue(match, due) || !matchesFit(match, fit) || !matchesStatus(match, status)) return false;
    if (eligibility !== "all" && match.eligibility !== eligibility) return false;
    if (!query) return true;
    return normalizeContentText(
      [
        program.title,
        program.org_name,
        program.target_text,
        program.support_field,
        program.region,
        program.hashtags.join(" "),
        match.reasons.join(" "),
        match.warnings.join(" "),
        match.evidence.map((item) => `${item.label} ${item.detail}`).join(" "),
      ].join(" "),
    ).includes(query);
  });

  return filtered.sort((a, b) => {
    if (sort === "deadline") {
      const aEnd = a.program.apply_end ?? "9999-12-31";
      const bEnd = b.program.apply_end ?? "9999-12-31";
      return aEnd.localeCompare(bEnd) || b.score - a.score;
    }
    if (sort === "synced") {
      return b.program.synced_at.localeCompare(a.program.synced_at) || b.score - a.score;
    }
    return b.score - a.score || (a.program.apply_end ?? "9999-12-31").localeCompare(b.program.apply_end ?? "9999-12-31");
  });
}

function paginate(
  matches: CompanyProgramMatch[],
  input: CompanyProgramQuery,
): { rows: CompanyProgramMatch[]; page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.max(1, Math.min(50, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)));
  const start = (page - 1) * pageSize;
  const rows = matches.slice(start, start + pageSize);
  const pinned = input.pinnedProgramId
    ? matches.find((match) => match.program.id === input.pinnedProgramId)
    : null;
  if (pinned && !rows.some((match) => match.program.id === pinned.program.id)) {
    rows.unshift(pinned);
    if (rows.length > pageSize) rows.pop();
  }
  return { rows, page, pageSize };
}

function attachWorkflowState(
  profile: CompanyMatchProfile,
  programs: GovProgramSlim[],
  decisions: Map<string, ProgramReviewDecision>,
  tasks: Map<string, string>,
): CompanyProgramMatch[] {
  return programs.map((program) => ({
    ...scoreProgramForProfile(profile, program),
    reviewDecision: decisions.get(program.id) ?? null,
    linkedTaskId: tasks.get(program.id) ?? null,
  }));
}

export async function getCompanyProgramMatches(
  companyId: string,
  input: CompanyProgramQuery = {},
): Promise<CompanyProgramMatchesData | null> {
  const supabase = await createClient();
  if (!supabase) {
    const detail = DEMO_COMPANY_DETAIL(companyId);
    if (!detail) return null;
    const profile = demoProfile(detail.company);
    const all = attachWorkflowState(profile, demoGovPrograms(), new Map(), new Map());
    const filtered = filterAndSort(all, input);
    const page = paginate(filtered, input);
    return {
      demo: true,
      enabledSources: ["bizinfo", "kstartup", "smes", "msit"],
      matches: page.rows,
      profile,
      total: all.length,
      filteredTotal: filtered.length,
      page: page.page,
      pageSize: page.pageSize,
      hasMore: page.page * page.pageSize < filtered.length,
      poolTruncated: false,
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
  if (companyError) throw new Error(`기업 정보를 불러오지 못했습니다: ${companyError.message}`);
  if (!company) return null;

  const companyProfile = companyProfileFromRow(company);
  const profile = await buildCompanyMatchProfile(supabase, companyProfile);
  if (sources.length === 0) {
    return {
      demo: false,
      enabledSources: [],
      matches: [],
      profile,
      total: 0,
      filteredTotal: 0,
      page: 1,
      pageSize: input.pageSize ?? DEFAULT_PAGE_SIZE,
      hasMore: false,
      poolTruncated: false,
    };
  }

  const [programs, pinnedProgram, reviews, linkedTasks] = await Promise.all([
    supabase
      .from("gov_program")
      .select(GOV_PROGRAM_SLIM_COLUMNS)
      .or(`apply_end.is.null,apply_end.gte.${todayKstDate()}`)
      .order("apply_end", { ascending: true, nullsFirst: false })
      .limit(POOL_LIMIT),
    input.pinnedProgramId
      ? supabase
          .from("gov_program")
          .select(GOV_PROGRAM_SLIM_COLUMNS)
          .eq("id", input.pinnedProgramId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("company_gov_program_review")
      .select("gov_program_id, decision")
      .eq("company_id", companyId),
    supabase
      .from("task")
      .select("id, source_gov_program_id")
      .eq("company_id", companyId)
      .not("source_gov_program_id", "is", null),
  ]);
  const firstError = programs.error ?? pinnedProgram.error ?? reviews.error ?? linkedTasks.error;
  if (firstError) throw new Error(`지원사업 공고를 불러오지 못했습니다: ${firstError.message}`);

  const decisions = new Map(
    (reviews.data ?? []).map((row) => [row.gov_program_id, row.decision as ProgramReviewDecision]),
  );
  const tasks = new Map(
    (linkedTasks.data ?? []).flatMap((row) =>
      row.source_gov_program_id ? [[row.source_gov_program_id, row.id] as const] : [],
    ),
  );
  const pool = (programs.data ?? []) as GovProgramSlim[];
  if (
    pinnedProgram.data &&
    !pool.some((program) => program.id === pinnedProgram.data?.id)
  ) {
    pool.push(pinnedProgram.data as GovProgramSlim);
  }
  const all = attachWorkflowState(profile, pool, decisions, tasks);
  const filtered = filterAndSort(all, input);
  const page = paginate(filtered, input);

  return {
    demo: false,
    enabledSources: sources,
    matches: page.rows,
    profile,
    total: all.length,
    filteredTotal: filtered.length,
    page: page.page,
    pageSize: page.pageSize,
    hasMore: page.page * page.pageSize < filtered.length,
    poolTruncated: pool.length === POOL_LIMIT,
  };
}
