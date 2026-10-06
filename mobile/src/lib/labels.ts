import type { Database } from "@root/lib/database.types";

export type TaskWorkStatus = Database["public"]["Enums"]["task_work_status"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];

export const TASK_WORK_STATUS_LABEL: Record<TaskWorkStatus, string> = {
  planned: "할 일",
  in_progress: "진행중",
  waiting: "대기",
  on_hold: "대기", // 대기에 통합됨
  completed: "완료",
};

/** 선택 가능한 상태 — on_hold(보류)는 대기에 통합 */
export const TASK_WORK_STATUSES: TaskWorkStatus[] = [
  "planned",
  "in_progress",
  "waiting",
  "completed",
];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  expiry: "만료",
  deadline: "마감",
  program_match: "공고매칭",
};

export const TODO_TAGS = ["상담", "미팅", "서류", "기타"] as const;
export type TodoTag = (typeof TODO_TAGS)[number];
