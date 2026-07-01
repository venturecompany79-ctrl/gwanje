import type { Database } from "@root/lib/database.types";

export type TaskStage = Database["public"]["Enums"]["task_stage"];
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

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  expiry: "만료",
  deadline: "마감",
  program_match: "공고매칭",
};

export const TODO_TAGS = ["업무", "미팅", "기록"] as const;
export type TodoTag = (typeof TODO_TAGS)[number];
