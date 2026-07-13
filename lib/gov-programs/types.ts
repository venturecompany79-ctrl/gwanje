import type { Database, Json, Tables } from "@/lib/database.types";

export const SOURCE_CODES = ["bizinfo", "kstartup", "smes", "msit"] as const;
export type SourceCode = (typeof SOURCE_CODES)[number];

export const SUPPORT_FIELDS = [
  "금융",
  "기술",
  "인력",
  "수출",
  "내수",
  "창업",
  "경영",
  "기타",
] as const;
export type SupportField = (typeof SUPPORT_FIELDS)[number];

/** 지원분야 추론·기업 프로필 분야 도출 공용 키워드 (fetch 코드가 아닌 이곳에 두어 클라이언트 번들에서 http.ts를 배제). */
export const SUPPORT_KEYWORDS: Record<SupportField, string[]> = {
  금융: ["금융", "자금", "융자", "보증", "대출", "투자", "바우처"],
  기술: ["기술", "r&d", "연구", "개발", "스마트공장", "디지털", "ai", "ict"],
  인력: ["인력", "고용", "채용", "인건비", "교육", "훈련"],
  수출: ["수출", "해외", "글로벌", "무역", "전시회"],
  내수: ["내수", "판로", "마케팅", "브랜드", "유통"],
  창업: ["창업", "스타트업", "초기기업", "예비창업"],
  경영: ["경영", "컨설팅", "진단", "멘토링", "인증", "세액"],
  기타: ["기타"],
};

export type GovProgramRow = Tables<"gov_program">;
export type GovProgramInsert = Database["public"]["Tables"]["gov_program"]["Insert"];

/** 목록/추천 전송용 경량 행 — raw(jsonb)·search_vector 제외. */
export type GovProgramSlim = Omit<GovProgramRow, "raw" | "search_vector">;

export const GOV_PROGRAM_SLIM_COLUMNS =
  "id, source, external_id, content_key, title, support_field, org_name, target_text, hashtags, region, apply_start, apply_end, detail_url, synced_at, created_at";

export interface NormalizedProgram {
  source: SourceCode;
  externalId: string;
  contentKey: string;
  title: string;
  supportField: SupportField | null;
  orgName: string | null;
  targetText: string | null;
  hashtags: string[];
  region: string | null;
  applyStart: string | null;
  applyEnd: string | null;
  detailUrl: string | null;
  raw: Json | null;
}

export interface SourceAdapter {
  code: SourceCode;
  fetch(): Promise<NormalizedProgram[]>;
}

export function isSourceCode(value: string): value is SourceCode {
  return SOURCE_CODES.includes(value as SourceCode);
}

export function isSupportField(value: string | null): value is SupportField {
  return Boolean(value && SUPPORT_FIELDS.includes(value as SupportField));
}

export function normalizeContentText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function smallHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/** http(s) 스킴만 허용 — javascript:/data: 등 스크립트 실행 스킴을 링크 렌더에서 차단. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function makeContentKey(
  program: Pick<NormalizedProgram, "title" | "orgName" | "applyEnd">,
): string {
  const normalized = [
    normalizeContentText(program.title),
    normalizeContentText(program.orgName),
    program.applyEnd ?? "",
  ].join("|");
  return `${smallHash(normalized)}:${normalized.slice(0, 180)}`;
}

export function toGovProgramInsert(
  program: NormalizedProgram,
): GovProgramInsert {
  return {
    source: program.source,
    external_id: program.externalId,
    content_key: program.contentKey,
    title: program.title,
    support_field: program.supportField,
    org_name: program.orgName,
    target_text: program.targetText,
    hashtags: program.hashtags,
    region: program.region,
    apply_start: program.applyStart,
    apply_end: program.applyEnd,
    detail_url: safeHttpUrl(program.detailUrl),
    raw: program.raw,
    synced_at: new Date().toISOString(),
  };
}
