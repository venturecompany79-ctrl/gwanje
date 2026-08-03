import type { CompanyProfile } from "@/lib/data/company-detail";
import type {
  CompanyMatchProfile,
  MatchProfileSourceKind,
} from "@/lib/gov-programs/profile-types";
import { todayKstDate } from "@/lib/datetime";
import {
  companyRegionOption,
  extractProgramRegions,
  isNationalProgram,
} from "@/lib/gov-programs/region";
import type {
  GovProgramSlim,
  SupportField,
} from "@/lib/gov-programs/types";
import {
  SUPPORT_FIELDS,
  SUPPORT_KEYWORDS,
  normalizeContentText,
} from "@/lib/gov-programs/types";

// 적합도 가중치 — 점수는 "이 기업에 맞는가"의 힌트일 뿐 배제 기준이 아니다.
// 마감 임박(긴급도)은 DdayBadge가 담당하므로 점수에 넣지 않는다.
export const SCORE_BASE = 15;
export const W_INDUSTRY_EXACT = 30;
export const W_INDUSTRY_PARTIAL = 12;
export const W_FIELD = 10;
export const W_TAGS_MAX = 25;
export const W_REGION = 10;
export const P_REGION_MISMATCH = -25;
export const W_AGE = 10;
export const P_AGE_MISMATCH = -30;
export const W_EARLY_STAGE = 8;
export const W_HEADCOUNT = 5;
export const W_REVENUE = 5;

// UI 티어 경계 (scoreTone·적합도 필터 공용)
export const SCORE_HIGH = 60;
export const SCORE_MID = 35;

export interface ProgramMatch {
  program: GovProgramSlim;
  score: number;
  reasons: string[];
  eligibility: MatchEligibility;
  confidence: MatchConfidence;
  warnings: string[];
  scoreBreakdown: MatchScorePart[];
  evidence: ProgramMatchEvidence[];
}

export type MatchEligibility = "eligible" | "review" | "ineligible";
export type MatchConfidence = "high" | "medium" | "low";

export interface MatchScorePart {
  key: "profile" | "eligibility" | "history";
  label: string;
  score: number;
  max: number;
}

export interface ProgramMatchEvidence {
  sourceKind: MatchProfileSourceKind;
  sourceId: string;
  label: string;
  detail: string;
  href: string;
}

interface EligibilityResult {
  eligibility: MatchEligibility;
  warnings: string[];
  checks: number;
}

type AgeOperator = "lt" | "lte" | "gt" | "gte";

interface AgeRequirement {
  limit: number;
  operator: AgeOperator;
}

function programText(program: GovProgramSlim): string {
  return normalizeContentText(
    [
      program.title,
      program.support_field,
      program.org_name,
      program.summary,
      program.target_text,
      program.support_amount,
      program.hashtags.join(" "),
    ].join(" "),
  );
}

function normalizedTags(tags: string[]): string[] {
  return tags.map(normalizeContentText).filter(Boolean);
}

export function supportFieldsForCompany(company: CompanyProfile): SupportField[] {
  const haystack = [
    company.industry,
    company.businessCondition,
    ...company.conditionTags,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();
  if (!haystack) return [];

  return SUPPORT_FIELDS.filter(
    (field) =>
      field !== "기타" &&
      SUPPORT_KEYWORDS[field].some((keyword) => haystack.includes(keyword)),
  );
}

function scoreIndustryAndField(
  company: CompanyProfile,
  program: GovProgramSlim,
  text: string,
  reasons: string[],
): number {
  let score = 0;
  const industry = normalizeContentText(company.industry);
  if (industry && text.includes(industry)) {
    score += W_INDUSTRY_EXACT;
    reasons.push(`업종 '${company.industry}' 일치`);
  } else if (industry.length >= 2 && text.includes(industry.slice(0, 2))) {
    score += W_INDUSTRY_PARTIAL;
    reasons.push("업종 키워드 일부 일치");
  }

  const fields = supportFieldsForCompany(company);
  if (
    program.support_field &&
    fields.includes(program.support_field as SupportField)
  ) {
    score += W_FIELD;
    reasons.push(`지원분야 '${program.support_field}' 적합`);
  }
  return score;
}

function scoreTags(
  company: CompanyProfile,
  program: GovProgramSlim,
  text: string,
  reasons: string[],
): number {
  const tags = normalizedTags(company.conditionTags);
  if (tags.length === 0) return 0;

  const programTags = new Set(normalizedTags(program.hashtags));
  const matched: string[] = [];
  company.conditionTags.forEach((tag, index) => {
    const normalized = tags[index];
    if (!normalized) return;
    if (programTags.has(normalized) || text.includes(normalized)) {
      matched.push(tag);
    }
  });
  if (matched.length === 0) return 0;

  reasons.push(`컨디션 태그 ${matched.slice(0, 3).join(", ")} 반영`);
  return Math.min(
    W_TAGS_MAX,
    Math.round((matched.length / tags.length) * W_TAGS_MAX),
  );
}

function scoreRegion(
  company: CompanyProfile,
  program: GovProgramSlim,
  reasons: string[],
  penaltyReasons: string[],
): number {
  if (isNationalProgram(program)) {
    reasons.push("전국 대상");
    return W_REGION;
  }
  const companyRegion = companyRegionOption(company.region);
  const programRegions = extractProgramRegions(program);
  if (!companyRegion || programRegions.length === 0) return 0;
  if (programRegions.includes(companyRegion)) {
    reasons.push("지역 조건 부합");
    return W_REGION;
  }
  penaltyReasons.push("지역 불일치 가능");
  return P_REGION_MISMATCH;
}

function companyAgeYears(company: CompanyProfile): number | null {
  if (!company.foundedDate) return null;
  const [year, month, day] = company.foundedDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const [todayYear, todayMonth, todayDay] = todayKstDate().split("-").map(Number);
  let years = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) years -= 1;
  return years;
}

const AGE_CONTEXT_PATTERN =
  "(?:창업|업력|설립|개업|사업\\s*개시|초기기업|창업기업|스타트업)";
const AGE_CONNECTOR_PATTERN =
  "(?:\\s*(?:후|이후|한|지|일|일로|일로부터|기업|자|업체|대상|기준|부터))*";
const AGE_YEAR_PATTERN = "년\\s*(?:차\\s*)?";
const AGE_OPERATOR_PATTERN = "(미만|이하|이내|이상|초과)";

function ageOperatorFromText(operator: string): AgeOperator {
  if (operator === "미만") return "lt";
  if (operator === "초과") return "gt";
  if (operator === "이상") return "gte";
  return "lte";
}

function ageRequirementKey(requirement: AgeRequirement): string {
  return `${requirement.operator}:${requirement.limit}`;
}

function ageRequirementFromText(
  limitText: string,
  operatorText: string,
): AgeRequirement | null {
  const limit = Number(limitText);
  if (!Number.isFinite(limit) || limit < 0) return null;
  return { limit, operator: ageOperatorFromText(operatorText) };
}

/**
 * 공고 텍스트에서 업력 조건을 그룹 단위로 추출.
 * 그룹 내부는 AND(범위 "3년 이상 7년 미만"), 그룹 사이는 OR(트랙별 조건).
 * 하나의 그룹만 만족해도 조건 충족으로 본다 — 멀티트랙 공고 오탈락 방지.
 */
function extractAgeRequirementGroups(text: string): AgeRequirement[][] {
  const rangeBeforeContext = new RegExp(
    `${AGE_CONTEXT_PATTERN}${AGE_CONNECTOR_PATTERN}\\s*(\\d+)\\s*${AGE_YEAR_PATTERN}(이상|초과)\\s*(\\d+)\\s*${AGE_YEAR_PATTERN}(미만|이하|이내)`,
    "g",
  );
  const rangeAfterContext = new RegExp(
    `(\\d+)\\s*${AGE_YEAR_PATTERN}(이상|초과)\\s*(\\d+)\\s*${AGE_YEAR_PATTERN}(미만|이하|이내)(?:\\s*(?:의|인))*\\s*${AGE_CONTEXT_PATTERN}`,
    "g",
  );
  const beforeContext = new RegExp(
    `${AGE_CONTEXT_PATTERN}${AGE_CONNECTOR_PATTERN}\\s*(\\d+)\\s*${AGE_YEAR_PATTERN}${AGE_OPERATOR_PATTERN}`,
    "g",
  );
  const afterContext = new RegExp(
    `(\\d+)\\s*${AGE_YEAR_PATTERN}${AGE_OPERATOR_PATTERN}(?:\\s*(?:의|인|이내의|이하의|미만의))*\\s*${AGE_CONTEXT_PATTERN}`,
    "g",
  );

  const groups = new Map<string, AgeRequirement[]>();
  const rangeMemberKeys = new Set<string>();

  for (const pattern of [rangeBeforeContext, rangeAfterContext]) {
    for (const match of text.matchAll(pattern)) {
      const lower = ageRequirementFromText(match[1], match[2]);
      const upper = ageRequirementFromText(match[3], match[4]);
      if (!lower || !upper) continue;
      const group = [lower, upper];
      groups.set(group.map(ageRequirementKey).join("|"), group);
      rangeMemberKeys.add(ageRequirementKey(lower));
      rangeMemberKeys.add(ageRequirementKey(upper));
    }
  }

  for (const pattern of [beforeContext, afterContext]) {
    for (const match of text.matchAll(pattern)) {
      const requirement = ageRequirementFromText(match[1], match[2]);
      if (!requirement) continue;
      const key = ageRequirementKey(requirement);
      // 범위의 절반이 단독 패턴으로 다시 잡힌 경우 — 범위 그룹이 이미 대표한다.
      if (rangeMemberKeys.has(key)) continue;
      groups.set(key, [requirement]);
    }
  }

  return [...groups.values()];
}

function meetsAgeRequirement(ageYears: number, requirement: AgeRequirement): boolean {
  if (requirement.operator === "lt") return ageYears < requirement.limit;
  if (requirement.operator === "lte") return ageYears <= requirement.limit;
  if (requirement.operator === "gt") return ageYears > requirement.limit;
  return ageYears >= requirement.limit;
}

function scoreScaleAndAge(
  company: CompanyProfile,
  text: string,
  reasons: string[],
  penaltyReasons: string[],
): number {
  let score = 0;
  const ageYears = companyAgeYears(company);
  const ageGroups = extractAgeRequirementGroups(text);
  if (ageGroups.length > 0 && ageYears !== null) {
    const ageMatched = ageGroups.some((group) =>
      group.every((requirement) => meetsAgeRequirement(ageYears, requirement)),
    );
    if (ageMatched) {
      score += W_AGE;
      reasons.push(`업력 ${ageYears}년 조건 부합`);
    } else {
      score += P_AGE_MISMATCH;
      penaltyReasons.push(`업력 ${ageYears}년 조건 확인 필요`);
    }
  } else if (ageYears !== null && text.includes("초기기업") && ageYears <= 7) {
    score += W_EARLY_STAGE;
    reasons.push("초기기업 조건 부합");
  }

  const headcountLimit = text.match(/(\d+)\s*명\s*(미만|이하)/);
  if (headcountLimit && company.headcount !== null) {
    const limit = Number(headcountLimit[1]);
    const inclusive = headcountLimit[2] === "이하";
    if (company.headcount < limit || (inclusive && company.headcount <= limit)) {
      score += W_HEADCOUNT;
      reasons.push(`인원 ${company.headcount}명 조건 부합`);
    }
  }

  const revenueLimit = text.match(/매출\s*(\d+)\s*억\s*(미만|이하)/);
  if (revenueLimit && company.revenue !== null) {
    const limit = Number(revenueLimit[1]) * 100_000_000;
    const inclusive = revenueLimit[2] === "이하";
    if (company.revenue < limit || (inclusive && company.revenue <= limit)) {
      score += W_REVENUE;
      reasons.push(`매출 조건 부합`);
    }
  }

  return score;
}

function evaluateEligibility(
  company: CompanyProfile,
  program: GovProgramSlim,
): EligibilityResult {
  const text = programText(program);
  const warnings: string[] = [];
  const blockers: string[] = [];
  let checks = 0;

  if (!isNationalProgram(program)) {
    const regions = extractProgramRegions(program);
    if (regions.length > 0) {
      checks += 1;
      const companyRegion = companyRegionOption(company.region);
      if (!companyRegion) warnings.push("기업 소재지 정보가 없어 지역 조건 확인이 필요합니다.");
      else if (!regions.includes(companyRegion)) blockers.push(`기업 소재지(${companyRegion})가 지원 지역과 다릅니다.`);
    }
  }

  const ageGroups = extractAgeRequirementGroups(text);
  if (ageGroups.length > 0) {
    checks += 1;
    const age = companyAgeYears(company);
    if (age === null) warnings.push("설립일 정보가 없어 업력 조건 확인이 필요합니다.");
    else if (!ageGroups.some((group) => group.every((requirement) => meetsAgeRequirement(age, requirement)))) {
      blockers.push(`업력 ${age}년이 공고의 업력 조건과 다릅니다.`);
    }
  }

  const headcountLimit = text.match(/(\d+)\s*명\s*(미만|이하)/);
  if (headcountLimit) {
    checks += 1;
    if (company.headcount === null) warnings.push("상시 인원 정보가 없어 인원 조건 확인이 필요합니다.");
    else {
      const limit = Number(headcountLimit[1]);
      const allowed = headcountLimit[2] === "이하" ? company.headcount <= limit : company.headcount < limit;
      if (!allowed) blockers.push(`상시 인원 ${company.headcount}명이 공고 기준을 초과합니다.`);
    }
  }

  const revenueLimit = text.match(/매출\s*(\d+)\s*억\s*(미만|이하)/);
  if (revenueLimit) {
    checks += 1;
    if (company.revenue === null) warnings.push("연 매출 정보가 없어 매출 조건 확인이 필요합니다.");
    else {
      const limit = Number(revenueLimit[1]) * 100_000_000;
      const allowed = revenueLimit[2] === "이하" ? company.revenue <= limit : company.revenue < limit;
      if (!allowed) blockers.push("기업 매출이 공고의 매출 상한을 초과합니다.");
    }
  }

  if (blockers.length > 0) {
    return { eligibility: "ineligible", warnings: blockers, checks };
  }
  if (warnings.length > 0) {
    return { eligibility: "review", warnings, checks };
  }
  return { eligibility: "eligible", warnings: [], checks };
}

function baseConfidence(
  completeness: number,
  eligibility: MatchEligibility,
  checks: number,
): MatchConfidence {
  if (eligibility === "review") return completeness >= 55 ? "medium" : "low";
  if (completeness >= 80 && (checks > 0 || eligibility === "eligible")) return "high";
  if (completeness >= 55) return "medium";
  return "low";
}

function meaningfulProgramTerms(program: GovProgramSlim): string[] {
  const generic = new Set(["사업", "지원", "기업", "공고", "모집", "대상", "정부", "중소기업"]);
  const values = [
    program.title,
    program.support_field,
    ...program.hashtags,
    program.summary,
    program.target_text,
  ];
  return Array.from(
    new Set(
      values
        .flatMap((value) => normalizeContentText(value).split(" "))
        .filter((term) => term.length >= 2 && !generic.has(term) && !/^\d+$/.test(term)),
    ),
  ).slice(0, 100);
}

export function scoreProgramForProfile(
  profile: CompanyMatchProfile,
  program: GovProgramSlim,
): ProgramMatch {
  const base = scoreProgram(profile.company, program);
  const terms = meaningfulProgramTerms(program);
  const evidence: ProgramMatchEvidence[] = [];
  const matchedTerms = new Set<string>();

  for (const source of profile.sources) {
    if (!source.included) continue;
    const sourceText = normalizeContentText(
      `${source.label} ${source.matchText ?? source.detail}`,
    );
    const matched = terms.filter((term) => sourceText.includes(term)).slice(0, 4);
    if (matched.length === 0) continue;
    matched.forEach((term) => matchedTerms.add(term));
    evidence.push({
      sourceKind: source.kind,
      sourceId: source.id,
      label: source.label,
      detail: `${matched.join(", ")} 관련 이력`,
      href: source.href,
    });
    if (evidence.length >= 6) break;
  }

  const historyBonus = Math.min(20, evidence.length * 3 + matchedTerms.size);
  const eligibility = evaluateEligibility(profile.company, program);
  const rawScore = Math.min(100, base.score + historyBonus);
  const score =
    eligibility.eligibility === "ineligible"
      ? Math.min(30, rawScore)
      : eligibility.eligibility === "review"
        ? Math.min(69, rawScore)
        : rawScore;
  const reasons = [...base.reasons];
  if (evidence.length > 0) {
    reasons.push(`등록 이력 ${evidence.length}건과 연관`);
  }

  return {
    ...base,
    score,
    eligibility: eligibility.eligibility,
    confidence: baseConfidence(profile.completeness, eligibility.eligibility, eligibility.checks),
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    warnings: eligibility.warnings,
    scoreBreakdown: [
      { key: "profile", label: "기업 기본정보", score: base.score, max: 100 },
      {
        key: "eligibility",
        label: "자격조건",
        score: eligibility.eligibility === "eligible" ? 20 : eligibility.eligibility === "review" ? 10 : 0,
        max: 20,
      },
      { key: "history", label: "등록 이력 연관", score: historyBonus, max: 20 },
    ],
    evidence,
  };
}

export function scoreProgram(
  company: CompanyProfile,
  program: GovProgramSlim,
): ProgramMatch {
  const reasons: string[] = [];
  // 감점 사유는 앞에 배치해 slice(0, 4)에서 잘리지 않게 한다.
  const penaltyReasons: string[] = [];
  const text = programText(program);

  const score =
    SCORE_BASE +
    scoreIndustryAndField(company, program, text, reasons) +
    scoreTags(company, program, text, reasons) +
    scoreRegion(company, program, reasons, penaltyReasons) +
    scoreScaleAndAge(company, text, reasons, penaltyReasons);

  const eligibility = evaluateEligibility(company, program);

  return {
    program,
    score: Math.max(0, Math.min(100, score)),
    reasons: [...penaltyReasons, ...reasons].slice(0, 4),
    eligibility: eligibility.eligibility,
    confidence: "medium",
    warnings: eligibility.warnings,
    scoreBreakdown: [
      { key: "profile", label: "기업 기본정보", score: Math.max(0, Math.min(100, score)), max: 100 },
      {
        key: "eligibility",
        label: "자격조건",
        score: eligibility.eligibility === "eligible" ? 20 : eligibility.eligibility === "review" ? 10 : 0,
        max: 20,
      },
      { key: "history", label: "등록 이력 연관", score: 0, max: 20 },
    ],
    evidence: [],
  };
}
