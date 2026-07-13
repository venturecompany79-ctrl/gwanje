import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/shared";
import { isAssistantActionType } from "@/lib/assistant/types";

export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드에서는 대화 기록이 없습니다." }, { status: 404 });
  }
  const member = await requirePermission(supabase, "ai.assistant.use");
  if ("error" in member) {
    return NextResponse.json({ ok: false, error: member.error }, { status: 403 });
  }
  const [conversation, messages, actions] = await Promise.all([
    supabase
      .from("ai_conversation")
      .select("id, title, scope, last_message_at")
      .eq("id", id)
      .eq("owner_id", member.userId)
      .maybeSingle(),
    supabase
      .from("ai_message")
      .select("id, role, content, sources, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("ai_action")
      .select(
        "id, action_type, status, payload, preview, target_type, target_id, result, error_message, created_at",
      )
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  const error = conversation.error ?? messages.error ?? actions.error;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!conversation.data) {
    return NextResponse.json({ ok: false, error: "대화를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    conversation: conversation.data,
    messages: messages.data ?? [],
    actions: (actions.data ?? []).flatMap((action) => {
      if (!isAssistantActionType(action.action_type)) return [];
      const preview = record(action.preview);
      const actionResult = record(action.result);
      return [
        {
          id: action.id,
          type: action.action_type,
          title:
            typeof preview.title === "string" ? preview.title : "AI 실행 제안",
          summary: typeof preview.summary === "string" ? preview.summary : "",
          targetType: action.target_type,
          targetId: action.target_id,
          payload: action.payload,
          preview: action.preview,
          status: action.status,
          href: typeof actionResult.href === "string" ? actionResult.href : null,
          error: action.error_message,
          createdAt: action.created_at,
        },
      ];
    }),
  });
}
