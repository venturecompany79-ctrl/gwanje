import { failure, json, readBody, workerAuth } from "@/lib/agents/http";
import { finishStep } from "@/lib/agents/service";
import { resultInput } from "@/lib/agents/validation";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    workerAuth(request);
    const { id } = await params;
    await finishStep(id, resultInput(id, await readBody(request, false, 256 * 1024)));
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
