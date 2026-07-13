import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { MemberContext } from "@/lib/actions/shared";
import type { ProposedGeminiAction } from "@/lib/assistant/gemini";
import type {
  AssistantActionProposal,
  CampaignDraftPayload,
  CompanyMemoAppendPayload,
  TaskCreatePayload,
  TaskUpdatePayload,
} from "@/lib/assistant/types";

type Supabase = SupabaseClient<Database>;

function toJson(value: unknown): Json {
  return value as Json;
}

function ensureAllowedCompany(companyId: string, allowedCompanyIds: Set<string>) {
  if (!allowedCompanyIds.has(companyId)) {
    throw new Error("AI가 현재 관제 범위 밖의 기업을 변경하려 했습니다.");
  }
}

function proposalCopy(action: ProposedGeminiAction): {
  title: string;
  summary: string;
  targetType: string | null;
  targetId: string | null;
} {
  switch (action.type) {
    case "task.create": {
      const payload = action.payload as TaskCreatePayload;
      return {
        title: "관리 과제 만들기",
        summary: `‘${payload.title}’ 과제를 새로 만듭니다.`,
        targetType: "company",
        targetId: payload.companyId,
      };
    }
    case "task.update": {
      const payload = action.payload as TaskUpdatePayload;
      return {
        title: "관리 과제 수정",
        summary: "선택한 과제의 제목·마감일 또는 메모를 수정합니다.",
        targetType: "task",
        targetId: payload.taskId,
      };
    }
    case "company.memo_append": {
      const payload = action.payload as CompanyMemoAppendPayload;
      return {
        title: "기업 메모에 추가",
        summary: "기존 내용을 보존하고 메모 끝에 AI 초안을 추가합니다.",
        targetType: "company",
        targetId: payload.companyId,
      };
    }
    case "campaign.draft": {
      const payload = action.payload as CampaignDraftPayload;
      return {
        title: "일괄안내 초안 만들기",
        summary: `${payload.companyIds.length}개사 대상 ‘${payload.title}’ 초안을 임시저장합니다.`,
        targetType: "campaign",
        targetId: null,
      };
    }
  }
}

export async function createActionProposal(
  supabase: Supabase,
  member: MemberContext,
  input: {
    conversationId: string;
    action: ProposedGeminiAction;
    allowedCompanyIds: string[];
  },
): Promise<AssistantActionProposal> {
  const allowedCompanyIds = new Set(input.allowedCompanyIds);
  let preview: Record<string, Json>;

  switch (input.action.type) {
    case "task.create": {
      const payload = input.action.payload as TaskCreatePayload;
      ensureAllowedCompany(payload.companyId, allowedCompanyIds);
      const company = await supabase
        .from("company")
        .select("id, name")
        .eq("id", payload.companyId)
        .maybeSingle();
      if (company.error || !company.data) {
        throw new Error("과제를 만들 기업을 찾을 수 없습니다.");
      }
      preview = {
        changes: toJson([
          { label: "기업", after: company.data.name },
          { label: "과제 제목", after: payload.title },
          ...(payload.dueDate
            ? [{ label: "기한", after: payload.dueDate }]
            : []),
          ...(payload.memo ? [{ label: "메모", after: payload.memo }] : []),
        ]),
      };
      break;
    }
    case "task.update": {
      const payload = input.action.payload as TaskUpdatePayload;
      const task = await supabase
        .from("task")
        .select("id, company_id, title, due_date, memo")
        .eq("id", payload.taskId)
        .maybeSingle();
      if (task.error || !task.data) throw new Error("수정할 과제를 찾을 수 없습니다.");
      ensureAllowedCompany(task.data.company_id, allowedCompanyIds);
      preview = {
        changes: toJson([
          ...(payload.title
            ? [
                {
                  label: "과제 제목",
                  before: task.data.title,
                  after: payload.title,
                },
              ]
            : []),
          ...(Object.hasOwn(payload, "dueDate")
            ? [
                {
                  label: "기한",
                  before: task.data.due_date ?? "없음",
                  after: payload.dueDate ?? "없음",
                },
              ]
            : []),
          ...(payload.memoAppend
            ? [{ label: "메모 추가", after: payload.memoAppend }]
            : []),
        ]),
      };
      break;
    }
    case "company.memo_append": {
      const payload = input.action.payload as CompanyMemoAppendPayload;
      ensureAllowedCompany(payload.companyId, allowedCompanyIds);
      const company = await supabase
        .from("company")
        .select("id, name")
        .eq("id", payload.companyId)
        .maybeSingle();
      if (company.error || !company.data) {
        throw new Error("메모를 추가할 기업을 찾을 수 없습니다.");
      }
      preview = {
        changes: toJson([
          { label: "기업", after: company.data.name },
          { label: "메모 추가", after: payload.content },
        ]),
      };
      break;
    }
    case "campaign.draft": {
      const payload = input.action.payload as CampaignDraftPayload;
      for (const companyId of payload.companyIds) {
        ensureAllowedCompany(companyId, allowedCompanyIds);
      }
      preview = {
        changes: toJson([
          { label: "안내 제목", after: payload.title },
          { label: "대상", after: `${payload.companyIds.length}개사` },
          { label: "내용", after: payload.body },
        ]),
      };
      break;
    }
  }

  const copy = proposalCopy(input.action);
  const actionPreview: Record<string, Json> = {
    title: copy.title,
    summary: copy.summary,
    ...preview,
  };
  const actionId = crypto.randomUUID();
  const created = await supabase.from("ai_action").insert({
    id: actionId,
    tenant_id: member.tenantId,
    conversation_id: input.conversationId,
    action_type: input.action.type,
    status: "pending",
    payload: toJson(input.action.payload),
    preview: toJson(actionPreview),
    target_type: copy.targetType,
    target_id: copy.targetId,
    requested_by: member.userId,
  });
  if (created.error) {
    throw new Error(`AI 실행 제안을 저장하지 못했습니다: ${created.error.message}`);
  }

  return {
    id: actionId,
    type: input.action.type,
    title: copy.title,
    summary: copy.summary,
    targetType: copy.targetType,
    targetId: copy.targetId,
    payload: input.action.payload,
    preview: actionPreview,
    status: "pending",
  };
}
