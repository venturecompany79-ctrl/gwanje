import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/shared";
import { verifyBearerSecret } from "@/lib/api/auth";
import { briefingEnabled } from "./config";

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function briefingUser() {
  const supabase = await createClient();
  if (!supabase) throw new Error("unauthorized");
  const member = await requirePermission(supabase, "ai.assistant.use");
  if ("error" in member) throw new Error("forbidden");
  if (!briefingEnabled(member.userId)) throw new Error("disabled");
  return member;
}

export function workerAuth(request: Request) {
  if (!verifyBearerSecret(request, process.env.HERMES_WORKER_SECRET)) throw new Error("unauthorized");
  if (!briefingEnabled()) throw new Error("disabled");
}

export function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "unavailable";
  const statuses: Record<string, number> = { unauthorized: 401, forbidden: 403, disabled: 404, invalid_request: 400, expired_job: 409 };
  const status = statuses[code] ?? 503;
  return json({ error: status === 503 ? "업무 점검에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." : code }, status);
}

export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
