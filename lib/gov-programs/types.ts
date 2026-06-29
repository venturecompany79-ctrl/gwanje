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

export type GovProgramRow = Tables<"gov_program">;
export type GovProgramInsert = Database["public"]["Tables"]["gov_program"]["Insert"];

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
    detail_url: program.detailUrl,
    raw: program.raw,
    synced_at: new Date().toISOString(),
  };
}
