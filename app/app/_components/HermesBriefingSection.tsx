import { assistantEnabled } from "@/lib/assistant/config";
import { latestBriefing } from "@/lib/briefing/service";
import { HermesBriefing } from "./HermesBriefing";
import { briefingEnabled } from "@/lib/briefing/config";
import { BRIEFING_PREVIEW } from "@/lib/briefing/preview";

export async function HermesBriefingSection({ userId }: { userId: string }) {
  if (!briefingEnabled(userId)) {
    return <HermesBriefing key={`${userId}:preview`} userId={userId} initial={BRIEFING_PREVIEW} chatEnabled={false} preview />;
  }
  try {
    const view = await latestBriefing(userId);
    return <HermesBriefing key={userId} userId={userId} initial={view} chatEnabled={assistantEnabled()} />;
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") return null;
    return <HermesBriefing key={userId} userId={userId} initial={null} chatEnabled={assistantEnabled()} initialError />;
  }
}
