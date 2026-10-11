import { createServiceClient } from "@/lib/supabase/service";
import { validId } from "./validation";
import { buildTaskContext } from "./context";

type Target = {
  tenantId: string; companyId: string | null; source: string; sourceId: string; sourceKey: string;
  company: string | null; title: string; trigger: string; daysLeft: number; wouldStart: boolean; reason: string;
};
type TickResult = { started: number; skipped: { excluded: number; already_run: number; daily_limit: number }; targets: Target[] };

export async function tickTriggers(dryRun = false): Promise<TickResult> {
  const creator = process.env.AGENT_TRIGGER_PROFILE_ID;
  if (process.env.AGENT_TRIGGER_ENABLED !== "true") throw new Error("disabled");
  if (!validId(creator)) throw new Error("not_configured");
  const limit = Number(process.env.AGENT_TRIGGER_DAILY_LIMIT?.trim() || "5");
  if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new Error("not_configured");
  const service = createServiceClient();
  if (!service) throw new Error("not_configured");
  const invoke = async (preview: boolean, contexts: Record<string, string> = {}) => {
    const { data, error } = await service.rpc("agent_trigger_tick", { creator, daily_limit: limit, dry_run: preview, contexts });
    if (error) throw new Error(error.code === "42501" ? "forbidden" : "storage_unavailable");
    if (!data) throw new Error("storage_unavailable");
    return data as unknown as TickResult;
  };
  const plan = await invoke(true);
  if (dryRun) return plan;
  const contexts: Record<string, string> = {};
  for (const target of plan.targets.filter((item) => item.wouldStart)) contexts[target.sourceKey] = await buildTaskContext(target);
  return invoke(false, contexts);
}
