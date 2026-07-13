import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ASSISTANT_HISTORY_LIMIT,
  ASSISTANT_RATE_LIMIT_PER_MINUTE,
} from "@/lib/assistant/config";
import type { AssistantScope, AssistantSource } from "@/lib/assistant/types";
import type { GeminiHistoryMessage, GeminiUsage } from "@/lib/assistant/gemini";

type Supabase = SupabaseClient<Database>;

function toJson(value: unknown): Json {
  return value as Json;
}

function conversationTitle(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 36 ? `${oneLine.slice(0, 36)}…` : oneLine;
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameScope(stored: Json, requested: AssistantScope): boolean {
  if (!isRecord(stored) || stored.mode !== requested.mode) return false;
  if (requested.mode === "mine") return true;

  const storedConsultantId =
    typeof stored.consultantId === "string" ? stored.consultantId : null;
  return storedConsultantId === (requested.consultantId ?? null);
}

export async function enforceAssistantRateLimit(
  supabase: Supabase,
  userId: string,
): Promise<void> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const result = await supabase
    .from("ai_message")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .eq("role", "user")
    .gte("created_at", since);
  if (result.error) {
    throw new Error(`AI 사용량을 확인하지 못했습니다: ${result.error.message}`);
  }
  if ((result.count ?? 0) >= ASSISTANT_RATE_LIMIT_PER_MINUTE) {
    throw new Error("AI 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.");
  }
}

export async function getOrCreateConversation(
  supabase: Supabase,
  input: {
    conversationId?: string | null;
    tenantId: string;
    userId: string;
    scope: AssistantScope;
    firstMessage: string;
  },
): Promise<string> {
  if (input.conversationId) {
    const existing = await supabase
      .from("ai_conversation")
      .select("id, scope")
      .eq("id", input.conversationId)
      .eq("owner_id", input.userId)
      .maybeSingle();
    if (existing.error) {
      throw new Error(`AI 대화를 확인하지 못했습니다: ${existing.error.message}`);
    }
    if (!existing.data) throw new Error("AI 대화를 찾을 수 없습니다.");
    if (!sameScope(existing.data.scope, input.scope)) {
      throw new Error("관제 범위가 변경되었습니다. 새 대화를 시작해 주세요.");
    }
    return existing.data.id;
  }

  const created = await supabase
    .from("ai_conversation")
    .insert({
      tenant_id: input.tenantId,
      owner_id: input.userId,
      title: conversationTitle(input.firstMessage) || "새 대화",
      scope: toJson(input.scope),
    })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new Error(`AI 대화를 시작하지 못했습니다: ${created.error?.message ?? "알 수 없는 오류"}`);
  }
  return created.data.id;
}

export async function getConversationHistory(
  supabase: Supabase,
  conversationId: string,
): Promise<GeminiHistoryMessage[]> {
  const result = await supabase
    .from("ai_message")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(ASSISTANT_HISTORY_LIMIT);
  if (result.error) {
    throw new Error(`AI 대화 기록을 불러오지 못했습니다: ${result.error.message}`);
  }
  return (result.data ?? [])
    .reverse()
    .flatMap((message) =>
      message.role === "user" || message.role === "assistant"
        ? [{ role: message.role, content: message.content }]
        : [],
    );
}

export async function saveUserMessage(
  supabase: Supabase,
  input: {
    tenantId: string;
    conversationId: string;
    userId: string;
    content: string;
  },
): Promise<string> {
  const created = await supabase
    .from("ai_message")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      author_id: input.userId,
      role: "user",
      content: input.content,
    })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new Error(`메시지를 저장하지 못했습니다: ${created.error?.message ?? "알 수 없는 오류"}`);
  }
  return created.data.id;
}

export async function saveAssistantMessage(input: {
  tenantId: string;
  conversationId: string;
  content: string;
  sources: AssistantSource[];
  model: string;
  usage: GeminiUsage | null;
  latencyMs: number;
}): Promise<string> {
  const service = createServiceClient();
  if (!service) {
    throw new Error("AI 메시지 저장을 위한 서버 설정이 누락되었습니다.");
  }
  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();
  const messageResult = await service.from("ai_message").insert({
    id: messageId,
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    author_id: null,
    role: "assistant",
    content: input.content,
    sources: toJson(input.sources),
    model: input.model,
    input_tokens: input.usage?.inputTokens ?? null,
    output_tokens: input.usage?.outputTokens ?? null,
    total_tokens: input.usage?.totalTokens ?? null,
    latency_ms: input.latencyMs,
  });
  if (messageResult.error) {
    throw new Error(`AI 응답을 저장하지 못했습니다: ${messageResult.error.message}`);
  }
  const conversationResult = await service
    .from("ai_conversation")
    .update({ last_message_at: now })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId);
  if (conversationResult.error) {
    console.error(
      "[assistant:update-conversation]",
      conversationResult.error.code,
      conversationResult.error.message,
    );
  }
  return messageId;
}
