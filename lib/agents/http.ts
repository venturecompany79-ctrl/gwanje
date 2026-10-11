import { NextResponse } from "next/server";
import { verifyBearerSecret } from "@/lib/api/auth";
import { isObject } from "./validation";

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export function workerAuth(request: Request) {
  if (!verifyBearerSecret(request, process.env.AGENT_WORKER_SECRET)) throw new Error("unauthorized");
  if (process.env.AGENT_ORCHESTRATION_ENABLED !== "true") throw new Error("disabled");
}

export async function readBody(request: Request, allowEmpty = false, limit = 32 * 1024): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("payload_too_large");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new Error("payload_too_large");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  if (size === 0 && allowEmpty) return {};
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid_request"); }
  if (!isObject(body)) throw new Error("invalid_request");
  return body;
}

export function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "unavailable";
  const statuses: Record<string, number> = {
    unauthorized: 401, forbidden: 403, disabled: 404, invalid_request: 400,
    step_limit: 400, payload_too_large: 413, expired_step: 409,
  };
  const status = statuses[code] ?? 503;
  return json({ error: status === 503 ? "unavailable" : code }, status);
}
