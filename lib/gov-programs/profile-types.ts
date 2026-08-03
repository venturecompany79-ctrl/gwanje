import type { CompanyProfile } from "@/lib/data/company-detail";

export type MatchProfileSourceKind =
  | "company"
  | "credential"
  | "ip_right"
  | "task"
  | "meeting_report"
  | "document";

export interface MatchProfileSource {
  kind: MatchProfileSourceKind;
  id: string;
  label: string;
  detail: string;
  href: string;
  included: boolean;
  updatedAt: string | null;
  analysisStatus?: "pending" | "ready" | "failed" | "skipped";
  /** 서버 매칭 전용. JSON 응답과 profile_json에는 포함하지 않는다. */
  matchText?: string;
}

export interface MatchProfileMissingItem {
  key:
    | "industry"
    | "businessCondition"
    | "region"
    | "foundedDate"
    | "revenue"
    | "headcount"
    | "conditionTags";
  label: string;
  description: string;
  href: string;
}

export interface CompanyMatchProfile {
  company: CompanyProfile;
  completeness: number;
  missingInformation: MatchProfileMissingItem[];
  sourceCounts: Record<MatchProfileSourceKind, number>;
  sources: MatchProfileSource[];
  keywords: string[];
  fingerprint: string;
  analyzedAt: string;
}

export function profileSourceLabel(kind: MatchProfileSourceKind): string {
  const labels: Record<MatchProfileSourceKind, string> = {
    company: "기업정보",
    credential: "자격·인증",
    ip_right: "특허·상표",
    task: "Task 이력",
    meeting_report: "미팅 보고서",
    document: "등록 자료",
  };
  return labels[kind];
}
