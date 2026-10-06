import { failure, json, validId, workerAuth } from "@/lib/briefing/http";
import { submitBriefing } from "@/lib/briefing/service";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    workerAuth(request);
    const { id } = await params;
    const text = await request.text();
    if (text.length > 32_000) throw new Error("invalid_request");
    let body;
    try { body = JSON.parse(text); } catch { throw new Error("invalid_request"); }
    if (!body || !validId(id) || !validId(body.token)) throw new Error("invalid_request");
    await submitBriefing(id, body.token, body.result, body.failed === true);
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
