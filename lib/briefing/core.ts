import type { BriefingResult, BriefingSnapshot, BriefingSource } from "./types";

export function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export function scheduleAt(now: Date): { slot: string; next: string; kind: string } {
  const start = Math.floor(now.getTime() / 60_000) * 60_000;
  function kindAt(stamp: number): string | null {
    const local = new Date(stamp + 9 * 3_600_000);
    const weekday = local.getUTCDay() >= 1 && local.getUTCDay() <= 5;
    const hour = local.getUTCHours();
    const minute = local.getUTCMinutes();
    if (weekday && hour === 8 && minute === 30) return "morning";
    if (weekday && hour === 18 && minute === 0) return "closing";
    if (weekday && hour >= 9 && hour < 18 && minute % 15 === 0) return "check";
    return minute === 0 ? "check" : null;
  }
  let previous = start;
  while (!kindAt(previous)) previous -= 60_000;
  let next = start + 60_000;
  while (!kindAt(next)) next += 60_000;
  return { slot: new Date(previous).toISOString(), next: new Date(next).toISOString(), kind: start - previous > 5 * 60_000 ? "check" : kindAt(previous)! };
}

export function rankSources(sources: BriefingSource[]): BriefingSource[] {
  return sources.filter((source) => !source.completed).sort((left, right) => {
    const leftDays = left.daysLeft ?? Infinity;
    const rightDays = right.daysLeft ?? Infinity;
    return (leftDays - rightDays || left.id.localeCompare(right.id));
  });
}

export function changesBetween(previous: BriefingSnapshot | null, current: BriefingSnapshot): string[] {
  if (!previous) return [];
  const before = new Map(previous.sources.map((source) => [source.id, source]));
  const changes: string[] = [];
  for (const source of current.sources) {
    const old = before.get(source.id);
    if (!old) changes.push(`${source.title}: 새 업무`);
    else if (old.completed !== source.completed) changes.push(`${source.title}: ${source.completed ? "완료 확인" : "다시 진행"}`);
    else if (old.dueDate !== source.dueDate) changes.push(`${source.title}: 기한 변경`);
    else if (old.version !== source.version) changes.push(`${source.title}: 내용 변경`);
  }
  const currentIds = new Set(current.sources.map((source) => source.id));
  const removed = previous.sources.filter((source) => !currentIds.has(source.id)).length;
  if (removed > 0) changes.push(`조회 범위에서 ${removed}개 업무가 제외되었습니다.`);
  return changes.slice(0, 20);
}

function shortText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error("invalid_result");
  return value.trim();
}

export function validateResult(raw: unknown, snapshot: BriefingSnapshot, previous: BriefingSnapshot | null, dataAsOf: string, now = new Date()): BriefingResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid_result");
  const value = raw as Record<string, unknown>;
  const expected = rankSources(snapshot.sources).slice(0, 3);
  if (!Array.isArray(value.priorities) || value.priorities.length !== expected.length) throw new Error("invalid_result");
  const priorities = value.priorities.map((entry, index) => {
    if (!entry || typeof entry !== "object" || entry.sourceId !== expected[index].id) throw new Error("invalid_source");
    return { sourceId: entry.sourceId as string, reason: shortText(entry.reason, 400), nextAction: shortText(entry.nextAction, 400) };
  });
  if (!Array.isArray(value.plan) || value.plan.length > 6) throw new Error("invalid_result");
  return {
    summary: shortText(value.summary, 1200), priorities,
    plan: value.plan.map((entry) => shortText(entry, 400)),
    changes: changesBetween(previous, snapshot), sources: snapshot.sources,
    dataAsOf, generatedAt: now.toISOString(),
  };
}
