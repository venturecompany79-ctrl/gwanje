import { briefingUser, failure, json, validId } from "@/lib/briefing/http";
import { serviceClient } from "@/lib/briefing/context";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const member = await briefingUser();
    const { id } = await params;
    if (!validId(id)) throw new Error("invalid_request");
    const { data, error } = await serviceClient().from("ai_briefing_job").select("id, status, error_code")
      .eq("id", id).eq("tenant_id", member.tenantId).eq("user_id", member.userId).maybeSingle();
    if (error) throw error;
    return json(data ?? { error: "not_found" }, data ? 200 : 404);
  } catch (error) { return failure(error); }
}
