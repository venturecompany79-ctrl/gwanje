import { failure, json, readBody, workerAuth } from "@/lib/agents/http";
import { tickTriggers } from "@/lib/agents/triggers";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    workerAuth(request);
    const body = await readBody(request, true);
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") throw new Error("invalid_request");
    return json(await tickTriggers(body.dryRun === true));
  } catch (error) { return failure(error); }
}
