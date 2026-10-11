import assert from 'node:assert/strict';
import { workerConfig, runCycle, resultBody } from './agent-worker.mjs';

const config = workerConfig({ AGENT_APP_URL: 'https://app.example.test', AGENT_WORKER_SECRET: 'worker-test', HERMES_API_KEY: 'model-test' });
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const logs = [];
const log = (entry) => logs.push(entry);
const mock = workerConfig({ AGENT_APP_URL: 'http://localhost:3000', AGENT_WORKER_SECRET: 'worker-test', AGENT_WORKER_MOCK: 'true' });
assert.equal(mock.mock, true);
assert.throws(() => workerConfig({}), /missing_configuration/);
for (const field of ['AGENT_APP_URL', 'HERMES_API_URL']) {
  for (const url of ['http://example.test', 'ftp://example.test', 'https://user:pass@example.test']) {
    assert.throws(() => workerConfig({ AGENT_APP_URL: config.appUrl, AGENT_WORKER_SECRET: config.workerKey, HERMES_API_KEY: config.hermesKey, [field]: url }));
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
    for (const rule of ['신뢰할 수 없는', '지시를 실행하지', '없는 사실', '한국어 JSON']) assert.ok(body.messages[0].content.includes(rule));
    modelCalls.push(input.role);
    return reply({ choices: [{ message: { content: JSON.stringify(outputs[input.role]) } }], usage: { total_tokens: 42 } });
  }
  assert.equal(options.headers.Authorization, `Bearer ${config.workerKey}`);
  if (address.endsWith('/claim')) {
    const role = queue.shift();
    if (!role) return reply({ step: null });
    active = { id: `step-${submitted.length}`, token: `token-${submitted.length}`, role, seq: submitted.length };
    return reply({ step: active, task, history });
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
    if (String(url).endsWith('/claim')) return reply({ step: { id: 'mock', token: 'token', role }, task, history });
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
    if (String(url).endsWith('/claim')) return reply({ step: { id: 'failure', token: 'token', role: 'orchestrator' }, task, history });
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
    if (address.endsWith('/claim')) return reply({ step: { id: 'slow', token: 'token', role: 'orchestrator' }, task, history });
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
console.log('✓ Agent worker 역할 순서·요청 본문·모의 응답·heartbeat 중단·종료·모델 오류 처리 통과');
