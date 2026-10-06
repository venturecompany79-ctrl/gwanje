import { briefingUser, failure, json } from "@/lib/briefing/http";
import { enqueueBriefing } from "@/lib/briefing/service";

export async function POST() {
  try {
    const member = await briefingUser();
    return json({ jobId: await enqueueBriefing(member.userId, true) }, 202);
  } catch (error) { return failure(error); }
}
