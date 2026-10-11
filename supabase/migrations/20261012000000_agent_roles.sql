create table agent_role (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  company_id uuid,
  key text not null check (key ~ '^[a-z][a-z-]{0,63}$'),
  name text not null check (char_length(name) between 1 and 40 and btrim(name) <> ''),
  kind text not null check (kind in ('orchestrator', 'specialist', 'synthesizer')),
  mode text not null default 'optional' check (mode in ('optional', 'always')),
  instructions text not null check (char_length(instructions) between 1 and 4000 and btrim(instructions) <> ''),
  enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, company_id) references company(tenant_id, id) on delete cascade,
  foreign key (tenant_id, updated_by) references profile(tenant_id, id) on delete set null (updated_by),
  check ((kind = 'specialist' and key not in ('orchestrator', 'synthesizer'))
    or (kind in ('orchestrator', 'synthesizer') and key = kind and company_id is null and mode = 'optional'))
);

create unique index agent_role_scope_key on agent_role(tenant_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create unique index agent_role_core_kind on agent_role(tenant_id, kind) where kind in ('orchestrator', 'synthesizer');
create index agent_role_editor on agent_role(tenant_id, updated_by);

create table agent_role_version (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  role_id uuid not null,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (role_id, version)
);

alter table agent_role enable row level security;
alter table agent_role_version enable row level security;
revoke all on agent_role, agent_role_version from public, anon, authenticated;
grant select, insert, update, delete on agent_role to authenticated;
grant select on agent_role_version to authenticated;
grant all on agent_role, agent_role_version to service_role;

create policy agent_role_read on agent_role for select to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_has_permission('ai.assistant.use'))
);
create policy agent_role_owner_insert on agent_role for insert to authenticated with check (
  tenant_id = (select auth_tenant_id()) and (select auth_is_owner())
);
create policy agent_role_owner_update on agent_role for update to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_is_owner())
) with check (tenant_id = (select auth_tenant_id()) and (select auth_is_owner()));
create policy agent_role_owner_delete on agent_role for delete to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_is_owner())
);
create policy agent_role_version_read on agent_role_version for select to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_has_permission('ai.assistant.use'))
);

create function agent_role_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.tenant_id <> old.tenant_id then raise exception 'immutable_role_identity'; end if;
    insert into agent_role_version(tenant_id, role_id, version, snapshot)
      values(old.tenant_id, old.id, old.version, to_jsonb(old));
    new.version := old.version + 1;
    new.created_at := old.created_at;
  else
    new.version := 1;
  end if;
  if exists(select 1 from profile where id = auth.uid() and tenant_id = new.tenant_id) then new.updated_by := auth.uid(); end if;
  new.updated_at := now();
  return new;
end $$;

create trigger agent_role_audit before insert or update on agent_role for each row execute function agent_role_audit();

create function agent_seed_roles(target uuid) returns void
language sql security definer set search_path = public as $$
  insert into agent_role(tenant_id, key, name, kind, instructions) values
    (target, 'orchestrator', '지휘자', 'orchestrator', $instructions$당신은 지휘자입니다. 태스크를 분석하여 필요한 전문 역할을 선택하고 분석 계획을 세우세요.$instructions$),
    (target, 'finance', '재무', 'specialist', $instructions$당신은 재무 담당자입니다. 재무·현금흐름·비용 관점에서 태스크와 history(앞 단계 output과 messages)를 읽고 의견을 제시하세요.
앞 의견에 동의·반박할 점을 명시하고, 근거가 없으면 불확실성을 밝히세요.$instructions$),
    (target, 'legal', '법무·규제', 'specialist', $instructions$당신은 법무 담당자입니다. 법무·계약·규정 관점에서 태스크와 history(앞 단계 output과 messages)를 읽고 의견을 제시하세요.
앞 의견에 동의·반박할 점을 명시하고, 근거가 없으면 불확실성을 밝히세요.$instructions$),
    (target, 'operations', '운영', 'specialist', $instructions$당신은 운영 담당자입니다. 운영·인력·실행 절차 관점에서 태스크와 history(앞 단계 output과 messages)를 읽고 의견을 제시하세요.
앞 의견에 동의·반박할 점을 명시하고, 근거가 없으면 불확실성을 밝히세요.$instructions$),
    (target, 'strategy', '전략', 'specialist', $instructions$당신은 전략 담당자입니다. 전략·우선순위·사업 방향 관점에서 태스크와 history(앞 단계 output과 messages)를 읽고 의견을 제시하세요.
앞 의견에 동의·반박할 점을 명시하고, 근거가 없으면 불확실성을 밝히세요.$instructions$),
    (target, 'risk', '리스크', 'specialist', $instructions$당신은 위험 담당자입니다. 위험·불확실성·대응 방안 관점에서 태스크와 history(앞 단계 output과 messages)를 읽고 의견을 제시하세요.
앞 의견에 동의·반박할 점을 명시하고, 근거가 없으면 불확실성을 밝히세요.$instructions$),
    (target, 'synthesizer', '종합', 'synthesizer', $instructions$당신은 종합 담당자입니다. 전체 history의 의견과 동의·반박을 비교하여 최종 결론과 근거, 실행 항목, 미해결 질문을 정리하세요.$instructions$)
  on conflict do nothing;
$$;

select agent_seed_roles(id) from tenant;

create function agent_tenant_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform agent_seed_roles(new.id);
  return new;
end $$;
create trigger agent_tenant_roles after insert on tenant for each row execute function agent_tenant_roles();

alter table agent_step add column role_version integer;

create function agent_effective_roles(target_tenant uuid, target_company uuid) returns setof agent_role
language sql stable security definer set search_path = public as $$
  select distinct on (key) agent_role.* from agent_role
  where tenant_id = target_tenant and (company_id is null or company_id = target_company)
  order by key, company_id nulls last
$$;

create or replace function agent_claim(target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare job agent_step; task agent_task; definition agent_role; role_data jsonb;
begin
  select * into task from agent_task where id = target for update skip locked;
  if task.id is null then return null; end if;
  if not exists (
    select 1 from profile member
    where member.id = task.created_by and member.tenant_id = task.tenant_id
      and task.status in ('queued', 'running')
      and member.status = 'active' and (member.role = 'owner' or 'ai.assistant.use' = any(member.permissions))
  ) then
    update agent_step set status = 'cancelled', token = null, lease_until = null, finished_at = now()
      where task_id = target and status in ('queued', 'running');
    update agent_task set status = 'cancelled', finished_at = now()
      where id = target and status in ('queued', 'running');
    return null;
  end if;
  update agent_step set status = case when attempts >= 4 then 'failed' else 'queued' end,
    error_code = 'worker_timeout', token = null, lease_until = null, available_at = now(),
    finished_at = case when attempts >= 4 then now() else null end
    where task_id = target and status = 'running' and lease_until < now();
  if exists(select 1 from agent_step where task_id = target and status = 'failed') then
    update agent_task set status = 'failed', finished_at = now() where id = target;
    update agent_step set status = 'cancelled', token = null, lease_until = null, finished_at = now()
      where task_id = target and status = 'queued';
    return null;
  end if;
  select candidate.* into job from agent_step candidate
    where candidate.task_id = target and candidate.status = 'queued' and candidate.available_at <= now()
      and not exists (
        select 1 from agent_step earlier
        where earlier.task_id = candidate.task_id and earlier.seq < candidate.seq and earlier.status <> 'succeeded'
      )
    order by candidate.seq for update skip locked limit 1;
  if job.id is null then return null; end if;
  select * into definition from agent_effective_roles(task.tenant_id, task.company_id) where key = job.role;
  if definition.id is null or not definition.enabled then
    update agent_step set status = 'failed', error_code = 'role_unavailable', finished_at = now(), token = null, lease_until = null where id = job.id;
    update agent_task set status = 'failed', finished_at = now() where id = task.id;
    update agent_step set status = 'cancelled', finished_at = now(), token = null, lease_until = null where task_id = task.id and status = 'queued';
    return null;
  end if;
  role_data := jsonb_build_object('current', jsonb_build_object(
    'key', definition.key, 'name', definition.name, 'instructions', definition.instructions, 'version', definition.version));
  if job.role = 'orchestrator' then
    role_data := role_data || jsonb_build_object('specialists', (
      select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'mode', mode) order by key), '[]'::jsonb)
      from agent_effective_roles(task.tenant_id, task.company_id) where enabled and kind = 'specialist'
    ));
  end if;
  update agent_step set status = 'running', role_version = definition.version, token = gen_random_uuid(), lease_until = now() + interval '5 minutes',
    attempts = attempts + 1, output = null, error_code = null, finished_at = null
    where id = job.id returning * into job;
  update agent_task set status = 'running' where id = target and status = 'queued';
  return to_jsonb(job) || jsonb_build_object('roles', role_data);
end $$;

create or replace function agent_finish(step_id uuid, lease_token uuid, output jsonb, failure text, next_steps jsonb default null, messages jsonb default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare job agent_step; task agent_task; entry jsonb; next_seq integer; step_count integer;
begin
  select * into task from agent_task
    where id = (select task_id from agent_step where id = step_id) for update;
  if task.id is null then return false; end if;
  select * into job from agent_step where id = step_id and token = lease_token and status = 'running' and lease_until > now() for update;
  if job.id is null then return false; end if;
  if not exists (
    select 1 from profile member
    where member.id = task.created_by and member.tenant_id = task.tenant_id and task.status in ('queued', 'running')
      and member.status = 'active' and (member.role = 'owner' or 'ai.assistant.use' = any(member.permissions))
  ) then
    update agent_step set status = 'cancelled', token = null, lease_until = null, finished_at = now()
      where task_id = task.id and status in ('queued', 'running');
    update agent_task set status = 'cancelled', finished_at = now()
      where id = task.id and status in ('queued', 'running');
    return false;
  end if;
  if failure is not null then
    update agent_step set
      status = case when attempts < 4 and failure <> 'quota' then 'queued' else 'failed' end,
      available_at = now() + case attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end,
      error_code = failure, token = null, lease_until = null,
      finished_at = case when attempts >= 4 or failure = 'quota' then now() else null end
      where id = step_id;
    if job.attempts >= 4 or failure = 'quota' then
      update agent_task set status = 'failed', finished_at = now() where id = task.id;
      update agent_step set status = 'cancelled', token = null, lease_until = null, finished_at = now()
        where task_id = task.id and status = 'queued';
    end if;
    return true;
  end if;
  if next_steps is not null then
    if jsonb_typeof(next_steps) <> 'array' then raise exception 'invalid_request' using errcode = '22023'; end if;
    select count(*), coalesce(max(seq), -1) + 1 into step_count, next_seq from agent_step where task_id = task.id;
    if step_count + jsonb_array_length(next_steps) > 8 then raise exception 'step_limit' using errcode = '22023'; end if;
    for entry in select value from jsonb_array_elements(next_steps) loop
      if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'role') is distinct from 'string'
        or char_length(entry->>'role') not between 1 and 64 then
        raise exception 'invalid_request' using errcode = '22023';
      end if;
      if not exists (
        select 1 from agent_effective_roles(task.tenant_id, task.company_id)
        where key = entry->>'role' and enabled
          and (kind = 'specialist' or (kind = 'synthesizer' and key = 'synthesizer'))
      ) then raise exception 'invalid_request' using errcode = '22023'; end if;
      insert into agent_step(tenant_id, task_id, role, seq) values(task.tenant_id, task.id, entry->>'role', next_seq);
      next_seq := next_seq + 1;
    end loop;
  end if;
  if messages is not null then
    if jsonb_typeof(messages) <> 'array' then raise exception 'invalid_request' using errcode = '22023'; end if;
    for entry in select value from jsonb_array_elements(messages) loop
      if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'role') is distinct from 'string'
        or char_length(entry->>'role') not between 1 and 64
        or jsonb_typeof(entry->'content') is distinct from 'string' or char_length(entry->>'content') > 8000 then
        raise exception 'invalid_request' using errcode = '22023';
      end if;
      insert into agent_message(tenant_id, task_id, step_id, role, content)
        values(task.tenant_id, task.id, job.id, entry->>'role', entry->>'content');
    end loop;
  end if;
  update agent_step set status = 'succeeded', output = agent_finish.output,
    token = null, lease_until = null, error_code = null, finished_at = now() where id = step_id;
  if not exists(select 1 from agent_step where task_id = task.id and status <> 'succeeded') then
    update agent_task set status = 'succeeded', finished_at = now(),
      result = (select step.output from agent_step step where step.task_id = task.id order by step.seq desc limit 1)
      where id = task.id;
  end if;
  return true;
end $$;


revoke all on function agent_role_audit(), agent_seed_roles(uuid), agent_tenant_roles(), agent_effective_roles(uuid,uuid) from public, anon, authenticated;
grant execute on function agent_effective_roles(uuid,uuid) to service_role;
revoke all on function agent_claim(uuid), agent_finish(uuid,uuid,jsonb,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function agent_claim(uuid), agent_finish(uuid,uuid,jsonb,text,jsonb,jsonb) to service_role;
