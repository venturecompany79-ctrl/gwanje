import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

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

const routes = Object.fromEntries(['tasks', 'steps/claim', 'steps/[id]/heartbeat', 'steps/[id]/result', 'triggers/tick'].map((route) => [route, load(`app/api/internal/agents/${route}/route.ts`)]));
const id = '11111111-1111-1111-1111-111111111111';
const token = '22222222-2222-2222-2222-222222222222';
const taskId = '33333333-3333-3333-3333-333333333333';
const tenantId = '44444444-4444-4444-4444-444444444444';
const roles = { current: { key: 'writer', name: '작성 담당자', instructions: 'DB 역할 지침', version: 3 } };
const step = { id, token, task_id: taskId, tenant_id: tenantId, seq: 1, role: 'writer', role_version: 3, roles };
const calls = [];
let rpcResult = { data: true, error: null };
let queryError = null;
const fixtures = {
  agent_task: [{ id: taskId, tenant_id: tenantId, title: 'test', body: 'body', company_id: null }],
  agent_step: [{ id: token, task_id: taskId, tenant_id: tenantId, seq: 0, role: 'orchestrator', output: { plan: true } }, step],
  agent_message: Array.from({ length: 501 }, (_, index) => ({ id: String(index).padStart(4, '0'), task_id: taskId, tenant_id: tenantId, created_at: '2026-10-11', role: 'orchestrator', content: 'message' })),
};
fakeService = {
  async rpc(name, args) { calls.push({ name, args }); return rpcResult; },
  from(table) {
    let rows = [...fixtures[table]].reverse();
    const filters = [];
    const ordering = [];
    const query = {
      select() { return query; },
      eq(column, value) { filters.push([column, value]); rows = rows.filter((row) => row[column] === value); return query; },
      lt(column, value) { rows = rows.filter((row) => row[column] < value); return query; },
      order(column) { ordering.push(column); return query; },
      result() {
        assert.ok(filters.some(([column, value]) => column === 'tenant_id' && value === tenantId));
        assert.ok(filters.some(([column, value]) => column === (table === 'agent_task' ? 'id' : 'task_id') && value === taskId));
        rows.sort((left, right) => {
          for (const column of ordering) {
            if (left[column] < right[column]) return -1;
            if (left[column] > right[column]) return 1;
          }
          return 0;
        });
        return { data: rows, error: queryError };
      },
      async single() { const result = query.result(); return { ...result, data: result.data[0] }; },
      async range(from, to) { const result = query.result(); return { ...result, data: result.data.slice(from, to + 1) }; },
      then(resolve, reject) { return Promise.resolve(query.result()).then(resolve, reject); },
    };
    return query;
  },
};
process.env.AGENT_WORKER_SECRET = 'agent-test-secret';
process.env.AGENT_ORCHESTRATION_ENABLED = 'true';
const request = (body, secret = 'agent-test-secret') => new Request('http://localhost/api/internal/agents/test', {
  method: 'POST', headers: { authorization: `Bearer ${secret}` },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});
const invoke = (route, body, secret, stepId = id) => routes[route].POST(request(body, secret), { params: Promise.resolve({ id: stepId }) });

for (const [route, module] of Object.entries(routes)) {
  assert.equal(module.maxDuration, 60);
  assert.equal((await invoke(route, {}, 'wrong')).status, 401);
  delete process.env.AGENT_WORKER_SECRET;
  assert.equal((await invoke(route, {})).status, 401);
  process.env.AGENT_WORKER_SECRET = 'agent-test-secret';
  for (const flag of ['false', 'TRUE', '']) {
    process.env.AGENT_ORCHESTRATION_ENABLED = flag;
    assert.equal((await invoke(route, {})).status, 404);
  }
  process.env.AGENT_ORCHESTRATION_ENABLED = 'true';
  assert.equal((await invoke(route, '{bad')).status, 400);
  assert.equal((await invoke(route, [])).status, 400);
  const limit = route === 'steps/[id]/result' ? 256 * 1024 : 32 * 1024;
  assert.equal((await invoke(route, '한'.repeat(Math.ceil(limit / 3)))).status, 413);
  const oversized = request({});
  oversized.headers.set('content-length', String(limit + 1));
  assert.equal((await module.POST(oversized, { params: Promise.resolve({ id }) })).status, 413);
}
assert.equal(calls.length, 0);
assert.equal((await invoke('tasks', { createdBy: 'bad', source: 'app', title: 'test', body: '' })).status, 400);
assert.equal((await invoke('steps/[id]/heartbeat', { token }, undefined, 'bad')).status, 400);
assert.equal((await invoke('steps/[id]/result', { token: 'bad' })).status, 400);
assert.equal((await invoke('steps/[id]/result', { token, failed: 'true' })).status, 400);
assert.equal((await invoke('steps/[id]/result', { token, errorCode: 'quota' })).status, 400);
assert.equal((await invoke('steps/[id]/result', { token, nextSteps: [{ role: 'x'.repeat(65) }] })).status, 400);
assert.equal((await invoke('steps/[id]/result', { token, messages: [{ role: 'writer', content: 'x'.repeat(8001) }] })).status, 400);
assert.equal(calls.length, 0);

rpcResult = { data: taskId, error: null };
const enqueued = await invoke('tasks', { createdBy: id, source: 'app', title: 'test', body: 'body' });
assert.equal(enqueued.status, 200);
assert.equal(enqueued.headers.get('cache-control'), 'no-store');
assert.deepEqual(await enqueued.json(), { taskId });
assert.deepEqual(calls.at(-1), { name: 'agent_enqueue', args: { creator: id, task_source: 'app', task_title: 'test', task_body: 'body', task_company: null } });
rpcResult = { data: step, error: null };
const claimed = await (await invoke('steps/claim')).json();
assert.deepEqual(claimed.task, { title: 'test', body: 'body', companyId: null });
assert.equal(claimed.step.token, token);
assert.deepEqual(claimed.roles, roles);
assert.equal(claimed.step.role_version, claimed.roles.current.version);
assert.equal(claimed.step.roles, undefined);
assert.equal(claimed.history.steps.length, 1);
assert.equal(claimed.history.steps[0].seq, 0);
assert.equal(claimed.history.messages.length, 501);
assert.equal(claimed.history.messages[0].id, '0000');
assert.equal(claimed.history.messages[500].id, '0500');
rpcResult = { data: null, error: null };
assert.deepEqual(await (await invoke('steps/claim')).json(), { step: null });
rpcResult = { data: true, error: null };
assert.equal((await invoke('steps/[id]/result', { token, output: { text: '한'.repeat(20_000) } })).status, 200);
assert.equal((await invoke('steps/[id]/heartbeat', { token })).status, 200);
assert.deepEqual(calls.at(-1), { name: 'agent_heartbeat', args: { step_id: id, lease_token: token } });
const result = { token, output: { answer: 42 }, nextSteps: [{ role: 'reviewer' }], messages: [{ role: 'writer', content: 'done' }] };
assert.equal((await invoke('steps/[id]/result', result)).status, 200);
assert.deepEqual(calls.at(-1), { name: 'agent_finish', args: { step_id: id, lease_token: token, output: result.output, failure: null, next_steps: result.nextSteps, messages: result.messages } });
assert.equal((await invoke('steps/[id]/result', { token, failed: true, errorCode: 'quota' })).status, 200);
assert.equal(calls.at(-1).args.failure, 'quota');
rpcResult = { data: false, error: null };
assert.equal((await invoke('steps/[id]/heartbeat', { token })).status, 409);
assert.equal((await invoke('steps/[id]/result', { token })).status, 409);
rpcResult = { data: null, error: { code: '22023', message: 'step_limit' } };
assert.equal((await invoke('steps/[id]/result', { token })).status, 400);
rpcResult = { data: null, error: { code: '42501', message: 'forbidden' } };
assert.equal((await invoke('tasks', { createdBy: id, source: 'app', title: 'test', body: '' })).status, 403);
rpcResult = { data: null, error: { code: 'internal', message: 'private database detail' } };
const unavailable = await invoke('steps/claim');
assert.equal(unavailable.status, 503);
assert.deepEqual(await unavailable.json(), { error: 'unavailable' });
rpcResult = { data: step, error: null };
queryError = { code: 'internal', message: 'context failed' };
assert.equal((await invoke('steps/claim')).status, 503);
assert.equal(calls.at(-1).name, 'agent_finish');
assert.equal(calls.at(-1).args.failure, 'context_unavailable');
console.log('✓ Agent API 인증·활성 플래그·32/256KB 제한·검증·RPC·이력 페이지네이션·오류 처리 통과');

const { buildTaskContext } = load('lib/agents/context.ts');
const contextRows = {
  company: [{ id, tenant_id: tenantId, name: '내 기업', memo: '내 메모', condition_tags: [] }, { id: token, tenant_id: token, name: '외부 비밀' }],
  task: [{ id: taskId, tenant_id: tenantId, company_id: id, title: '내 업무', category_id: null, due_date: null, work_status: 'waiting', memo: '보류 사유' }],
  deadline_item: [{ id: 'other', source: 'task', tenant_id: tenantId, company_id: id, title: '다른 마감', due_date: '2099-01-01', days_left: 3 }, { id: 'foreign', source: 'task', tenant_id: token, company_id: id, title: '외부 비밀', days_left: 2 }],
  credential: [{ id: taskId, tenant_id: tenantId, company_id: id, type: '확인서', issued_date: null, expires_date: '2099-01-01', renew_lead_days: 30 }],
  ip_deadline: [{ id: taskId, tenant_id: tenantId, company_id: id, type: 'annuity', ip_right_id: id }],
  ip_right: [{ id, tenant_id: tenantId, company_id: id, title: '내 권리' }],
};
fakeService = {
  from(table) {
    let rows = [...contextRows[table]];
    const filters = [];
    const query = {
      select() { return query; },
      eq(column, value) { filters.push([column, value]); rows = rows.filter((row) => row[column] === value); return query; },
      gte(column, value) { rows = rows.filter((row) => row[column] >= value); return query; },
      lte(column, value) { rows = rows.filter((row) => row[column] <= value); return query; },
      order() { return query; },
      limit(limit) { rows = rows.slice(0, limit); return query; },
      result() { assert.ok(filters.some(([column, value]) => column === 'tenant_id' && value === tenantId)); return { data: rows, error: null }; },
      async single() { const result = query.result(); return { ...result, data: result.data[0] ?? null }; },
      then(resolve, reject) { return Promise.resolve(query.result()).then(resolve, reject); },
    };
    return query;
  },
};
const input = { tenantId, companyId: id, sourceId: taskId };
for (const source of ['task', 'credential', 'ip_deadline']) {
  const context = await buildTaskContext({ ...input, source });
  assert.ok(context.startsWith('[관제 자료 — 참고용 사실]'));
  assert.ok(context.includes('내 기업') && context.includes('미입력') && !context.includes('외부 비밀'));
  assert.ok(context.length <= 6000);
}
await assert.rejects(buildTaskContext({ ...input, companyId: token, source: 'task' }), /forbidden/);
contextRows.task[0].tenant_id = token;
await assert.rejects(buildTaskContext({ ...input, source: 'task' }), /forbidden/);
contextRows.task[0].tenant_id = tenantId;
contextRows.company[0].memo = '긴 자료'.repeat(6000);
contextRows.deadline_item = Array.from({ length: 20 }, (_, index) => ({ id: String(index), source: 'task', company_id: id, tenant_id: tenantId, title: '마감'.repeat(500), days_left: 3 }));
assert.ok((await buildTaskContext({ ...input, source: 'task' })).length <= 6000);
assert.equal((await invoke('triggers/tick', { dryRun: true })).status, 404);
process.env.AGENT_TRIGGER_ENABLED = 'true';
process.env.AGENT_TRIGGER_PROFILE_ID = id;
process.env.AGENT_TRIGGER_DAILY_LIMIT = '';
const triggerCalls = [];
fakeService = { async rpc(name, args) { triggerCalls.push({ name, args }); return { data: { started: 0, skipped: {}, targets: [] }, error: null }; } };
assert.equal((await invoke('triggers/tick', { dryRun: 'true' })).status, 400);
assert.equal((await invoke('triggers/tick', { dryRun: true })).status, 200);
assert.equal(triggerCalls.length, 1);
assert.equal(triggerCalls[0].args.dry_run, true);
assert.equal(triggerCalls[0].args.creator, id);
assert.equal(triggerCalls[0].args.daily_limit, 5);
assert.equal((await invoke('triggers/tick', {})).status, 200);
assert.deepEqual(triggerCalls.map((call) => call.args.dry_run), [true, true, false]);
console.log('✓ 관제 자료 tenant 격리·6000자 제한·트리거 활성 플래그·dry-run 읽기 전용 경로 통과');
