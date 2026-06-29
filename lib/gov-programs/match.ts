import type { CompanyProfile } from "@/lib/data/company-detail";
import { daysFromToday, todayKstDate } from "@/lib/datetime";
import type {
  GovProgramRow,
  SupportField,
} from "@/lib/gov-programs/types";
import { normalizeContentText } from "@/lib/gov-programs/types";

export const PROGRAM_MATCH_THRESHOLD = 30;

export interface ProgramMatch {
  program: GovProgramRow;
  score: number;
  reasons: string[];
}

type AgeOperator = "lt" | "lte" | "gt" | "gte";

interface AgeRequirement {
  limit: number;
  operator: AgeOperator;
}

interface ScaleAndAgeScore {
  score: number;
  disqualified: boolean;
}

const FIELD_KEYWORDS: Record<SupportField, string[]> = {
  금융: ["자금", "금융", "융자", "보증", "대출", "투자", "운전자금"],
  기술: ["제조", "r&d", "연구", "개발", "기술", "스마트공장", "ai", "ict"],
  인력: ["인력", "고용", "채용", "교육", "훈련"],
  수출: ["수출", "해외", "글로벌", "무역"],
  내수: ["판로", "마케팅", "브랜드", "유통", "내수"],
  창업: ["창업", "스타트업", "초기기업", "예비창업"],
  경영: ["경영", "컨설팅", "진단", "멘토링", "인증", "세액"],
  기타: [],
};

function programText(program: GovProgramRow): string {
  return normalizeContentText(
    [
      program.title,
      program.support_field,
      program.org_name,
      program.target_text,
      program.hashtags.join(" "),
    ].join(" "),
  );
}

function normalizedTags(tags: string[]): string[] {
  return tags.map(normalizeContentText).filter(Boolean);
}

export function supportFieldsForCompany(company: CompanyProfile): SupportField[] {
  const text = normalizeContentText(
    [company.industry, ...company.conditionTags].filter(Boolean).join(" "),
  );
  const fields = new Set<SupportField>();
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS) as [
    SupportField,
    string[],
  ][]) {
    if (field === "기타") continue;
    if (keywords.some((keyword) => text.includes(normalizeContentText(keyword)))) {
      fields.add(field);
    }
  }
  if (fields.size === 0 && company.conditionTags.length > 0) fields.add("경영");
  return [...fields];
}

export function queryTextForCompany(company: CompanyProfile): string {
  return [company.industry, ...company.conditionTags]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function scoreIndustryAndField(
  company: CompanyProfile,
  program: GovProgramRow,
  text: string,
  reasons: string[],
): number {
  let score = 0;
  const industry = normalizeContentText(company.industry);
  if (industry && text.includes(industry)) {
    score += 24;
    reasons.push(`업종 '${company.industry}' 일치`);
  }

  const fields = supportFieldsForCompany(company);
  if (
    program.support_field &&
    fields.includes(program.support_field as SupportField)
  ) {
    score += 16;
    reasons.push(`지원분야 '${program.support_field}' 적합`);
  }

  if (score === 0 && company.industry && text.includes(company.industry.slice(0, 2))) {
    score += 10;
    reasons.push("업종 키워드 일부 일치");
  }
  return Math.min(score, 40);
}

function scoreTags(
  company: CompanyProfile,
  program: GovProgramRow,
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
  return Math.min(30, Math.round((matched.length / tags.length) * 30));
}

function scoreDeadline(program: GovProgramRow, reasons: string[]): number {
  if (!program.apply_end) return 0;
  const daysLeft = daysFromToday(program.apply_end);
  if (daysLeft < 0) return 0;
  if (daysLeft <= 7) {
    reasons.push(daysLeft === 0 ? "오늘 마감" : `마감 D-${daysLeft}`);
    return 15;
  }
  if (daysLeft <= 14) {
    reasons.push(`2주 내 마감`);
    return 12;
  }
  if (daysLeft <= 30) return 8;
  if (daysLeft <= 60) return 5;
  return 2;
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

function addAgeRequirement(
  requirements: Map<string, AgeRequirement>,
  limitText: string,
  operatorText: string,
) {
  const limit = Number(limitText);
  if (!Number.isFinite(limit) || limit < 0) return;
  const requirement = {
    limit,
    operator: ageOperatorFromText(operatorText),
  };
  requirements.set(ageRequirementKey(requirement), requirement);
}

function extractAgeRequirements(text: string): AgeRequirement[] {
  const requirements = new Map<string, AgeRequirement>();
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

  for (const match of text.matchAll(rangeBeforeContext)) {
    addAgeRequirement(requirements, match[1], match[2]);
    addAgeRequirement(requirements, match[3], match[4]);
  }
  for (const match of text.matchAll(rangeAfterContext)) {
    addAgeRequirement(requirements, match[1], match[2]);
    addAgeRequirement(requirements, match[3], match[4]);
  }
  for (const match of text.matchAll(beforeContext)) {
    addAgeRequirement(requirements, match[1], match[2]);
  }
  for (const match of text.matchAll(afterContext)) {
    addAgeRequirement(requirements, match[1], match[2]);
  }

  return [...requirements.values()];
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
): ScaleAndAgeScore {
  let score = 0;
  const ageYears = companyAgeYears(company);
  const ageRequirements = extractAgeRequirements(text);
  if (ageRequirements.length > 0 && ageYears !== null) {
    const ageMatched = ageRequirements.every((requirement) =>
      meetsAgeRequirement(ageYears, requirement),
    );
    if (ageMatched) {
      score += 8;
      reasons.push(`업력 ${ageYears}년 조건 부합`);
    } else {
      reasons.push(`업력 ${ageYears}년 조건 미충족`);
      return { score: 0, disqualified: true };
    }
  } else if (ageYears !== null && text.includes("초기기업") && ageYears <= 7) {
    score += 6;
    reasons.push("초기기업 조건 부합");
  }

  const headcountLimit = text.match(/(\d+)\s*명\s*(미만|이하)/);
  if (headcountLimit && company.headcount !== null) {
    const limit = Number(headcountLimit[1]);
    const inclusive = headcountLimit[2] === "이하";
    if (company.headcount < limit || (inclusive && company.headcount <= limit)) {
      score += 4;
      reasons.push(`인원 ${company.headcount}명 조건 부합`);
    }
  }

  const revenueLimit = text.match(/매출\s*(\d+)\s*억\s*(미만|이하)/);
  if (revenueLimit && company.revenue !== null) {
    const limit = Number(revenueLimit[1]) * 100_000_000;
    const inclusive = revenueLimit[2] === "이하";
    if (company.revenue < limit || (inclusive && company.revenue <= limit)) {
      score += 3;
      reasons.push(`매출 조건 부합`);
    }
  }

  return { score: Math.min(score, 15), disqualified: false };
}

export function scoreProgram(
  company: CompanyProfile,
  program: GovProgramRow,
): ProgramMatch {
  const reasons: string[] = [];
  const text = programText(program);
  const scaleAndAge = scoreScaleAndAge(company, text, reasons);
  if (scaleAndAge.disqualified) {
    return {
      program,
      score: 0,
      reasons: reasons.slice(0, 4),
    };
  }

  const score =
    scoreIndustryAndField(company, program, text, reasons) +
    scoreTags(company, program, text, reasons) +
    scoreDeadline(program, reasons) +
    scaleAndAge.score;

  return {
    program,
    score: Math.min(100, score),
    reasons: reasons.slice(0, 4),
  };
}
