export const ASSISTANT_AI_MODEL_ENV = "ASSISTANT_AI_MODEL";
export const DEFAULT_ASSISTANT_AI_MODEL = "gemini-2.5-flash";
export const ASSISTANT_MAX_MESSAGE_CHARS = 8_000;
export const ASSISTANT_MAX_DOCUMENTS = 3;
export const ASSISTANT_HISTORY_LIMIT = 12;
export const ASSISTANT_RATE_LIMIT_PER_MINUTE = 10;

export function assistantEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function assistantModel(): string {
  return process.env[ASSISTANT_AI_MODEL_ENV] ?? DEFAULT_ASSISTANT_AI_MODEL;
}
