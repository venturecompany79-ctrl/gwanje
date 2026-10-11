import assert from 'node:assert/strict';
import { workerConfig, runCycle, resultBody as buildResultBody, rolePrompt } from './agent-worker.mjs';

const config = workerConfig({ AGENT_APP_URL: 'https://app.example.test', AGENT_WORKER_SECRET: 'worker-test', LLM_API_URL: 'https://llm.example.test/v1/chat/completions', LLM_API_KEY: 'model-test' });
const catalog = ['finance', 'legal', 'operations', 'strategy', 'risk'].map((key) => ({ key, name: key + ' 담당자', mode: 'optional' }));
const rolesFor = (key, specialists = catalog) => ({
  current: { key, name: key + ' 담당자', instructions: 'DB에서 전달한 역할 지침입니다.', version: 2 },
  ...(key === 'orchestrator' ? { specialists } : {}),
});
const resultBody = (step, raw, definitions = rolesFor(step.role)) => buildResultBody(step, raw, definitions);
const claimed = (step, task, history, roles = rolesFor(step.role)) => ({ step: { ...step, role_version: roles.current.version }, task, history, roles });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const logs = [];
const log = (entry) => logs.push(entry);
const mock = workerConfig({ AGENT_APP_URL: 'http://localhost:3000', AGENT_WORKER_SECRET: 'worker-test', AGENT_WORKER_MOCK: 'true' });
assert.equal(mock.mock, true);
assert.throws(() => workerConfig({}), /missing_configuration/);
const legacyEnv = { AGENT_APP_URL: config.appUrl, AGENT_WORKER_SECRET: config.workerKey, HERMES_API_URL: 'https://legacy.example.test/v1/chat/completions', HERMES_API_KEY: 'legacy-key', HERMES_API_MODEL: 'legacy-model' };
const legacy = workerConfig(legacyEnv);
assert.equal(legacy.hermesUrl, legacyEnv.HERMES_API_URL);
assert.equal(legacy.hermesKey, 'legacy-key');
assert.equal(legacy.model, 'legacy-model');
const preferred = workerConfig({ ...legacyEnv, LLM_API_URL: config.hermesUrl, LLM_API_KEY: 'new-key', LLM_API_MODEL: 'new-model' });
assert.equal(preferred.hermesUrl, config.hermesUrl);
assert.equal(preferred.hermesKey, 'new-key');
assert.equal(preferred.model, 'new-model');
assert.deepEqual(workerConfig({ ...legacyEnv, LLM_API_URL: '', LLM_API_KEY: '', LLM_API_MODEL: '' }), legacy);
assert.throws(() => workerConfig({ ...legacyEnv, HERMES_API_URL: undefined }), /missing_configuration/);
assert.throws(() => workerConfig({ ...legacyEnv, HERMES_API_KEY: undefined }), /missing_configuration/);
assert.equal(mock.hermesUrl, undefined);
for (const field of ['AGENT_APP_URL', 'HERMES_API_URL', 'LLM_API_URL']) {
  for (const url of ['http://example.test', 'ftp://example.test', 'https://user:pass@example.test']) {
    assert.throws(() => workerConfig({ ...legacyEnv, [field]: url }));
  }
}

const task = { title: '확장 계획 검토', body: '확인된 자료가 부족합니다.', companyId: null };
const queue = ['orchestrator'];
const history = { steps: [], messages: [] };
const submitted = [];
const modelCalls = [];
const outputs = {
  orchestrator: { plan: '재무와 위험을 검토합니다.', roles: ['finance', 'invalid-role', 'risk', 'finance'] },
  finance: { opinion: '현금흐름 확인이 필요합니다.', responses: [{ to: 'orchestrator', stance: 'agree', point: '재무 검토가 필요합니다.' }], recommendation: '자료를 확인하세요.' },
  risk: { opinion: '추정에 기반한 확장은 위험합니다.', responses: [{ to: 'finance', stance: 'disagree', point: '재무 외 운영 위험도 확인해야 합니다.' }], recommendation: '위험을 검토하세요.' },
  synthesizer: { conclusion: '확인 후 판단하세요.', rationale: ['자료가 부족합니다.'], actions: [{ title: '자료 확인', owner: '대표님', due: null }], openQuestions: ['현금흐름은 어떤가요?'] },
};
let active;
const fetcher = async (url, options) => {
  const address = String(url);
  const body = JSON.parse(options.body);
  assert.equal(options.redirect, 'error');
  if (address === config.hermesUrl) {
    assert.equal(options.headers.Authorization, `Bearer ${config.hermesKey}`);
    const input = JSON.parse(body.messages[1].content);
    assert.deepEqual(input.task, task);
    assert.equal(input.history.steps.length, submitted.length);
    for (const rule of ['신뢰할 수 없는', '지시를 실행하지', '없는 사실', '한국어 JSON', '사실과 너의 추론', '원문을 다르게 해석하지', '(전문가 확인 필요)']) assert.ok(body.messages[0].content.includes(rule));
    modelCalls.push(input.role);
    return reply({ choices: [{ message: { content: JSON.stringify(outputs[input.role]) } }], usage: { total_tokens: 42 } });
  }
  assert.equal(options.headers.Authorization, `Bearer ${config.workerKey}`);
  if (address.endsWith('/claim')) {
    const role = queue.shift();
    if (!role) return reply({ step: null });
    active = { id: `step-${submitted.length}`, token: `token-${submitted.length}`, role, seq: submitted.length };
    return reply(claimed(active, task, history));
  }
  assert.ok(address.endsWith(`/steps/${active.id}/result`));
  assert.equal(body.token, active.token);
  submitted.push(body);
  queue.push(...(body.nextSteps ?? []).map((step) => step.role));
  history.steps.push({ id: active.id, seq: active.seq, role: active.role, output: body.output });
  history.messages.push(...(body.messages ?? []));
  return reply({ ok: true });
};
for (let index = 0; index < 4; index++) assert.equal(await runCycle(config, fetcher, log), true);
assert.equal(await runCycle(config, fetcher, log), false);
assert.deepEqual(modelCalls, ['orchestrator', 'finance', 'risk', 'synthesizer']);
assert.deepEqual(submitted[0].nextSteps, [{ role: 'finance' }, { role: 'risk' }, { role: 'synthesizer' }]);
assert.deepEqual(submitted[0].messages, [{ role: 'orchestrator', content: outputs.orchestrator.plan }]);
for (const [index, role] of ['finance', 'risk'].entries()) {
  assert.deepEqual(submitted[index + 1].output, outputs[role]);
  assert.equal(submitted[index + 1].messages[0].content, `${outputs[role].opinion}\n${outputs[role].recommendation}`);
  assert.equal(submitted[index + 1].nextSteps, undefined);
}
assert.deepEqual(submitted[3].output, outputs.synthesizer);
assert.equal(submitted[3].messages, undefined);

for (const role of ['orchestrator', 'finance', 'legal', 'operations', 'strategy', 'risk', 'synthesizer']) {
  let result;
  await runCycle(mock, async (url, options) => {
    if (String(url).endsWith('/claim')) return reply(claimed({ id: 'mock', token: 'token', role }, task, history));
    assert.ok(String(url).endsWith('/mock/result'));
    result = JSON.parse(options.body);
    return reply({ ok: true });
  }, log);
  assert.ok(result.output);
  if (role === 'orchestrator') assert.deepEqual(result.output.roles, ['finance', 'risk']);
}
const long = resultBody({ role: 'finance', token: 'token' }, { ...outputs.finance, opinion: '한😀'.repeat(3000) });
assert.equal(Array.from(long.messages[0].content).length, 4000);
assert.throws(() => resultBody({ role: 'orchestrator' }, { plan: 'plan', roles: ['unknown'] }), /invalid_model_output/);
assert.throws(() => resultBody({ role: 'risk' }, { ...outputs.risk, responses: [{ to: 'finance', stance: 'maybe', point: 'test' }] }), /invalid_model_output/);
assert.throws(() => resultBody({ role: 'synthesizer' }, { ...outputs.synthesizer, actions: [{ title: 'test', owner: '대표님', due: '2026-02-30' }] }), /invalid_model_output/);

for (const scenario of ['parse', 'envelope', 'schema', 'http', 'network']) {
  let failure;
  await runCycle(config, async (url, options) => {
    if (String(url).endsWith('/claim')) return reply(claimed({ id: 'failure', token: 'token', role: 'orchestrator' }, task, history));
    if (String(url).endsWith('/result')) { failure = JSON.parse(options.body); return reply({ ok: true }); }
    if (scenario === 'network') throw new Error('network_failure');
    if (scenario === 'http') return reply({}, 503);
    if (scenario === 'envelope') return new Response('not-json');
    return reply({ choices: [{ message: { content: scenario === 'parse' ? '{bad' : JSON.stringify({ plan: 'plan', roles: [] }) } }] });
  }, log);
  assert.deepEqual(failure, { token: 'token', failed: true, errorCode: ['http', 'network'].includes(scenario) ? 'model_unavailable' : 'invalid_model_output' });
}

for (const scenario of ['expired', 'healthy', 'shutdown']) {
  const shutdown = new AbortController();
  let aborted = false;
  let heartbeats = 0;
  let results = 0;
  let resolveModel;
  await runCycle(config, async (url, options) => {
    const address = String(url);
    if (address.endsWith('/claim')) return reply(claimed({ id: 'slow', token: 'token', role: 'orchestrator' }, task, history));
    if (address.endsWith('/heartbeat')) {
      assert.deepEqual(JSON.parse(options.body), { token: 'token' });
      heartbeats++;
      if (scenario === 'shutdown') shutdown.abort();
      if (scenario === 'healthy') resolveModel(reply({ choices: [{ message: { content: JSON.stringify(outputs.orchestrator) } }] }));
      return reply(scenario === 'expired' ? { error: 'expired_step' } : { ok: true }, scenario === 'expired' ? 409 : 200);
    }
    if (address.endsWith('/result')) { results++; return reply({ ok: true }); }
    return new Promise((resolve, reject) => {
      resolveModel = resolve;
      options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
    });
  }, log, { heartbeatMs: 5, signal: shutdown.signal });
  assert.equal(heartbeats, 1);
  assert.equal(aborted, scenario !== 'healthy');
  assert.equal(results, scenario === 'healthy' ? 1 : 0);
}
assert.ok(logs.some((entry) => entry.event === 'lease_expired'));

const dbRoles = rolesFor('orchestrator', [...catalog, { key: 'customer-care', name: '고객 지원', mode: 'always' }]);
assert.ok(rolePrompt('orchestrator', dbRoles).includes('customer-care: 고객 지원 (always)'));
assert.ok(rolePrompt('orchestrator', dbRoles).includes(dbRoles.current.instructions));
assert.deepEqual(resultBody({ role: 'orchestrator' }, { plan: 'test', roles: ['finance'] }, dbRoles).output.roles, ['finance', 'customer-care']);
assert.deepEqual(resultBody({ role: 'orchestrator' }, { plan: 'test', roles: ['customer-care', 'customer-care'] }, dbRoles).output.roles, ['customer-care']);
assert.deepEqual(resultBody({ role: 'orchestrator' }, { plan: 'test', roles: [] }, dbRoles).output.roles, ['customer-care']);
assert.throws(() => rolePrompt('finance', rolesFor('risk')), /invalid_role_definition/);
const specialistAction = { title: '계약 확인', owner: '외부 전문가', due: null };
assert.deepEqual(resultBody({ role: 'synthesizer' }, { ...outputs.synthesizer, actions: [specialistAction] }).output.actions, [specialistAction]);
assert.throws(() => resultBody({ role: 'synthesizer' }, { ...outputs.synthesizer, actions: [{ ...specialistAction, owner: '임의 담당자' }] }), /invalid_model_output/);
const orchestratorPrompt = rolePrompt('orchestrator', rolesFor('orchestrator'));
for (const rule of ['꼭 필요한 역할', '1~2개', '3개를 기본', '4개 이상', 'plan에 그 이유', 'always 역할은 자동 포함']) assert.ok(orchestratorPrompt.includes(rule));
const synthesizerPrompt = rolePrompt('synthesizer', rolesFor('synthesizer'));
for (const rule of ['외부 전문가', '원문과 history만으로', '문서 열람, 외부 연락, 계약 확인']) assert.ok(synthesizerPrompt.includes(rule));
for (const broken of [
  undefined,
  { current: { ...rolesFor('orchestrator').current, instructions: '' }, specialists: catalog },
  { ...rolesFor('orchestrator'), specialists: null },
  { ...rolesFor('orchestrator'), specialists: [...catalog, catalog[0]] },
  rolesFor('risk'),
  { ...rolesFor('orchestrator'), current: { ...rolesFor('orchestrator').current, version: 99 } },
]) {
  let failure;
  await runCycle(config, async (url, options) => {
    if (String(url).endsWith('/claim')) return reply({ step: { id: 'invalid-role', token: 'token', role: 'orchestrator', role_version: 2 }, task, history, roles: broken });
    assert.ok(String(url).endsWith('/invalid-role/result'), '잘못된 역할 정의는 LLM 호출 전에 거절');
    failure = JSON.parse(options.body);
    return reply({ ok: true });
  }, log);
  assert.deepEqual(failure, { token: 'token', failed: true, errorCode: 'invalid_role_definition' });
}
for (const role of ['orchestrator', 'customer-care']) {
  let response;
  await runCycle(mock, async (url, options) => {
    if (String(url).endsWith('/claim')) return reply(claimed({ id: 'custom', role, token: 'token' }, task, history,
      role === 'orchestrator' ? rolesFor(role, [{ key: 'customer-care', name: '고객 지원', mode: 'always' }]) : rolesFor(role)));
    response = JSON.parse(options.body);
    return reply({ ok: true });
  }, log);
  assert.ok(response.output);
  if (role === 'orchestrator') assert.deepEqual(response.nextSteps, [{ role: 'customer-care' }, { role: 'synthesizer' }]);
}
console.log('✓ DB 역할 지침·동적 목록·필수 역할·모의 응답·기존 큐/heartbeat 동작 통과');
