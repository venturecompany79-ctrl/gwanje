import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/shared";
import { approveAssistantAction } from "@/lib/assistant/actions";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "데모 모드에서는 실행할 수 없습니다." }, { status: 503 });
  }
  const member = await requirePermission(supabase, "ai.assistant.use");
  if ("error" in member) {
    return NextResponse.json({ ok: false, error: member.error }, { status: 403 });
  }
  const result = await approveAssistantAction(supabase, id, member);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/companies");
    revalidatePath("/app/board");
    revalidatePath("/app/campaigns");
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
