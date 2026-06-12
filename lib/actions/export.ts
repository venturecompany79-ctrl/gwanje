"use server";

// 대시보드 "내보내기" — D-day 통합 목록(deadline_item)을 CSV로 산출 (F17)
import { createClient } from "@/lib/supabase/server";
import { DEMO_DASHBOARD } from "@/lib/demo-data";
import type { DeadlineItem } from "@/lib/database.types";

const SOURCE_LABEL: Record<DeadlineItem["source"], string> = {
  credential: "자격·인증",
  task: "관리포인트",
  schedule: "일정",
};

function ddayLabel(daysLeft: number): string {
  if (daysLeft < 0) return `D+${-daysLeft}`;
  if (daysLeft === 0) return "D-day";
  return `D-${daysLeft}`;
}

function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  // 쉼표·따옴표·개행 포함 시 따옴표로 감싸고 내부 따옴표는 이중화
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: DeadlineItem[]): string {
  const header = ["구분", "기업명", "항목", "분류", "마감일", "D-day"];
  const lines = rows
    .slice()
    .sort((a, b) => a.days_left - b.days_left)
    .map((r) =>
      [
        SOURCE_LABEL[r.source],
        r.company_name ?? "",
        r.title,
        r.category_name ?? "",
        r.due_date,
        ddayLabel(r.days_left),
      ]
        .map(csvCell)
        .join(","),
    );
  return [header.join(","), ...lines].join("\r\n");
}

export async function getDeadlinesCsv(): Promise<string> {
  const supabase = await createClient();
  if (!supabase) {
    const demo = DEMO_DASHBOARD();
    return toCsv([...demo.overdue, ...demo.deadlines]);
  }

  const { data, error } = await supabase
    .from("deadline_item")
    .select("*")
    .order("due_date", { ascending: true });
  if (error) {
    console.error("[getDeadlinesCsv]", error.code, error.message);
    throw new Error(`내보내기에 실패했습니다: ${error.message}`);
  }

  return toCsv((data ?? []) as DeadlineItem[]);
}
