import { failure, json, readBody, workerAuth } from "@/lib/agents/http";
import { heartbeatStep } from "@/lib/agents/service";
import { stepToken } from "@/lib/agents/validation";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    workerAuth(request);
    const { id } = await params;
    await heartbeatStep(id, stepToken(id, await readBody(request)));
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
