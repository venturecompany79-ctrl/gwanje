import type { Database } from "@root/lib/database.types";

export type TaskStage = Database["public"]["Enums"]["task_stage"];
export type TaskWorkStatus = Database["public"]["Enums"]["task_work_status"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];

export const TASK_STAGE_LABEL: Record<TaskStage, string> = {
  diagnosis: "진단",
  proposal: "제안",
  application: "신청",
  result: "결과",
};

export const TASK_STAGES: TaskStage[] = [
  "diagnosis",
  "proposal",
  "application",
  "result",
];

export const TASK_WORK_STATUS_LABEL: Record<TaskWorkStatus, string> = {
  planned: "예정",
  in_progress: "진행중",
  waiting: "대기",
  on_hold: "보류",
  completed: "완료",
};

export const TASK_WORK_STATUSES: TaskWorkStatus[] = [
  "planned",
  "in_progress",
  "waiting",
  "on_hold",
  "completed",
];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  expiry: "만료",
  deadline: "마감",
  program_match: "공고매칭",
};

export const TODO_TAGS = ["상담", "미팅", "서류", "기타"] as const;
export type TodoTag = (typeof TODO_TAGS)[number];
