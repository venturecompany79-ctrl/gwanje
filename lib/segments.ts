// 캠페인 세그먼트(조건 빌더) — campaign.segment jsonb({rules,join})와 1:1 대응.
// 마법사 실시간 미리보기(클라이언트)와 저장(서버) 양쪽에서 쓰므로 순수 모듈로 분리.
import type { Json } from "@/lib/database.types";

export type SegmentField =
  | "credential"
  | "industry"
  | "condition"
  | "revenue"
  | "due_soon";
export type SegmentOp =
  | "has"
  | "not_has"
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte";
export type SegmentJoin = "and" | "or";

export interface SegmentRule {
  field: SegmentField;
  /** revenue=억 단위, due_soon=일수, 나머지는 문자열 */
  op: SegmentOp;
  value: string | number;
}

export interface Segment {
  rules: SegmentRule[];
  join: SegmentJoin;
}

/** 세그먼트 평가 대상 기업 — 미리보기·발송 대상 산출에 필요한 필드만 */
export interface SegmentCompany {
  id: string;
  name: string;
  industry: string | null;
  revenue: number | null;
  conditionTags: string[];
  credentialTypes: string[];
  /** 다가오는 항목 중 가장 임박한 D-day — deadline_item 뷰 기준, 없으면 null */
  nearestDaysLeft: number | null;
  /** 폰 미리보기 {담당자명} 치환용 */
  contactName: string | null;
}

export const SEGMENT_FIELDS: SegmentField[] = [
  "credential",
  "industry",
  "condition",
  "revenue",
  "due_soon",
];

export const SEGMENT_FIELD_LABEL: Record<SegmentField, string> = {
  credential: "보유자격",
  industry: "업종",
  condition: "컨디션",
  revenue: "매출(억)",
  due_soon: "임박 마감(일)",
};

export const SEGMENT_OPS: Record<
  SegmentField,
  { value: SegmentOp; label: string }[]
> = {
  credential: [
    { value: "has", label: "보유" },
    { value: "not_has", label: "미보유" },
  ],
  industry: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
  ],
  condition: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
  ],
  revenue: [
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
  ],
  due_soon: [{ value: "lte", label: "이내" }],
};

function matchesRule(co: SegmentCompany, rule: SegmentRule): boolean {
  switch (rule.field) {
    case "credential": {
      const has = co.credentialTypes.includes(String(rule.value));
      return rule.op === "not_has" ? !has : has;
    }
    case "industry": {
      const eq = (co.industry ?? "") === String(rule.value);
      return rule.op === "neq" ? !eq : eq;
    }
    case "condition": {
      const has = co.conditionTags.includes(String(rule.value));
      return rule.op === "neq" ? !has : has;
    }
    case "revenue": {
      const limit = Number(rule.value);
      if (co.revenue === null || Number.isNaN(limit)) return false;
      const eok = co.revenue / 100_000_000;
      if (rule.op === "lt") return eok < limit;
      if (rule.op === "lte") return eok <= limit;
      if (rule.op === "gt") return eok > limit;
      if (rule.op === "gte") return eok >= limit;
      return false;
    }
    case "due_soon": {
      const days = Number(rule.value);
      if (Number.isNaN(days)) return false;
      return co.nearestDaysLeft !== null && co.nearestDaysLeft <= days;
    }
  }
}

/** 조건이 하나도 없으면 0건 (실수로 전 기업 발송 방지) */
export function evaluateSegment(
  companies: SegmentCompany[],
  segment: Segment,
): SegmentCompany[] {
  if (segment.rules.length === 0) return [];
  return companies.filter((co) =>
    segment.join === "or"
      ? segment.rules.some((rule) => matchesRule(co, rule))
      : segment.rules.every((rule) => matchesRule(co, rule)),
  );
}

function ruleSummary(rule: SegmentRule): string {
  const opLabel =
    SEGMENT_OPS[rule.field].find((op) => op.value === rule.op)?.label ?? "";
  switch (rule.field) {
    case "credential":
      return `${rule.value} ${opLabel}`;
    case "industry":
      return `업종${opLabel}${rule.value}`;
    case "condition":
      return `컨디션${opLabel}${rule.value}`;
    case "revenue":
      return `매출 ${opLabel} ${rule.value}억`;
    case "due_soon":
      return `마감 ${rule.value}일 이내`;
  }
}

/** 목록 세그먼트 요약 칩 텍스트 — 조건 없으면 null */
export function summarizeSegment(segment: Segment): string | null {
  if (segment.rules.length === 0) return null;
  const first = ruleSummary(segment.rules[0]);
  return segment.rules.length > 1
    ? `${first} 외 ${segment.rules.length - 1}`
    : first;
}

/** jsonb → Segment 안전 파싱 — 형식이 깨진 룰은 버린다 */
export function parseSegment(json: Json): Segment {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { rules: [], join: "and" };
  }
  const obj = json as { [key: string]: Json | undefined };
  const rules: SegmentRule[] = [];
  if (Array.isArray(obj.rules)) {
    for (const raw of obj.rules) {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        continue;
      }
      const rule = raw as { [key: string]: Json | undefined };
      if (
        typeof rule.field !== "string" ||
        !(SEGMENT_FIELDS as string[]).includes(rule.field) ||
        typeof rule.op !== "string" ||
        (typeof rule.value !== "string" && typeof rule.value !== "number")
      ) {
        continue;
      }
      const field = rule.field as SegmentField;
      if (!SEGMENT_OPS[field].some((op) => op.value === rule.op)) continue;
      rules.push({ field, op: rule.op as SegmentOp, value: rule.value });
    }
  }
  return { rules, join: obj.join === "or" ? "or" : "and" };
}

/** Segment → jsonb 저장용 */
export function segmentToJson(segment: Segment): Json {
  return {
    rules: segment.rules.map((rule) => ({
      field: rule.field,
      op: rule.op,
      value: rule.value,
    })),
    join: segment.join,
  };
}
