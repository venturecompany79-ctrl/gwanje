import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { generateBriefing, runCycle, workerConfig } from "./hermes-worker.mjs";

const require = createRequire(import.meta.url);
const cache = new Map();
let fakeService;
function load(relative) {
  const filename = path.resolve(relative);
  if (filename.endsWith("lib/supabase/service.ts")) return { createServiceClient: () => fakeService };
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} };
  cache.set(filename, compiledModule);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const scopedRequire = (name) => name.startsWith("@/") ? load(`${name.slice(2)}.ts`)
    : name.startsWith(".") ? load(path.resolve(path.dirname(filename), `${name}.ts`)) : require(name);
  new Function("require", "module", "exports", compiled)(scopedRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const { scheduleAt, rankSources, changesBetween, validateResult } = load("lib/briefing/core.ts");
const { collectSnapshot } = load("lib/briefing/context.ts");
const at = (value) => new Date(value);
assert.equal(scheduleAt(at("2026-10-07T08:30:00+09:00")).kind, "morning");
assert.equal(scheduleAt(at("2026-10-07T18:00:00+09:00")).kind, "closing");
assert.equal(scheduleAt(at("2026-10-07T08:50:00+09:00")).kind, "check");
assert.equal(scheduleAt(at("2026-10-07T09:16:00+09:00")).next, "2026-10-07T00:30:00.000Z");
assert.equal(scheduleAt(at("2026-10-10T09:16:00+09:00")).next, "2026-10-10T01:00:00.000Z");
assert.equal(scheduleAt(at("2026-10-07T23:59:00+09:00")).next, "2026-10-07T15:00:00.000Z");

const base = { companyId: "company", companyName: "기업", href: "/app/companies/company", responsibility: "direct", memo: "", dueDate: "2026-10-07", completed: false, version: "1", title: "업무" };
const sources = [
  { ...base, id: "task:late", daysLeft: -2 },
  { ...base, id: "task:today", daysLeft: 0 },
  { ...base, id: "task:future", daysLeft: 7 },
  { ...base, id: "task:none", daysLeft: null },
  { ...base, id: "task:done", daysLeft: -10, completed: true },
];
assert.deepEqual(rankSources(sources).map((source) => source.id), ["task:late", "task:today", "task:future", "task:none"]);
const snapshot = { date: "2026-10-07", accessKey: "access", sources, completedToday: [] };
const raw = { summary: "업무를 확인하세요.", priorities: rankSources(sources).slice(0, 3).map((source) => ({ sourceId: source.id, reason: "기한 임박", nextAction: "진행 확인" })), plan: ["순서 확인"] };
assert.equal(validateResult(raw, snapshot, null, new Date().toISOString()).priorities.length, 3);
assert.throws(() => validateResult({ ...raw, priorities: [{ ...raw.priorities[0], sourceId: "task:foreign" }, ...raw.priorities.slice(1)] }, snapshot, null, "now"), /invalid_source/);
assert.throws(() => validateResult({ ...raw, summary: "x".repeat(1201) }, snapshot, null, "now"), /invalid_result/);
assert.throws(() => validateResult({ ...raw, priorities: [] }, snapshot, null, "now"), /invalid_result/);
assert.deepEqual(changesBetween(null, snapshot), []);
assert.match(changesBetween(snapshot, { ...snapshot, sources: [{ ...sources[0], completed: true }] }).join(" "), /완료 확인.*제외/);
assert.match(changesBetween({ ...snapshot, sources: [{ ...sources[0], completed: true }] }, snapshot).join(" "), /다시 진행/);

const fixtures = {
  ai_briefing_state: [],
  profile: [{ id: "me", tenant_id: "tenant", status: "active", role: "member", permissions: ["ai.assistant.use", "companies.read", "tasks.read"] }],
  company: [
    { id: "managed", tenant_id: "tenant", name: "담당 기업", status: "active", primary_consultant_id: "me" },
    { id: "assigned", tenant_id: "tenant", name: "다른 담당 기업", status: "active", primary_consultant_id: "other" },
    { id: "foreign", tenant_id: "foreign", name: "타 tenant", status: "active", primary_consultant_id: "me" },
  ],
  task: [
    { id: "direct", tenant_id: "tenant", company_id: "assigned", assignee_id: "me", title: "직접 업무", due_date: "2026-10-08", work_status: "in_progress" },
    { id: "management", tenant_id: "tenant", company_id: "managed", assignee_id: "other", title: "관리 업무", due_date: null, work_status: "completed" },
    { id: "not-mine", tenant_id: "tenant", company_id: "assigned", assignee_id: "other", title: "타인 업무", due_date: null },
  ],
  deadline_item: [
    { id: "direct", tenant_id: "tenant", company_id: "assigned", source: "task", due_date: "2026-10-08" },
    { id: "meeting", tenant_id: "tenant", company_id: "managed", source: "schedule", title: "일정", due_date: "2026-10-09" },
  ],
  todo_note: [
    { id: "mine", tenant_id: "tenant", user_id: "me", content: "개인 업무", note_date: "2026-10-07", completed: false },
    { id: "private", tenant_id: "tenant", user_id: "other", content: "타인 비공개", note_date: "2026-10-07", completed: false },
    { id: "expired", tenant_id: "tenant", user_id: "me", content: "오래된 기록", note_date: "2026-01-01", completed: false },
  ],
  task_state_change: [{ task_id: "management", tenant_id: "tenant", next_work_status: "completed", created_at: "2026-10-07T01:00:00Z" }],
};
let failingTable = null;
fakeService = { from(table) {
  let rows = [...fixtures[table]];
  const query = {
    select() { return query; },
    eq(key, value) { rows = rows.filter((row) => row[key] === value); return query; },
    gte(key, value) { rows = rows.filter((row) => row[key] >= value); return query; },
    lte(key, value) { rows = rows.filter((row) => row[key] <= value); return query; },
    order() { return query; },
    range(start, end) { return Promise.resolve({ data: rows.slice(start, end + 1), error: table === failingTable ? { message: "unavailable" } : null }); },
    single() { return Promise.resolve({ data: rows[0], error: null }); },
    maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
  };
  return query;
} };
const collected = await collectSnapshot("me", at("2026-10-07T12:00:00+09:00"));
assert.deepEqual(collected.snapshot.sources.map((source) => source.id).sort(), ["schedule:meeting", "task:direct", "task:management", "todo:mine"]);
assert.equal(collected.snapshot.sources.find((source) => source.id === "task:direct").responsibility, "direct");
assert.equal(collected.snapshot.sources.find((source) => source.id === "task:management").responsibility, "management");
assert.deepEqual(collected.snapshot.completedToday, ["task:management"]);
fixtures.ai_briefing_state = [{ user_id: "me", tenant_id: "tenant", snapshot: collected.snapshot }];
fixtures.todo_note[0].completed = true;
const completedNote = await collectSnapshot("me", at("2026-10-07T13:00:00+09:00"));
assert.ok(completedNote.snapshot.completedToday.includes("todo:mine"));
fixtures.ai_briefing_state[0].snapshot = completedNote.snapshot;
assert.ok((await collectSnapshot("me", at("2026-10-07T14:00:00+09:00"))).snapshot.completedToday.includes("todo:mine"));
fixtures.todo_note[0].completed = false;
assert.ok(!(await collectSnapshot("me", at("2026-10-07T15:00:00+09:00"))).snapshot.completedToday.includes("todo:mine"));
fixtures.ai_briefing_state = [];
fixtures.todo_note.push(...Array.from({ length: 505 }, (_, index) => ({ ...fixtures.todo_note[0], id: `pagination-${index}` })));
assert.equal((await collectSnapshot("me", at("2026-10-07T12:00:00+09:00"))).snapshot.sources.length, 509);
fixtures.todo_note.splice(3);
const tomorrow = await collectSnapshot("me", at("2026-10-08T12:00:00+09:00"));
assert.equal(tomorrow.snapshot.sources.find((source) => source.id === "task:direct").daysLeft, 0);
fixtures.profile[0].permissions = ["ai.assistant.use", "companies.read"];
assert.equal((await collectSnapshot("me", at("2026-10-07T12:00:00+09:00"))).snapshot.sources.some((source) => source.id.startsWith("task:")), false);
failingTable = "todo_note";
await assert.rejects(collectSnapshot("me"), /source_unavailable/);
failingTable = null;
fixtures.profile[0].status = "disabled";
await assert.rejects(collectSnapshot("me"), /forbidden/);
fixtures.profile[0].status = "active";
fixtures.profile[0].role = "owner";
fixtures.profile[0].permissions = [];
assert.ok((await collectSnapshot("me")).snapshot.sources.some((source) => source.id === "task:direct"));

assert.throws(() => workerConfig({}), /missing_configuration/);
assert.throws(() => workerConfig({ HERMES_APP_URL: "http://example.com", HERMES_WORKER_SECRET: "secret", HERMES_WORKER_MOCK: "true" }), /https_required/);
const config = workerConfig({ HERMES_APP_URL: "http://localhost:3000", HERMES_WORKER_SECRET: "worker-secret", HERMES_API_KEY: "local-secret" });
const job = { id: "job", token: "lease-secret", kind: "morning", input: { priorities: sources.slice(0, 3), sources, completedToday: [] } };
const generated = await generateBriefing(job, config, async (_url, options) => {
  assert.equal(options.headers.Authorization, "Bearer local-secret");
  assert.equal(options.redirect, "error");
  assert.equal(JSON.parse(options.body).stream, false);
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) } }], usage: { total_tokens: 20, secret: "not-logged" } }));
});
assert.deepEqual(generated.result, raw);
assert.deepEqual(generated.usage, { total_tokens: 20 });
await assert.rejects(generateBriefing(job, config, async () => new Response("{}", { status: 503 })), /hermes_http_503/);
const calls = [];
const logs = [];
await runCycle({ ...config, mock: true }, async (url, options) => {
  calls.push(String(url));
  const request = JSON.parse(options.body);
  if (String(url).endsWith("/claim")) return Response.json({ job });
  if (String(url).endsWith("/result")) { assert.equal(request.token, job.token); assert.match(request.result.summary, /모의/); }
  return Response.json({ ok: true });
}, (entry) => logs.push(entry));
assert.equal(calls.length, 3);
assert.equal(logs[0].event, "result_submitted");
assert.ok(!JSON.stringify(logs).includes("lease-secret"));
console.log("✓ briefing schedule, ranking, scope, pagination, permissions, validation, worker and mock integration");
