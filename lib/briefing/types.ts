export interface BriefingSource {
  id: string;
  title: string;
  companyId: string | null;
  companyName: string | null;
  href: string;
  dueDate: string | null;
  daysLeft: number | null;
  completed: boolean;
  responsibility: "direct" | "management";
  memo: string;
  version: string;
}

export interface BriefingSnapshot {
  date: string;
  accessKey: string;
  sources: BriefingSource[];
  completedToday: string[];
}

export interface BriefingResult {
  summary: string;
  priorities: { sourceId: string; reason: string; nextAction: string }[];
  plan: string[];
  changes: string[];
  sources: BriefingSource[];
  dataAsOf: string;
  generatedAt: string;
}

export interface BriefingView {
  briefing: { id: string; result: BriefingResult } | null;
  checkedAt: string | null;
  nextAt: string | null;
  job: { id: string; status: string; error_code: string | null } | null;
  stale: boolean;
}
