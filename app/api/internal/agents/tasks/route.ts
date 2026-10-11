import { failure, json, readBody, workerAuth } from "@/lib/agents/http";
import { enqueueTask } from "@/lib/agents/service";
import { taskInput } from "@/lib/agents/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    workerAuth(request);
    return json({ taskId: await enqueueTask(taskInput(await readBody(request))) });
  } catch (error) { return failure(error); }
}
