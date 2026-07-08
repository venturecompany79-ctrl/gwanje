export const REPORT_AI_MODEL_ENV = "REPORT_AI_MODEL";
export const DEFAULT_REPORT_AI_MODEL = "claude-sonnet-5";

export function reportGenerationEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function reportModel(): string {
  return process.env[REPORT_AI_MODEL_ENV] ?? DEFAULT_REPORT_AI_MODEL;
}
