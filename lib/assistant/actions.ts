import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import {
  assertCompanyAccess,
  requirePermission,
  type MemberContext,
} from "@/lib/actions/shared";
import { isValidDateString, todayKstDate } from "@/lib/datetime";
import type {
  AssistantActionType,
  CampaignDraftPayload,
  CompanyMemoAppendPayload,
  TaskCreatePayload,
  TaskUpdatePayload,
} from "@/lib/assistant/types";
import { isAssistantActionType } from "@/lib/assistant/types";

type Supabase = SupabaseClient<Database>;

interface StoredAction {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  action_type: string;
  status: string;
  payload: Json;
  requested_by: string;
}

export interface AssistantActionResult {
  ok: boolean;
  error: string | null;
  action?: {
    id: string;
    status: "rejected" | "executed" | "failed";
    href?: string | null;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(
  record: Record<string, unknown>,
  key: string,
  required = true,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    if (required) throw new Error("AI 실행 정보가 올바르지 않습니다.");
    return null;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("AI 실행 정보가 올바르지 않습니다.");
  }
  return value.trim();
}

function optionalDate(record: Record<string, unknown>, key: string): string | null {
  if (!Object.hasOwn(record, key) || record[key] === null) return null;
  const value = stringValue(record, key);
  if (!value || !isValidDateString(value)) {
    throw new Error("AI가 제안한 날짜 형식이 올바르지 않습니다.");
  }
  return value;
}

function parsePayload(type: AssistantActionType, value: Json) {
  if (!isRecord(value)) throw new Error("AI 실행 정보가 올바르지 않습니다.");
  switch (type) {
    case "task.create": {
      const payload: TaskCreatePayload = {
        companyId: stringValue(value, "companyId")!,
        title: stringValue(value, "title")!,
        dueDate: optionalDate(value, "dueDate"),
        memo: stringValue(value, "memo", false),
      };
      return payload;
    }
    case "task.update": {
      const payload: TaskUpdatePayload = {
        taskId: stringValue(value, "taskId")!,
      };
      if (Object.hasOwn(value, "title")) payload.title = stringValue(value, "title")!;
      if (Object.hasOwn(value, "dueDate")) payload.dueDate = optionalDate(value, "dueDate");
      if (Object.hasOwn(value, "memoAppend")) {
        payload.memoAppend = stringValue(value, "memoAppend", false);
      }
      if (!payload.title && !Object.hasOwn(payload, "dueDate") && !payload.memoAppend) {
        throw new Error("수정할 과제 내용이 없습니다.");
      }
      return payload;
    }
    case "company.memo_append": {
      const payload: CompanyMemoAppendPayload = {
        companyId: stringValue(value, "companyId")!,
        content: stringValue(value, "content")!,
      };
      return payload;
    }
    case "campaign.draft": {
      const rawIds = value.companyIds;
      if (!Array.isArray(rawIds)) throw new Error("안내 대상이 올바르지 않습니다.");
      const companyIds = rawIds.flatMap((item) =>
        typeof item === "string" && item.trim() ? [item.trim()] : [],
      );
      if (companyIds.length === 0) throw new Error("안내 대상이 없습니다.");
      const payload: CampaignDraftPayload = {
        title: stringValue(value, "title")!,
        body: stringValue(value, "body")!,
        companyIds: Array.from(new Set(companyIds)),
      };
      return payload;
    }
  }
}

async function loadAction(
  supabase: Supabase,
  actionId: string,
  member: MemberContext,
): Promise<StoredAction> {
  const result = await supabase
    .from("ai_action")
    .select("id, tenant_id, conversation_id, action_type, status, payload, requested_by")
    .eq("id", actionId)
    .eq("requested_by", member.userId)
    .maybeSingle();
  if (result.error) throw new Error(`AI 실행 제안을 확인하지 못했습니다: ${result.error.message}`);
  if (!result.data) throw new Error("AI 실행 제안을 찾을 수 없습니다.");
  if (result.data.tenant_id !== member.tenantId) throw new Error("접근할 수 없는 AI 실행 제안입니다.");
  return result.data;
}

async function permissionForAction(
  supabase: Supabase,
  type: AssistantActionType,
): Promise<MemberContext> {
  const permission =
    type === "task.create" || type === "task.update"
      ? "tasks.write"
      : type === "company.memo_append"
        ? "companies.write"
        : "campaigns.write";
  const member = await requirePermission(supabase, permission);
  if ("error" in member) throw new Error(member.error);
  return member;
}

async function executeTaskCreate(
  supabase: Supabase,
  member: MemberContext,
  payload: TaskCreatePayload,
) {
  const access = await assertCompanyAccess(supabase, payload.companyId, member.tenantId);
  if (!access.ok) throw new Error(access.error);
  const result = await supabase
    .from("task")
    .insert({
      tenant_id: member.tenantId,
      company_id: payload.companyId,
      title: payload.title.slice(0, 200),
      stage: "diagnosis",
      due_date: payload.dueDate,
      assignee_id: member.userId,
      memo: payload.memo?.slice(0, 5_000) ?? null,
    })
    .select("id")
    .single();
  if (result.error || !result.data) {
    throw new Error(`과제를 만들지 못했습니다: ${result.error?.message ?? "알 수 없는 오류"}`);
  }
  return {
    summary: "관리 과제를 생성했습니다.",
    recordId: result.data.id,
    href: `/app/companies/${payload.companyId}?tab=tasks`,
  };
}

async function executeTaskUpdate(
  supabase: Supabase,
  member: MemberContext,
  payload: TaskUpdatePayload,
) {
  const existing = await supabase
    .from("task")
    .select("id, company_id, memo")
    .eq("id", payload.taskId)
    .maybeSingle();
  if (existing.error || !existing.data) throw new Error("수정할 과제를 찾을 수 없습니다.");
  const access = await assertCompanyAccess(supabase, existing.data.company_id, member.tenantId);
  if (!access.ok) throw new Error(access.error);

  const update: Database["public"]["Tables"]["task"]["Update"] = {};
  if (payload.title) update.title = payload.title.slice(0, 200);
  if (Object.hasOwn(payload, "dueDate")) update.due_date = payload.dueDate ?? null;
  if (payload.memoAppend) {
    update.memo = [existing.data.memo?.trim(), payload.memoAppend.trim()]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 10_000);
  }
  const result = await supabase.from("task").update(update).eq("id", payload.taskId);
  if (result.error) throw new Error(`과제를 수정하지 못했습니다: ${result.error.message}`);
  return {
    summary: "관리 과제를 수정했습니다.",
    recordId: payload.taskId,
    href: `/app/companies/${existing.data.company_id}?tab=tasks`,
  };
}

async function executeMemoAppend(
  supabase: Supabase,
  member: MemberContext,
  payload: CompanyMemoAppendPayload,
) {
  const access = await assertCompanyAccess(supabase, payload.companyId, member.tenantId);
  if (!access.ok) throw new Error(access.error);
  const existing = await supabase
    .from("company")
    .select("memo")
    .eq("id", payload.companyId)
    .maybeSingle();
  if (existing.error || !existing.data) throw new Error("기업을 찾을 수 없습니다.");
  const note = `[AI 비서 · ${todayKstDate()}]\n${payload.content.trim()}`;
  const memo = [existing.data.memo?.trim(), note]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 20_000);
  const result = await supabase
    .from("company")
    .update({ memo })
    .eq("id", payload.companyId);
  if (result.error) throw new Error(`기업 메모를 저장하지 못했습니다: ${result.error.message}`);
  return {
    summary: "기업 메모에 내용을 추가했습니다.",
    recordId: payload.companyId,
    href: `/app/companies/${payload.companyId}`,
  };
}

async function executeCampaignDraft(
  supabase: Supabase,
  member: MemberContext,
  payload: CampaignDraftPayload,
) {
  const ownership = await supabase
    .from("company")
    .select("id")
    .in("id", payload.companyIds);
  if (ownership.error || (ownership.data?.length ?? 0) !== payload.companyIds.length) {
    throw new Error("안내 대상에 접근할 수 없는 기업이 포함되어 있습니다.");
  }
  const campaign = await supabase
    .from("campaign")
    .insert({
      tenant_id: member.tenantId,
      title: payload.title.slice(0, 200),
      body: payload.body.slice(0, 10_000),
      channel: "email",
      status: "draft",
      segment: {
        join: "and",
        rules: [],
        source: "ai-assistant",
        companyIds: payload.companyIds,
      },
    })
    .select("id")
    .single();
  if (campaign.error || !campaign.data) {
    throw new Error(`일괄안내 초안을 만들지 못했습니다: ${campaign.error?.message ?? "알 수 없는 오류"}`);
  }
  // 같은 기업이 두 번 들어오면 unique(campaign_id, company_id)에 걸린다.
  const recipients = await supabase.from("campaign_recipient").insert(
    Array.from(new Set(payload.companyIds)).map((companyId) => ({
      tenant_id: member.tenantId,
      campaign_id: campaign.data.id,
      company_id: companyId,
      delivered: false,
      responded: false,
    })),
  );
  if (recipients.error) {
    await supabase.from("campaign").delete().eq("id", campaign.data.id);
    throw new Error(`안내 대상을 저장하지 못했습니다: ${recipients.error.message}`);
  }
  return {
    summary: "일괄안내 초안을 만들었습니다. 발송 전 내용을 확인해 주세요.",
    recordId: campaign.data.id,
    href: `/app/campaigns/${campaign.data.id}`,
  };
}

export async function approveAssistantAction(
  supabase: Supabase,
  actionId: string,
  member: MemberContext,
): Promise<AssistantActionResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: "AI 실행 서버 설정이 누락되었습니다." };

  let action: StoredAction;
  try {
    action = await loadAction(supabase, actionId, member);
    if (action.status !== "pending") throw new Error("이미 처리된 AI 실행 제안입니다.");
    if (!isAssistantActionType(action.action_type)) throw new Error("지원하지 않는 AI 실행입니다.");
    const allowed = await permissionForAction(supabase, action.action_type);
    const payload = parsePayload(action.action_type, action.payload);
    const now = new Date().toISOString();
    const locked = await service
      .from("ai_action")
      .update({
        status: "executing",
        decided_by: member.userId,
        decided_at: now,
        error_message: null,
      })
      .eq("id", action.id)
      .eq("tenant_id", member.tenantId)
      .eq("requested_by", member.userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (locked.error || !locked.data) throw new Error("다른 요청에서 이미 처리 중인 제안입니다.");

    const result =
      action.action_type === "task.create"
        ? await executeTaskCreate(supabase, allowed, payload as TaskCreatePayload)
        : action.action_type === "task.update"
          ? await executeTaskUpdate(supabase, allowed, payload as TaskUpdatePayload)
          : action.action_type === "company.memo_append"
            ? await executeMemoAppend(
                supabase,
                allowed,
                payload as CompanyMemoAppendPayload,
              )
            : await executeCampaignDraft(
                supabase,
                allowed,
                payload as CampaignDraftPayload,
              );

    const completed = await service
      .from("ai_action")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        result: result as unknown as Json,
      })
      .eq("id", action.id)
      .eq("status", "executing");
    if (completed.error) console.error("[assistant:action-complete]", completed.error.message);
    return {
      ok: true,
      error: null,
      action: { id: action.id, status: "executed", href: result.href },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 실행에 실패했습니다.";
    await service
      .from("ai_action")
      .update({
        status: "failed",
        executed_at: new Date().toISOString(),
        error_message: message.slice(0, 1_000),
      })
      .eq("id", actionId)
      .eq("tenant_id", member.tenantId)
      .eq("requested_by", member.userId)
      .in("status", ["pending", "executing"]);
    return { ok: false, error: message, action: { id: actionId, status: "failed" } };
  }
}

export async function rejectAssistantAction(
  supabase: Supabase,
  actionId: string,
  member: MemberContext,
): Promise<AssistantActionResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: "AI 실행 서버 설정이 누락되었습니다." };
  try {
    const action = await loadAction(supabase, actionId, member);
    if (action.status !== "pending") throw new Error("이미 처리된 AI 실행 제안입니다.");
    const result = await service
      .from("ai_action")
      .update({
        status: "rejected",
        decided_by: member.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", actionId)
      .eq("tenant_id", member.tenantId)
      .eq("requested_by", member.userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) throw new Error("제안을 거절하지 못했습니다.");
    return {
      ok: true,
      error: null,
      action: { id: actionId, status: "rejected" },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "제안을 거절하지 못했습니다.",
    };
  }
}
