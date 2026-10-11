import type { Database } from "@/lib/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import type { resultInput, taskInput } from "./validation";

type Step = Database["public"]["Tables"]["agent_step"]["Row"];
type Message = Database["public"]["Tables"]["agent_message"]["Row"];
type ClaimRoles = {
  current: { key: string; name: string; instructions: string; version: number };
  specialists?: { key: string; name: string; mode: string }[];
};

function serviceClient() {
  const service = createServiceClient();
  if (!service) throw new Error("not_configured");
  return service;
}

function assertResult(error: { code: string; message: string } | null) {
  if (!error) return;
  if (error.code === "42501" && error.message === "forbidden") throw new Error("forbidden");
  if (error.code === "22023") throw new Error(error.message === "step_limit" ? "step_limit" : "invalid_request");
  throw new Error("storage_unavailable");
}

export async function enqueueTask(input: ReturnType<typeof taskInput>) {
  const { data, error } = await serviceClient().rpc("agent_enqueue", {
    creator: input.createdBy, task_source: input.source, task_title: input.title,
    task_body: input.body, task_company: input.companyId,
  });
  assertResult(error);
  if (!data) throw new Error("storage_unavailable");
  return data;
}

export async function claimStep() {
  const service = serviceClient();
  const claimed = await service.rpc("agent_claim_next");
  assertResult(claimed.error);
  if (!claimed.data) return { step: null };
  const { roles, ...step } = claimed.data as unknown as Step & { roles: ClaimRoles };
  try {
    const [task, previous] = await Promise.all([
      service.from("agent_task").select("title, body, company_id").eq("id", step.task_id).eq("tenant_id", step.tenant_id).single(),
      service.from("agent_step").select("id, seq, role, output").eq("task_id", step.task_id)
        .eq("tenant_id", step.tenant_id).lt("seq", step.seq).order("seq"),
    ]);
    assertResult(task.error);
    assertResult(previous.error);
    if (!task.data) throw new Error("storage_unavailable");
    const messages: Message[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await service.from("agent_message").select("*").eq("task_id", step.task_id)
        .eq("tenant_id", step.tenant_id).order("created_at").order("id").range(offset, offset + 499);
      assertResult(page.error);
      messages.push(...(page.data ?? []));
      if ((page.data?.length ?? 0) < 500) break;
    }
    return {
      step,
      roles,
      task: { title: task.data.title, body: task.data.body, companyId: task.data.company_id },
      history: { steps: previous.data ?? [], messages },
    };
  } catch (error) {
    if (step.token) {
      const released = await service.rpc("agent_finish", {
        step_id: step.id, lease_token: step.token, output: null, failure: "context_unavailable",
      });
      assertResult(released.error);
    }
    throw error;
  }
}

export async function heartbeatStep(id: string, token: string) {
  const { data, error } = await serviceClient().rpc("agent_heartbeat", { step_id: id, lease_token: token });
  assertResult(error);
  if (!data) throw new Error("expired_step");
}

export async function finishStep(id: string, input: ReturnType<typeof resultInput>) {
  const { data, error } = await serviceClient().rpc("agent_finish", {
    step_id: id, lease_token: input.token, output: input.output, failure: input.failure,
    next_steps: input.nextSteps, messages: input.messages,
  });
  assertResult(error);
  if (!data) throw new Error("expired_step");
}
