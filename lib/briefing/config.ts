export function briefingEnabled(userId?: string | null): boolean {
  const target = process.env.HERMES_BRIEFING_PROFILE_ID;
  return process.env.HERMES_BRIEFING_ENABLED === "true" && Boolean(target) && (!userId || userId === target);
}

export function briefingTarget(): string {
  const target = process.env.HERMES_BRIEFING_PROFILE_ID;
  if (!briefingEnabled() || !target) throw new Error("disabled");
  return target;
}
