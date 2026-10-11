create table agent_trigger_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  source_key text not null check (source_key ~ '^(task|credential|ip_deadline|schedule):[0-9a-f-]{36}$'),
  trigger text not null check (trigger in ('d30', 'd7', 'overdue')),
  agent_task_id uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, agent_task_id) references agent_task(tenant_id, id) on delete set null (agent_task_id),
  unique (tenant_id, source_key, trigger)
);
create index agent_trigger_log_day on agent_trigger_log(tenant_id, created_at);
create index agent_trigger_log_task on agent_trigger_log(tenant_id, agent_task_id);

create table agent_trigger_exclusion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  company_id uuid,
  source_key text check (source_key ~ '^(task|credential|ip_deadline|schedule):[0-9a-f-]{36}$'),
  reason text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, company_id) references company(tenant_id, id) on delete cascade,
  check (num_nonnulls(company_id, source_key) = 1)
);
create index agent_trigger_exclusion_company on agent_trigger_exclusion(tenant_id, company_id);
create index agent_trigger_exclusion_source on agent_trigger_exclusion(tenant_id, source_key);

alter table agent_trigger_log enable row level security;
alter table agent_trigger_exclusion enable row level security;
revoke all on agent_trigger_log, agent_trigger_exclusion from public, anon, authenticated;
grant select, insert, update, delete on agent_trigger_log, agent_trigger_exclusion to authenticated;
grant all on agent_trigger_log, agent_trigger_exclusion to service_role;
create policy agent_trigger_log_owner on agent_trigger_log for all to authenticated
  using (tenant_id = (select auth_tenant_id()) and (select auth_is_owner()))
  with check (tenant_id = (select auth_tenant_id()) and (select auth_is_owner()));
create policy agent_trigger_exclusion_owner on agent_trigger_exclusion for all to authenticated
  using (tenant_id = (select auth_tenant_id()) and (select auth_is_owner()))
  with check (tenant_id = (select auth_tenant_id()) and (select auth_is_owner()));

create function agent_trigger_tick(creator uuid, daily_limit integer default 5, dry_run boolean default true, contexts jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  member profile; candidate record; task_id uuid; item_key text; reason text; question text; task_body text;
  used integer; started integer := 0; excluded integer := 0; already_run integer := 0; limited integer := 0;
  targets jsonb := '[]'::jsonb;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if daily_limit is null or daily_limit < 0 or daily_limit > 100 or dry_run is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  select * into member from profile where id = creator and status = 'active'
    and (role = 'owner' or 'ai.assistant.use' = any(permissions));
  if member.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not dry_run then perform pg_advisory_xact_lock(hashtextextended('agent_trigger:' || member.tenant_id::text, 0)); end if;
  select count(*) into used from agent_trigger_log
    where tenant_id = member.tenant_id and created_at >= day_start and created_at < day_start + interval '1 day';
  for candidate in
    select deadlines.*, case when days_left < 0 then 'overdue' when days_left <= 7 then 'd7' else 'd30' end as trigger_kind
    from deadline_item deadlines
    where tenant_id = member.tenant_id
      and ((source in ('task', 'credential', 'ip_deadline') and days_left between -7 and -1)
        or ((source in ('task', 'credential', 'ip_deadline')
          or (source = 'schedule' and status in ('deadline', 'renewal', 'expiry')))
          and (days_left between 1 and 7 or days_left between 21 and 30)))
    order by case when days_left < 0 then 0 when days_left <= 7 then 1 else 2 end, due_date, source, id
  loop
    item_key := candidate.source || ':' || candidate.id::text;
    task_id := null;
    if exists(select 1 from agent_trigger_exclusion exclusion where exclusion.tenant_id = member.tenant_id
      and (exclusion.company_id = candidate.company_id or exclusion.source_key = item_key)) then
      reason := 'excluded'; excluded := excluded + 1;
    elsif exists(select 1 from agent_trigger_log log where log.tenant_id = member.tenant_id
      and log.source_key = item_key and log.trigger = candidate.trigger_kind) then
      reason := 'already_run'; already_run := already_run + 1;
    elsif used >= daily_limit then
      reason := 'daily_limit'; limited := limited + 1;
    else
      reason := case when dry_run then 'ready' else 'started' end;
      used := used + 1;
      if not dry_run then
        task_body := contexts->>item_key;
        if task_body is null or char_length(task_body) > 6000 then raise exception 'invalid_request' using errcode = '22023'; end if;
        question := case candidate.trigger_kind
          when 'd30' then '마감까지 준비할 항목, 부족한 자료, 일정 계획을 검토해줘'
          when 'd7' then '남은 기간 안에 끝내기 위해 지금 확인할 위험과 우선 행동을 정리해줘'
          else '기한이 지났다. 영향, 수습 방안, 관계자에게 알릴 내용을 정리해줘' end;
        task_id := agent_enqueue(creator, 'app',
          '[자동·' || case candidate.trigger_kind when 'd30' then 'D-30' when 'd7' then 'D-7' else '기한초과' end || '] '
          || coalesce(candidate.company_name, '미입력') || ' · ' || candidate.title,
          question || E'\n\n' || task_body, candidate.company_id);
        insert into agent_trigger_log(tenant_id, source_key, trigger, agent_task_id)
          values(member.tenant_id, item_key, candidate.trigger_kind, task_id);
        started := started + 1;
      end if;
    end if;
    targets := targets || jsonb_build_array(jsonb_build_object(
      'tenantId', member.tenant_id, 'source', candidate.source, 'sourceId', candidate.id, 'sourceKey', item_key,
      'companyId', candidate.company_id, 'company', candidate.company_name, 'title', candidate.title,
      'trigger', candidate.trigger_kind, 'daysLeft', candidate.days_left, 'wouldStart', reason in ('ready', 'started'),
      'reason', reason, 'taskId', task_id));
  end loop;
  return jsonb_build_object('started', started, 'skipped', jsonb_build_object('excluded', excluded, 'already_run', already_run, 'daily_limit', limited), 'targets', targets);
end $$;
revoke all on function agent_trigger_tick(uuid,integer,boolean,jsonb) from public, anon, authenticated;
grant execute on function agent_trigger_tick(uuid,integer,boolean,jsonb) to service_role;
