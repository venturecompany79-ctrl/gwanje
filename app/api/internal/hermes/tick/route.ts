import { failure, json, workerAuth } from "@/lib/briefing/http";
import { tickBriefing } from "@/lib/briefing/service";

export async function POST(request: Request) {
  try {
    workerAuth(request);
    return json({ jobId: await tickBriefing() });
  } catch (error) { return failure(error); }
}
