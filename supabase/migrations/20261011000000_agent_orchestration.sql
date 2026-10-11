create table agent_task (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  created_by uuid not null,
  source text not null check (source in ('app', 'slack')),
  company_id uuid,
  title text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, created_by) references profile(tenant_id, id) on delete cascade,
  foreign key (tenant_id, company_id) references company(tenant_id, id)
);

create table agent_step (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  role text not null,
  seq integer not null check (seq >= 0),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  error_code text,
  output jsonb,
  unique (task_id, seq),
  unique (tenant_id, task_id, id),
  foreign key (tenant_id, task_id) references agent_task(tenant_id, id) on delete cascade
);

create table agent_message (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_id uuid not null,
  step_id uuid,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, task_id) references agent_task(tenant_id, id) on delete cascade,
  foreign key (tenant_id, task_id, step_id) references agent_step(tenant_id, task_id, id) on delete cascade
);

create index agent_task_recent on agent_task(tenant_id, created_at desc);
create index agent_task_creator on agent_task(tenant_id, created_by);
create index agent_task_company on agent_task(tenant_id, company_id);
create index agent_step_queue on agent_step(task_id, seq) where status = 'queued';
create index agent_step_lease on agent_step(task_id, lease_until) where status = 'running';
create index agent_message_recent on agent_message(tenant_id, task_id, created_at);
create index agent_message_step on agent_message(tenant_id, task_id, step_id);

alter table agent_task enable row level security;
alter table agent_step enable row level security;
alter table agent_message enable row level security;

revoke all on agent_task, agent_step, agent_message from public, anon, authenticated;
grant select on agent_task, agent_step, agent_message to authenticated;
grant all on agent_task, agent_step, agent_message to service_role;

create policy agent_task_tenant on agent_task for select to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_has_permission('ai.assistant.use'))
);
create policy agent_step_tenant on agent_step for select to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_has_permission('ai.assistant.use'))
);
create policy agent_message_tenant on agent_message for select to authenticated using (
  tenant_id = (select auth_tenant_id()) and (select auth_has_permission('ai.assistant.use'))
);

create function agent_claim(target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare job agent_step;
begin
  perform pg_advisory_xact_lock(hashtextextended(target::text, 0));
  update agent_step set status = case when attempts >= 4 then 'failed' else 'queued' end,
    error_code = 'worker_timeout', token = null, lease_until = null, available_at = now()
    where task_id = target and status = 'running' and lease_until < now();
  if not exists (
    select 1 from agent_task task join profile member
      on member.id = task.created_by and member.tenant_id = task.tenant_id
    where task.id = target and task.status in ('queued', 'running')
      and member.status = 'active' and (member.role = 'owner' or 'ai.assistant.use' = any(member.permissions))
  ) then
    update agent_step set status = 'cancelled', token = null, lease_until = null
      where task_id = target and status in ('queued', 'running');
    return null;
  end if;
  select * into job from agent_step where task_id = target and status = 'queued' and available_at <= now()
    order by seq for update skip locked limit 1;
  if job.id is null then return null; end if;
  update agent_step set status = 'running', token = gen_random_uuid(), lease_until = now() + interval '5 minutes',
    attempts = attempts + 1, output = null, error_code = null
    where id = job.id returning * into job;
  return to_jsonb(job);
end $$;

create function agent_finish(step_id uuid, lease_token uuid, output jsonb, failure text)
returns boolean language plpgsql security definer set search_path = public as $$
declare job agent_step;
begin
  select * into job from agent_step where id = step_id and token = lease_token and status = 'running' and lease_until > now() for update;
  if job.id is null then return false; end if;
  if not exists (
    select 1 from agent_task task join profile member
      on member.id = task.created_by and member.tenant_id = task.tenant_id
    where task.id = job.task_id and task.tenant_id = job.tenant_id and task.status in ('queued', 'running')
      and member.status = 'active' and (member.role = 'owner' or 'ai.assistant.use' = any(member.permissions))
  ) then
    update agent_step set status = 'cancelled', token = null, lease_until = null where id = step_id;
    return false;
  end if;
  if failure is not null then
    update agent_step set
      status = case when attempts < 4 and failure <> 'quota' then 'queued' else 'failed' end,
      available_at = now() + case attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end,
      error_code = failure, token = null, lease_until = null
      where id = step_id;
    return true;
  end if;
  update agent_step set status = 'succeeded', output = agent_finish.output,
    token = null, lease_until = null, error_code = null where id = step_id;
  return true;
end $$;

create function agent_heartbeat(step_id uuid, lease_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update agent_step set lease_until = now() + interval '5 minutes'
    where id = step_id and token = lease_token and status = 'running' and lease_until > now();
  return found;
end $$;

revoke all on function agent_claim(uuid), agent_finish(uuid,uuid,jsonb,text), agent_heartbeat(uuid,uuid) from public, anon, authenticated;
grant execute on function agent_claim(uuid), agent_finish(uuid,uuid,jsonb,text), agent_heartbeat(uuid,uuid) to service_role;
