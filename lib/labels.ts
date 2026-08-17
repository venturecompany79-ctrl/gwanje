// enum(영문 DB 값) ↔ 한국어 UI 라벨 매핑 — CLAUDE.md 8절
import type {
  CampaignChannel,
  CampaignStatus,
  CredentialStatus,
  DocumentUploader,
  IpDeadlineType,
  IpRightKind,
  IpRightStatus,
  NotificationType,
  RecipientStatus,
  ScheduleType,
  TaskStage,
  TaskWorkStatus,
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

export const TASK_WORK_STATUS_LABEL: Record<TaskWorkStatus, string> = {
  planned: "예정",
  in_progress: "진행중",
  waiting: "대기",
  on_hold: "보류",
  completed: "완료",
};

export const TASK_WORK_STATUS_ORDER: TaskWorkStatus[] = [
  "planned",
  "in_progress",
  "waiting",
  "on_hold",
  "completed",
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

export const RECIPIENT_STATUS_LABEL: Record<RecipientStatus, string> = {
  pending: "대기중",
  sent: "발송됨",
  delivered: "도달",
  failed: "실패",
  skipped: "제외",
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

export type CompanyStatus = "active" | "ended";

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  active: "관리중",
  ended: "종료",
};

export const IP_RIGHT_KIND_LABEL: Record<IpRightKind, string> = {
  patent: "특허",
  trademark: "상표",
};

export const IP_RIGHT_STATUS_LABEL: Record<IpRightStatus, string> = {
  preparing: "준비중",
  filed: "출원",
  examining: "심사중",
  office_action: "중간사건",
  registered: "등록",
  rejected: "거절",
  abandoned: "포기",
  expired: "만료",
};

export const IP_DEADLINE_TYPE_LABEL: Record<IpDeadlineType, string> = {
  office_action: "의견제출 대응",
  registration_fee: "등록료 납부",
  renewal: "갱신",
  annuity: "연차료",
  etc: "기타",
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
