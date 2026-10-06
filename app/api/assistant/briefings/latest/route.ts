import { briefingUser, failure, json } from "@/lib/briefing/http";
import { latestBriefing } from "@/lib/briefing/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const member = await briefingUser();
    return json(await latestBriefing(member.userId));
  } catch (error) { return failure(error); }
}
