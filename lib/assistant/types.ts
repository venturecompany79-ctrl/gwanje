export const ASSISTANT_ACTION_TYPES = [
  "task.create",
  "task.update",
  "company.memo_append",
  "campaign.draft",
] as const;

export type AssistantActionType = (typeof ASSISTANT_ACTION_TYPES)[number];

export type AssistantScope =
  | { mode: "mine" }
  | { mode: "team"; consultantId?: string | "unassigned" | null };

export interface AssistantChatRequest {
  conversationId?: string | null;
  message: string;
  scope: AssistantScope;
  companyId?: string | null;
  documentIds?: string[];
}

export interface AssistantSource {
  id: string;
  kind: "company" | "task" | "deadline" | "notification" | "document";
  label: string;
  href: string | null;
}

export interface TaskCreatePayload {
  companyId: string;
  title: string;
  dueDate: string | null;
  memo: string | null;
}

export interface TaskUpdatePayload {
  taskId: string;
  title?: string;
  dueDate?: string | null;
  memoAppend?: string | null;
}

export interface CompanyMemoAppendPayload {
  companyId: string;
  content: string;
}

export interface CampaignDraftPayload {
  title: string;
  body: string;
  companyIds: string[];
}

export type AssistantActionPayload =
  | TaskCreatePayload
  | TaskUpdatePayload
  | CompanyMemoAppendPayload
  | CampaignDraftPayload;

export interface AssistantActionProposal {
  id: string;
  type: AssistantActionType;
  title: string;
  summary: string;
  targetType: string | null;
  targetId: string | null;
  payload: AssistantActionPayload;
  preview: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executing" | "executed" | "failed";
}

export type AssistantStreamEvent =
  | { type: "meta"; conversationId: string; messageId: string }
  | { type: "delta"; text: string }
  | { type: "sources"; sources: AssistantSource[] }
  | { type: "action"; action: AssistantActionProposal }
  | { type: "done" }
  | { type: "error"; message: string };

export function isAssistantActionType(value: string): value is AssistantActionType {
  return ASSISTANT_ACTION_TYPES.some((type) => type === value);
}
