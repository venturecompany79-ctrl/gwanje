import { failure, json, workerAuth } from "@/lib/briefing/http";
import { claimBriefing } from "@/lib/briefing/service";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    workerAuth(request);
    return json({ job: await claimBriefing() });
  } catch (error) { return failure(error); }
}
