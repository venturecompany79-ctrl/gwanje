import { pathToFileURL } from 'node:url';
import { loadEnvFiles, workerConfig } from './agent-worker.mjs';
import { explainError } from './agent-task.mjs';

export async function triggerOnce(dryRun, env = process.env, fetcher = fetch) {
  const config = workerConfig({ ...env, AGENT_WORKER_MOCK: 'true', LLM_API_URL: '', HERMES_API_URL: '' });
  const response = await fetcher(new URL('/api/internal/agents/triggers/tick', config.appUrl), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.workerKey}` },
    body: JSON.stringify({ dryRun }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(['disabled', 'unauthorized', 'forbidden'].includes(result.error) ? result.error : 'unavailable');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    loadEnvFiles();
    if (process.argv.slice(2).some((arg) => arg !== '--dry-run')) throw new Error('invalid_request');
    const result = await triggerOnce(process.argv.includes('--dry-run'));
    console.log(`시작: ${result.started}건 | 제외: ${result.skipped.excluded} | 이미 실행: ${result.skipped.already_run} | 한도 초과: ${result.skipped.daily_limit}`);
    for (const item of result.targets) console.log(`${item.trigger} | ${item.company ?? '미입력'} | ${item.title} | ${item.daysLeft}일 | ${item.wouldStart ? '시작 대상' : '건너뜀'} (${item.reason})`);
  } catch (error) {
    console.error(error.message === 'disabled' ? '앱의 AGENT_TRIGGER_ENABLED와 AGENT_ORCHESTRATION_ENABLED 설정을 확인하세요.' : explainError(error.message));
    process.exitCode = 1;
  }
}
