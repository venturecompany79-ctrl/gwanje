import type { Json } from "@/lib/database.types";

export type MeetingReportStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed";

export type MeetingReportSourceRole = "company_info" | "meeting_note";

export interface ReportKpi {
  value: string;
  label: string;
}

export type ReportComponent =
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | {
      type: "lead_in_bullets";
      items: Array<string | { lead: string; rest: string }>;
    }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "kpi_strip"; items: ReportKpi[] }
  | { type: "callout"; label: string; text: string };

export interface ReportSection {
  eyebrow?: string;
  title: string;
  intro?: string;
  components: ReportComponent[];
}

export interface ReportData {
  cover: {
    company_name: string;
    subtitle?: string;
    volume?: string;
    prepared_for?: string;
    prepared_by?: string;
    date?: string;
  };
  executive_summary?: {
    eyebrow?: string;
    title: string;
    intro?: string;
    kpi?: ReportKpi[];
    key_takeaway?: string;
  };
  meta_table?: string[][];
  sections: ReportSection[];
  closing?: ReportSection | null;
}

export interface ReportBundle {
  full: ReportData;
  summary: ReportData;
}

export function asReportData(value: Json | null): ReportData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as unknown as ReportData;
}

export function asReportBundle(value: Json | null): ReportBundle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const bundle = value as Record<string, unknown>;
  if (!bundle.full || !bundle.summary) return null;
  return value as unknown as ReportBundle;
}
