import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadEnvFiles } from './agent-worker.mjs';

export async function readResult(service, taskId, creatorId) {
  let query = service.from('agent_task').select('*').order('created_at', { ascending: false }).order('id').limit(1);
  if (taskId) query = query.eq('id', taskId);
  if (creatorId) query = query.eq('created_by', creatorId);
  const { data: task, error } = await query.maybeSingle();
  if (error) throw new Error('태스크 조회에 실패했습니다. DB 설정을 확인하세요.');
  if (!task) throw new Error('조회할 태스크가 없습니다.');
  const steps = await service.from('agent_step').select('*').eq('task_id', task.id).eq('tenant_id', task.tenant_id).order('seq');
  if (steps.error) throw new Error('단계 조회에 실패했습니다.');
  const messages = [];
  for (let offset = 0; ; offset += 500) {
    const page = await service.from('agent_message').select('role, content').eq('task_id', task.id).eq('tenant_id', task.tenant_id)
      .order('created_at').order('id').range(offset, offset + 499);
    if (page.error) throw new Error('메시지 조회에 실패했습니다.');
    messages.push(...page.data);
    if (page.data.length < 500) break;
  }
  return { task, steps: steps.data, messages };
}

export function formatResult({ task, steps, messages }) {
  const lines = [`태스크: ${task.title}`, `ID: ${task.id}`, `상태: ${task.status}`, '', '단계 (소요 초는 생성부터 완료/현재까지의 경과 시간, 대기·재시도 포함)'];
  for (const step of steps) {
    const seconds = Math.max(0, (Date.parse(step.finished_at ?? new Date().toISOString()) - Date.parse(step.created_at)) / 1000).toFixed(1);
    lines.push(`  ${step.seq}. ${step.role} | ${step.status} | 시도 ${step.attempts}회 | ${seconds}초`);
  }
  lines.push('', '역할별 메시지 요약');
  for (const message of messages) {
    const summary = Array.from(message.content.replace(/\s+/g, ' '));
    lines.push(`  [${message.role}] ${summary.slice(0, 200).join('')}${summary.length > 200 ? '…' : ''}`);
  }
  const result = task.result;
  lines.push('', '최종 결론', result?.conclusion ?? '(아직 없음)');
  if (Array.isArray(result?.rationale)) lines.push('근거', ...result.rationale.map((item) => `  - ${item}`));
  if (Array.isArray(result?.actions)) lines.push('실행 항목', ...result.actions.map((item) => `  - ${item.title} | ${item.owner} | ${item.due ?? '기한 미정'}`));
  if (Array.isArray(result?.openQuestions)) lines.push('미해결 질문', ...result.openQuestions.map((item) => `  - ${item}`));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    loadEnvFiles();
    const [taskId, extra] = process.argv.slice(2);
    if (extra || (taskId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId))) throw new Error('사용법: npm run agent:result -- [taskId UUID]');
    const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, AGENT_CREATOR_ID: creatorId } = process.env;
    if (!url || !key) throw new Error('.env.local의 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    console.log(formatResult(await readResult(service, taskId, creatorId)));
  } catch (error) {
    const safe = ['태스크 조회', '조회할 태스크', '단계 조회', '메시지 조회', '사용법:', '.env.local의'].some((prefix) => error.message.startsWith(prefix));
    console.error(safe ? error.message : '결과를 조회하지 못했습니다. 설정 파일·DB 연결을 확인하세요.');
    process.exitCode = 1;
  }
}
