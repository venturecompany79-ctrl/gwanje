// enum(영문 DB 값) ↔ 한국어 UI 라벨 매핑 — CLAUDE.md 8절
import type {
  CampaignChannel,
  CampaignStatus,
  CredentialStatus,
  DocumentUploader,
  NotificationType,
  ScheduleType,
  TaskStage,
} from "@/lib/database.types";
import type { SourceCode, SupportField } from "@/lib/gov-programs/types";

export const TASK_STAGE_LABEL: Record<TaskStage, string> = {
  diagnosis: "현황진단",
  proposal: "제안",
  application: "신청",
  result: "결과",
};

export const TASK_STAGE_ORDER: TaskStage[] = [
  "diagnosis",
  "proposal",
  "application",
  "result",
];

export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  expiry: "만료",
  deadline: "마감",
  meeting: "미팅",
  renewal: "갱신",
  etc: "기타",
};

export const DOCUMENT_UPLOADER_LABEL: Record<DocumentUploader, string> = {
  consultant: "컨설턴트",
  client: "고객사",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "임시저장",
  scheduled: "예약됨",
  sending: "발송중",
  sent: "발송완료",
};

export const CAMPAIGN_CHANNEL_LABEL: Record<CampaignChannel, string> = {
  alimtalk: "알림톡",
  email: "이메일",
};

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  expiry: "만료",
  deadline: "마감",
  program_match: "공고매칭",
};

export const CREDENTIAL_STATUS_LABEL: Record<CredentialStatus, string> = {
  valid: "유효",
  expiring: "임박",
  expired: "만료",
};

export const SUPPORT_FIELD_LABEL: Record<SupportField, string> = {
  금융: "금융",
  기술: "기술",
  인력: "인력",
  수출: "수출",
  내수: "내수",
  창업: "창업",
  경영: "경영",
  기타: "기타",
};

export const PROGRAM_SOURCE_LABEL: Record<SourceCode, string> = {
  bizinfo: "기업마당",
  kstartup: "K-Startup",
  smes: "중기부",
  msit: "과기정통부",
};
