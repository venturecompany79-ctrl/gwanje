import { pathToFileURL } from 'node:url';
import { loadEnvFiles, workerConfig } from './agent-worker.mjs';

export function explainError(code) {
  return ({
    disabled: '앱의 AGENT_ORCHESTRATION_ENABLED=true 설정을 확인하세요.',
    unauthorized: '앱과 AGENT_WORKER_SECRET이 같은지 확인하세요.',
    forbidden: '생성자의 활성 상태·AI 권한 및 법인의 tenant를 확인하세요.',
    invalid_request: '제목·본문·사용자 및 법인 UUID를 확인하세요.',
    payload_too_large: '태스크 요청이 32KB를 초과했습니다.',
    missing_configuration: 'AGENT_APP_URL, AGENT_WORKER_SECRET, AGENT_CREATOR_ID 설정을 확인하세요.',
    env_file_unreadable: '설정 파일을 읽을 수 없습니다. 파일 권한을 확인하세요.',
  })[code] ?? '요청에 실패했습니다. 앱 주소·연결 상태와 서버 로그를 확인하세요.';
}

export async function createTask(args, env = process.env, fetcher = fetch) {
  const [title, body, companyId] = args;
  const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (!env.AGENT_CREATOR_ID) throw new Error('missing_configuration');
  if (args.length < 2 || args.length > 3 || !title.trim() || !uuid(env.AGENT_CREATOR_ID) || (companyId !== undefined && !uuid(companyId))) throw new Error('invalid_request');
  const config = workerConfig({ ...env, AGENT_WORKER_MOCK: 'true', LLM_API_URL: '', HERMES_API_URL: '' });
  const response = await fetcher(new URL('/api/internal/agents/tasks', config.appUrl), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.workerKey}` },
    body: JSON.stringify({ createdBy: env.AGENT_CREATOR_ID, source: 'app', title, body, ...(companyId ? { companyId } : {}) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(Object.hasOwn({ disabled: 1, unauthorized: 1, forbidden: 1, invalid_request: 1, payload_too_large: 1 }, data.error) ? data.error : `http_${response.status}`);
  if (!uuid(data.taskId)) throw new Error('invalid_response');
  return data.taskId;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    loadEnvFiles();
    console.log(await createTask(process.argv.slice(2)));
  } catch (error) {
    console.error(explainError(error.message));
    process.exitCode = 1;
  }
}
