import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/lib/actions/shared";
import {
  ASSISTANT_MAX_DOCUMENTS,
  ASSISTANT_MAX_MESSAGE_CHARS,
  assistantEnabled,
  assistantModel,
} from "@/lib/assistant/config";
import { buildAssistantGrounding } from "@/lib/assistant/context";
import { streamAssistantResponse, type GeminiUsage } from "@/lib/assistant/gemini";
import { createActionProposal } from "@/lib/assistant/proposals";
import {
  enforceAssistantRateLimit,
  getConversationHistory,
  getOrCreateConversation,
  saveAssistantMessage,
  saveUserMessage,
} from "@/lib/assistant/store";
import type {
  AssistantChatRequest,
  AssistantScope,
  AssistantSource,
} from "@/lib/assistant/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseScope(value: unknown): AssistantScope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const scope = value as { mode?: unknown; consultantId?: unknown };
  if (scope.mode === "mine") return { mode: "mine" };
  if (scope.mode === "team") {
    return {
      mode: "team",
      consultantId:
        typeof scope.consultantId === "string" ? scope.consultantId : null,
    };
  }
  return null;
}

function parseRequest(value: unknown): AssistantChatRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const scope = parseScope(body.scope);
  if (!message || !scope) return null;
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.flatMap((value) =>
        typeof value === "string" && value.trim() ? [value.trim()] : [],
      )
    : [];
  return {
    conversationId:
      typeof body.conversationId === "string" ? body.conversationId : null,
    message,
    scope,
    companyId: typeof body.companyId === "string" ? body.companyId : null,
    documentIds: Array.from(new Set(documentIds)).slice(0, ASSISTANT_MAX_DOCUMENTS),
  };
}

function citedSources(text: string, sources: AssistantSource[]): AssistantSource[] {
  const ids = new Set(
    Array.from(text.matchAll(/\[(S\d+)\]/g), (match) => match[1]),
  );
  const cited = sources.filter((source) => ids.has(source.id));
  return cited.length > 0 ? cited : sources.slice(0, 5);
}

export async function POST(request: Request): Promise<Response> {
  if (!assistantEnabled()) {
    return NextResponse.json(
      { ok: false, error: "AI 비서가 설정되지 않았습니다(GEMINI_API_KEY)." },
      { status: 503 },
    );
  }
  if (!createServiceClient()) {
    return NextResponse.json(
      { ok: false, error: "AI 비서 저장 서버 설정이 누락되었습니다." },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const input = parseRequest(raw);
  if (!input) {
    return NextResponse.json({ ok: false, error: "질문과 관제 범위를 확인해 주세요." }, { status: 400 });
  }
  if (input.message.length > ASSISTANT_MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { ok: false, error: `질문은 ${ASSISTANT_MAX_MESSAGE_CHARS.toLocaleString("ko-KR")}자 이하로 입력해 주세요.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "데모 모드에서는 AI 대화를 저장할 수 없습니다." },
      { status: 503 },
    );
  }
  const member = await requirePermission(supabase, "ai.assistant.use");
  if ("error" in member) {
    return NextResponse.json({ ok: false, error: member.error }, { status: 403 });
  }

  try {
    await enforceAssistantRateLimit(supabase, member.userId);
    const grounding = await buildAssistantGrounding(supabase, member, input);
    const conversationId = await getOrCreateConversation(supabase, {
      conversationId: input.conversationId,
      tenantId: member.tenantId,
      userId: member.userId,
      scope: grounding.effectiveScope,
      firstMessage: input.message,
    });
    const history = await getConversationHistory(supabase, conversationId);
    const userMessageId = await saveUserMessage(supabase, {
      tenantId: member.tenantId,
      conversationId,
      userId: member.userId,
      content: input.message,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        send("meta", { conversationId, messageId: userMessageId });

        const startedAt = Date.now();
        let answer = "";
        let usage: GeminiUsage | null = null;
        let actionCount = 0;
        try {
          for await (const chunk of streamAssistantResponse({
            history,
            userMessage: input.message,
            grounding: grounding.contextText,
          })) {
            if (chunk.text) {
              answer += chunk.text;
              send("delta", { text: chunk.text });
            }
            if (chunk.usage) usage = chunk.usage;
            for (const action of chunk.actions) {
              const proposal = await createActionProposal(supabase, member, {
                conversationId,
                action,
                allowedCompanyIds: grounding.companyIds,
              });
              actionCount += 1;
              send("action", { action: proposal });
            }
          }

          if (!answer.trim()) {
            answer =
              actionCount > 0
                ? "요청하신 변경안을 준비했습니다. 아래 내용을 확인한 뒤 승인해 주세요."
                : "현재 데이터만으로는 답변을 만들기 어렵습니다. 질문의 기업이나 업무 범위를 조금 더 구체적으로 알려 주세요.";
            send("delta", { text: answer });
          }
          const sources = citedSources(answer, grounding.sources);
          if (sources.length > 0) send("sources", { sources });
          await saveAssistantMessage({
            tenantId: member.tenantId,
            conversationId,
            content: answer,
            sources,
            model: assistantModel(),
            usage,
            latencyMs: Date.now() - startedAt,
          });
          send("done", {});
          controller.close();
        } catch (error) {
          console.error("[assistant:chat]", error);
          send("error", {
            message:
              error instanceof Error
                ? error.message
                : "AI 비서 응답 중 오류가 발생했습니다.",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[assistant:prepare]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "AI 비서를 시작하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
