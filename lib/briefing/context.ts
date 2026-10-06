import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { kstDate } from "./core";
import { isMemberRole, normalizePermissions } from "@/lib/permissions";
import type { BriefingSnapshot, BriefingSource } from "./types";

export function serviceClient() {
  const service = createServiceClient();
  if (!service) throw new Error("not_configured");
  return service;
}

export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function allRows<Row>(query: { range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }> }): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query.range(offset, offset + 499);
    if (result.error) throw new Error("source_unavailable");
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}

export async function collectSnapshot(userId: string, now = new Date()): Promise<{ tenantId: string; snapshot: BriefingSnapshot }> {
  const service = serviceClient();
  const { data: member, error } = await service.from("profile").select("tenant_id, status, role, permissions").eq("id", userId).single();
  if (error) throw new Error("source_unavailable");
  if (!member || member.status !== "active" || !isMemberRole(member.role)) throw new Error("forbidden");
  const permissions = normalizePermissions(member.role, member.permissions);
  if (!permissions.includes("ai.assistant.use")) throw new Error("forbidden");
  const tenantId = member.tenant_id;
  const date = kstDate(now);
  const startDay = new Date(`${date}T00:00:00+09:00`);
  const cutoff = kstDate(new Date(startDay.getTime() - 29 * 86_400_000));
  const future = kstDate(new Date(startDay.getTime() + 365 * 86_400_000));
  const canCompanies = permissions.includes("companies.read");
  const canTasks = canCompanies && permissions.includes("tasks.read");
  const [companies, tasks, deadlines, notes, history, previousState] = await Promise.all([
    canCompanies ? allRows(service.from("company").select("id, name, primary_consultant_id").eq("tenant_id", tenantId).eq("status", "active").order("id")) : [],
    canTasks ? allRows(service.from("task").select("id, company_id, title, due_date, work_status, memo, assignee_id, updated_at").eq("tenant_id", tenantId).order("id")) : [],
    canCompanies ? allRows(service.from("deadline_item").select("id, company_id, title, due_date, source, status").eq("tenant_id", tenantId).order("source").order("id")) : [],
    allRows(service.from("todo_note").select("id, note_date, content, completed, updated_at").eq("tenant_id", tenantId).eq("user_id", userId).gte("note_date", cutoff).lte("note_date", future).order("id")),
    canTasks ? allRows(service.from("task_state_change").select("task_id, next_work_status, created_at").eq("tenant_id", tenantId).gte("created_at", startDay.toISOString()).order("id")) : [],
    service.from("ai_briefing_state").select("snapshot").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
  ]);
  if (previousState.error) throw new Error("source_unavailable");
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const sources: BriefingSource[] = [];
  function daysLeft(due: string | null) {
    return due ? Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000) : null;
  }
  for (const task of tasks) {
    const company = companyMap.get(task.company_id);
    if (!company || (task.assignee_id !== userId && company.primary_consultant_id !== userId)) continue;
    sources.push({ id: `task:${task.id}`, title: task.title, companyId: company.id, companyName: company.name,
      href: `/app/companies/${company.id}?tab=tasks`, dueDate: task.due_date, daysLeft: daysLeft(task.due_date),
      completed: task.work_status === "completed", responsibility: task.assignee_id === userId ? "direct" : "management",
      memo: task.memo ?? "", version: digest([task.updated_at, task.assignee_id, task.work_status]) });
  }
  for (const deadline of deadlines) {
    if (deadline.source === "task" || !deadline.company_id) continue;
    if (deadline.source === "schedule" && deadline.due_date && deadline.due_date < date) continue;
    const company = companyMap.get(deadline.company_id);
    if (!company || company.primary_consultant_id !== userId) continue;
    const tab = deadline.source === "credential" ? "cert" : deadline.source === "ip_deadline" ? "ip" : "schedule";
    sources.push({ id: `${deadline.source}:${deadline.id}`, title: deadline.title ?? "마감 업무", companyId: company.id, companyName: company.name,
      href: `/app/companies/${company.id}?tab=${tab}`, dueDate: deadline.due_date, daysLeft: daysLeft(deadline.due_date),
      completed: false, responsibility: "management", memo: "", version: digest(deadline) });
  }
  for (const note of notes) {
    sources.push({ id: `todo:${note.id}`, title: note.content, companyId: null, companyName: null, href: "/app/board?tab=todos",
      dueDate: note.note_date, daysLeft: daysLeft(note.note_date), completed: note.completed, responsibility: "direct", memo: "", version: note.updated_at });
  }
  sources.sort((left, right) => left.id.localeCompare(right.id));
  const known = new Set(sources.filter((source) => source.completed).map((source) => source.id));
  const previous = previousState.data?.snapshot as unknown as BriefingSnapshot | null;
  const completedNotes = previous?.date === date
    ? sources.filter((source) => source.id.startsWith("todo:") && source.completed && (
      previous.completedToday.includes(source.id) || previous.sources.some((old) => old.id === source.id && !old.completed)
    )).map((source) => source.id)
    : [];
  return { tenantId, snapshot: {
    date,
    accessKey: digest([tenantId, [...permissions].sort(), companies.map((company) => [company.id, company.primary_consultant_id]), tasks.map((task) => [task.id, task.assignee_id])]),
    sources,
    completedToday: [...new Set([...history.filter((entry) => entry.next_work_status === "completed" && known.has(`task:${entry.task_id}`)).map((entry) => `task:${entry.task_id}`), ...completedNotes])].sort(),
  } };
}
