import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ conversations: [] });
  const member = await requirePermission(supabase, "ai.assistant.use");
  if ("error" in member) {
    return NextResponse.json({ ok: false, error: member.error }, { status: 403 });
  }
  const result = await supabase
    .from("ai_conversation")
    .select("id, title, scope, last_message_at, created_at")
    .eq("owner_id", member.userId)
    .order("last_message_at", { ascending: false })
    .limit(20);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, conversations: result.data ?? [] });
}
