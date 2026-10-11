import { failure, json, readBody, workerAuth } from "@/lib/agents/http";
import { claimStep } from "@/lib/agents/service";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    workerAuth(request);
    await readBody(request, true);
    return json(await claimStep());
  } catch (error) { return failure(error); }
}
