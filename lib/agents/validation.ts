import type { Json } from "@/lib/database.types";

export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validRole(value: unknown): value is string {
  return typeof value === "string" && Array.from(value).length > 0 && Array.from(value).length <= 64;
}

export function taskInput(body: Record<string, unknown>) {
  if (!validId(body.createdBy) || (body.source !== "app" && body.source !== "slack")
    || typeof body.title !== "string" || !body.title.trim() || typeof body.body !== "string"
    || (body.companyId != null && !validId(body.companyId))) throw new Error("invalid_request");
  return { createdBy: body.createdBy, source: body.source, title: body.title, body: body.body, companyId: body.companyId ?? null };
}

export function stepToken(id: unknown, body: Record<string, unknown>) {
  if (!validId(id) || !validId(body.token)) throw new Error("invalid_request");
  return body.token;
}

export function resultInput(id: string, body: Record<string, unknown>) {
  const token = stepToken(id, body);
  if (body.failed !== undefined && typeof body.failed !== "boolean") throw new Error("invalid_request");
  if (body.errorCode !== undefined && (typeof body.errorCode !== "string" || !body.errorCode.trim() || body.errorCode.length > 64)) throw new Error("invalid_request");
  if (body.errorCode !== undefined && body.failed !== true) throw new Error("invalid_request");
  if (body.nextSteps != null && (!Array.isArray(body.nextSteps) || body.nextSteps.length > 7
    || !body.nextSteps.every((entry: unknown) => isObject(entry) && validRole(entry.role)))) throw new Error("invalid_request");
  if (body.messages != null && (!Array.isArray(body.messages)
    || !body.messages.every((entry: unknown) => isObject(entry) && validRole(entry.role)
      && typeof entry.content === "string" && Array.from(entry.content).length <= 8000))) throw new Error("invalid_request");
  return {
    token,
    output: (body.output ?? null) as Json,
    failure: body.failed === true ? (body.errorCode as string | undefined) ?? "worker_failed" : null,
    nextSteps: (body.nextSteps ?? null) as Json,
    messages: (body.messages ?? null) as Json,
  };
}
