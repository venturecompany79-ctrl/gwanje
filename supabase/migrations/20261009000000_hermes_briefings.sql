create table ai_briefing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('check', 'morning', 'closing', 'manual')),
  result jsonb not null,
  snapshot jsonb not null,
  input_hash text not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references profile(tenant_id, id) on delete cascade
);

create table ai_briefing_state (
  user_id uuid primary key,
  tenant_id uuid not null,
  snapshot jsonb,
  input_hash text,
  latest_id uuid references ai_briefing(id) on delete set null,
  checked_at timestamptz,
  next_at timestamptz,
  call_date date,
  call_count integer not null default 0,
  foreign key (tenant_id, user_id) references profile(tenant_id, id) on delete cascade
);

create table ai_briefing_job (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('check', 'morning', 'closing', 'manual')),
  slot timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  error_code text,
  snapshot jsonb,
  previous_snapshot jsonb,
  input_hash text,
  data_as_of timestamptz,
  model_reserved boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (tenant_id, user_id) references profile(tenant_id, id) on delete cascade,
  unique (user_id, kind, slot)
);

create unique index ai_briefing_one_active on ai_briefing_job(user_id) where status in ('queued', 'running');
create index ai_briefing_recent on ai_briefing(user_id, created_at desc);
create index ai_briefing_job_recent on ai_briefing_job(user_id, created_at desc);

alter table ai_briefing enable row level security;
alter table ai_briefing_state enable row level security;
alter table ai_briefing_job enable row level security;

revoke all on ai_briefing, ai_briefing_state, ai_briefing_job from public, anon, authenticated;
grant all on ai_briefing, ai_briefing_state, ai_briefing_job to service_role;

create policy briefing_own on ai_briefing for select to authenticated using (
  user_id = (select auth.uid()) and tenant_id = (select auth_tenant_id())
  and (select auth_has_permission('ai.assistant.use'))
);
create policy briefing_state_own on ai_briefing_state for select to authenticated using (
  user_id = (select auth.uid()) and tenant_id = (select auth_tenant_id())
  and (select auth_has_permission('ai.assistant.use'))
);
create policy briefing_job_own on ai_briefing_job for select to authenticated using (
  user_id = (select auth.uid()) and tenant_id = (select auth_tenant_id())
  and (select auth_has_permission('ai.assistant.use'))
);

create function hermes_enqueue(target uuid, job_kind text, job_slot timestamptz, next_slot timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare member profile; existing uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(target::text, 0));
  select * into member from profile where id = target and status = 'active' and (role = 'owner' or 'ai.assistant.use' = any(permissions));
  if member.id is null then raise exception 'forbidden'; end if;
  insert into ai_briefing_state(user_id, tenant_id, next_at) values (target, member.tenant_id, next_slot)
    on conflict (user_id) do nothing;
  select id into existing from ai_briefing_job where user_id = target and status in ('queued', 'running') limit 1;
  if existing is not null then return existing; end if;
  if job_kind = 'manual' then
    select id into existing from ai_briefing_job where user_id = target and created_at > now() - interval '60 seconds' order by created_at desc limit 1;
    if existing is not null then return existing; end if;
  end if;
  insert into ai_briefing_job(tenant_id, user_id, kind, slot)
    values(member.tenant_id, target, job_kind, job_slot)
    on conflict(user_id, kind, slot) do update set slot = excluded.slot returning id into existing;
  return existing;
end $$;

create function hermes_claim(target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare job ai_briefing_job;
begin
  perform pg_advisory_xact_lock(hashtextextended(target::text, 0));
  update ai_briefing_job set status = case when attempts >= 4 then 'failed' else 'queued' end,
    error_code = 'worker_timeout', token = null, lease_until = null, available_at = now(),
    finished_at = case when attempts >= 4 then now() else null end
    where user_id = target and status = 'running' and lease_until < now();
  if not exists(select 1 from profile where id = target and status = 'active' and (role = 'owner' or 'ai.assistant.use' = any(permissions))) then
    update ai_briefing_job set status = 'cancelled', token = null, finished_at = now() where user_id = target and status in ('queued', 'running');
    return null;
  end if;
  select * into job from ai_briefing_job where user_id = target and status = 'queued' and available_at <= now()
    order by created_at for update skip locked limit 1;
  if job.id is null then return null; end if;
  update ai_briefing_job set status = 'running', token = gen_random_uuid(), lease_until = now() + interval '5 minutes',
    attempts = attempts + 1, model_reserved = false, snapshot = null, input_hash = null, error_code = null
    where id = job.id returning * into job;
  return to_jsonb(job);
end $$;

create function hermes_reserve(job_id uuid, lease_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare job ai_briefing_job; used integer;
begin
  select * into job from ai_briefing_job where id = job_id and token = lease_token and status = 'running' and lease_until > now() for update;
  if job.id is null or job.model_reserved then return false; end if;
  update ai_briefing_state set
    call_count = case when call_date = (now() at time zone 'Asia/Seoul')::date then call_count + 1 else 1 end,
    call_date = (now() at time zone 'Asia/Seoul')::date
    where user_id = job.user_id and (call_date is distinct from (now() at time zone 'Asia/Seoul')::date or call_count < 60)
    returning call_count into used;
  if used is null then return false; end if;
  update ai_briefing_job set model_reserved = true where id = job_id;
  return true;
end $$;

create function hermes_finish(job_id uuid, lease_token uuid, output jsonb, failure text, next_slot timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare job ai_briefing_job; briefing_id uuid;
begin
  select * into job from ai_briefing_job where id = job_id and token = lease_token and status = 'running' and lease_until > now() for update;
  if job.id is null then return false; end if;
  if not exists(select 1 from profile where id = job.user_id and tenant_id = job.tenant_id and status = 'active' and (role = 'owner' or 'ai.assistant.use' = any(permissions))) then
    update ai_briefing_job set status = 'cancelled', token = null, finished_at = now() where id = job_id;
    return false;
  end if;
  if failure is not null then
    update ai_briefing_job set
      status = case when attempts < 4 and failure <> 'quota' then 'queued' else 'failed' end,
      available_at = now() + case attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' else interval '15 minutes' end,
      error_code = failure, token = null, lease_until = null,
      finished_at = case when attempts >= 4 or failure = 'quota' then now() else null end
      where id = job_id;
    if failure = 'quota' then
      update ai_briefing_state set checked_at = now(), next_at = next_slot where user_id = job.user_id;
    end if;
    return true;
  end if;
  if job.snapshot is null or job.input_hash is null then raise exception 'missing_snapshot'; end if;
  if output is not null then
    insert into ai_briefing(tenant_id, user_id, kind, result, snapshot, input_hash)
      values(job.tenant_id, job.user_id, job.kind, output, job.snapshot, job.input_hash) returning id into briefing_id;
  end if;
  update ai_briefing_state set snapshot = job.snapshot, input_hash = job.input_hash,
    latest_id = coalesce(briefing_id, latest_id), checked_at = now(), next_at = next_slot where user_id = job.user_id;
  update ai_briefing_job set status = 'succeeded', finished_at = now(), token = null, lease_until = null, error_code = null where id = job_id;
  return true;
end $$;

revoke all on function hermes_enqueue(uuid,text,timestamptz,timestamptz), hermes_claim(uuid), hermes_reserve(uuid,uuid), hermes_finish(uuid,uuid,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function hermes_enqueue(uuid,text,timestamptz,timestamptz), hermes_claim(uuid), hermes_reserve(uuid,uuid), hermes_finish(uuid,uuid,jsonb,text,timestamptz) to service_role;
