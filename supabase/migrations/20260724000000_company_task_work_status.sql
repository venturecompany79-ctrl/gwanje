-- =============================================================
-- 기업 관제표: Task 과정 단계(stage)와 업무상태(work_status) 분리
-- =============================================================

do $$
begin
  create type task_work_status as enum (
    'planned',
    'in_progress',
    'waiting',
    'on_hold',
    'completed'
  );
exception
  when duplicate_object then null;
end $$;

alter table task
  add column if not exists work_status task_work_status;

-- 기존 UI에서 result를 완료로 취급했으므로 의미를 보존해 이관한다.
update task
set work_status = case
  when stage = 'result' then 'completed'::task_work_status
  else 'in_progress'::task_work_status
end
where work_status is null;

alter table task
  alter column work_status set default 'planned'::task_work_status,
  alter column work_status set not null;

comment on column task.work_status is
  '업무 실행상태. 과정 단계(stage)와 독립적으로 예정/진행중/대기/보류/완료를 표현한다.';

create index if not exists idx_task_work_status_due
  on task (tenant_id, work_status, due_date);

-- 모든 Task 갱신 경로에서 낙관적 동시성 기준이 일관되도록 updated_at을 자동 갱신한다.
drop trigger if exists task_set_updated_at on task;
create trigger task_set_updated_at
  before update on task
  for each row execute function set_updated_at();

-- 단계·업무상태 변경이력. 되돌리기도 새 변경행으로 남는다.
create table if not exists task_state_change (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenant (id) on delete cascade,
  task_id               uuid not null references task (id) on delete cascade,
  changed_by            uuid references profile (id) on delete set null,
  previous_stage        task_stage,
  next_stage            task_stage,
  previous_work_status  task_work_status,
  next_work_status      task_work_status,
  created_at            timestamptz not null default now(),
  constraint task_state_change_has_change check (
    previous_stage is distinct from next_stage
    or previous_work_status is distinct from next_work_status
  )
);

create index if not exists idx_task_state_change_task
  on task_state_change (task_id, created_at desc);
create index if not exists idx_task_state_change_tenant
  on task_state_change (tenant_id, created_at desc);

alter table task_state_change enable row level security;

drop policy if exists "task_state_change: 조회" on task_state_change;
create policy "task_state_change: 조회" on task_state_change
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.read')
  );

grant select on task_state_change to authenticated;

create or replace function record_task_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stage is distinct from new.stage
     or old.work_status is distinct from new.work_status then
    insert into task_state_change (
      tenant_id,
      task_id,
      changed_by,
      previous_stage,
      next_stage,
      previous_work_status,
      next_work_status
    )
    values (
      new.tenant_id,
      new.id,
      auth.uid(),
      old.stage,
      new.stage,
      old.work_status,
      new.work_status
    );
  end if;
  return new;
end;
$$;

revoke all on function record_task_state_change() from public;

drop trigger if exists task_record_state_change on task;
create trigger task_record_state_change
  after update of stage, work_status on task
  for each row execute function record_task_state_change();

-- 완료 상태만 관제 마감에서 제외한다. 결과 단계라도 대기/진행중이면 계속 관제한다.
create or replace view deadline_item
with (security_invoker = on)
as
select
  'credential'::text                  as source,
  c.id                                as id,
  c.tenant_id                         as tenant_id,
  c.company_id                        as company_id,
  co.name                             as company_name,
  c.type || ' 만료'                   as title,
  c.category_id                       as category_id,
  cat.name                            as category_name,
  c.expires_date                      as due_date,
  (c.expires_date - (now() at time zone 'Asia/Seoul')::date) as days_left,
  case
    when c.expires_date < (now() at time zone 'Asia/Seoul')::date then 'expired'
    when c.expires_date - (now() at time zone 'Asia/Seoul')::date <= c.renew_lead_days then 'expiring'
    else 'valid'
  end                                 as status,
  co.primary_consultant_id            as primary_consultant_id
from credential c
join company co on co.id = c.company_id
left join category cat on cat.id = c.category_id
where c.expires_date is not null
  and co.status = 'active'
  and not exists (
    select 1
    from task t
    where t.source_credential_id = c.id
      and t.due_date is not null
      and t.work_status <> 'completed'
  )

union all

select
  'task',
  t.id,
  t.tenant_id,
  t.company_id,
  co.name,
  t.title,
  t.category_id,
  cat.name,
  t.due_date,
  (t.due_date - (now() at time zone 'Asia/Seoul')::date),
  t.stage::text,
  co.primary_consultant_id
from task t
join company co on co.id = t.company_id
left join category cat on cat.id = t.category_id
where t.due_date is not null
  and t.work_status <> 'completed'
  and co.status = 'active'

union all

select
  'schedule',
  s.id,
  s.tenant_id,
  s.company_id,
  co.name,
  s.title,
  null,
  null,
  s.date,
  (s.date - (now() at time zone 'Asia/Seoul')::date),
  s.type::text,
  co.primary_consultant_id
from schedule s
left join company co on co.id = s.company_id
where s.date >= (now() at time zone 'Asia/Seoul')::date - interval '30 days'
  and (co.id is null or co.status = 'active')

union all

select
  'ip_deadline',
  d.id,
  d.tenant_id,
  d.company_id,
  co.name,
  r.title || ' · ' || d.title,
  null,
  '지식재산권',
  d.due_date,
  (d.due_date - (now() at time zone 'Asia/Seoul')::date),
  d.type::text,
  co.primary_consultant_id
from ip_deadline d
join ip_right r on r.id = d.ip_right_id
join company co on co.id = d.company_id
where d.is_done = false
  and co.status = 'active';

grant select on deadline_item to authenticated;

-- 기업 관제표 집계: 요청된 기업만 한 번에 계산한다.
drop function if exists get_company_list_stats(uuid[], date, int);

create function get_company_list_stats(
  p_company_ids uuid[],
  p_today date,
  p_upcoming_window_days int default 365
)
returns table (
  company_id uuid,
  credential_types text[],
  nearest_days_left int,
  upcoming_count bigint,
  upcoming_items jsonb,
  expired_count bigint,
  active_task_count bigint,
  overdue_task_count bigint,
  due7_task_count bigint,
  unassigned_task_count bigint,
  planned_task_count bigint,
  in_progress_task_count bigint,
  waiting_task_count bigint,
  on_hold_task_count bigint,
  completed_task_count bigint,
  diagnosis_task_count bigint,
  proposal_task_count bigint,
  application_task_count bigint,
  result_task_count bigint,
  priority_task jsonb,
  latest_task_updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested_companies as (
    select c.id
    from company c
    where c.id = any(coalesce(p_company_ids, '{}'::uuid[]))
  ),
  credential_stats as (
    select
      c.company_id,
      array_agg(c.type order by c.created_at, c.id) as credential_types
    from credential c
    join requested_companies requested on requested.id = c.company_id
    group by c.company_id
  ),
  deadline_rows as (
    select
      d.company_id,
      d.id,
      d.source,
      d.title,
      d.due_date,
      d.days_left,
      (
        d.due_date >= p_today
        and d.days_left >= 0
        and d.days_left <= greatest(0, coalesce(p_upcoming_window_days, 365))
      ) as is_upcoming,
      (d.source = 'credential' and d.due_date < p_today) as is_expired
    from deadline_item d
    join requested_companies requested on requested.id = d.company_id
  ),
  ranked_deadlines as (
    select
      deadlines.*,
      row_number() over (
        partition by deadlines.company_id, deadlines.is_upcoming
        order by deadlines.due_date, deadlines.title, deadlines.id
      ) as detail_rank
    from deadline_rows deadlines
    where deadlines.is_upcoming or deadlines.is_expired
  ),
  deadline_stats as (
    select
      deadlines.company_id,
      min(deadlines.days_left) filter (where deadlines.is_upcoming)
        as nearest_days_left,
      count(*) filter (where deadlines.is_upcoming)::bigint
        as upcoming_count,
      jsonb_agg(
        jsonb_build_object(
          'source', deadlines.source,
          'title', coalesce(deadlines.title, '항목'),
          'daysLeft', deadlines.days_left
        )
        order by deadlines.due_date, deadlines.title, deadlines.id
      ) filter (
        where deadlines.is_upcoming and deadlines.detail_rank <= 10
      ) as upcoming_items,
      count(*) filter (where deadlines.is_expired)::bigint as expired_count
    from ranked_deadlines deadlines
    group by deadlines.company_id
  ),
  ranked_tasks as (
    select
      t.*,
      cat.name as category_name,
      assignee.name as assignee_name,
      row_number() over (
        partition by t.company_id
        order by
          (t.work_status = 'completed') asc,
          (t.due_date is not null and t.due_date < p_today) desc,
          (t.work_status = 'on_hold') desc,
          (t.due_date is not null and t.due_date between p_today and p_today + 7) desc,
          (t.assignee_id is null) desc,
          (t.work_status = 'waiting') desc,
          t.due_date asc nulls last,
          t.updated_at desc,
          t.id
      ) as priority_rank
    from task t
    join requested_companies requested on requested.id = t.company_id
    left join category cat on cat.id = t.category_id
    left join profile assignee on assignee.id = t.assignee_id
  ),
  task_stats as (
    select
      tasks.company_id,
      count(*) filter (where tasks.work_status <> 'completed')::bigint
        as active_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed'
          and tasks.due_date is not null
          and tasks.due_date < p_today
      )::bigint as overdue_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed'
          and tasks.due_date between p_today and p_today + 7
      )::bigint as due7_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed'
          and tasks.assignee_id is null
      )::bigint as unassigned_task_count,
      count(*) filter (where tasks.work_status = 'planned')::bigint
        as planned_task_count,
      count(*) filter (where tasks.work_status = 'in_progress')::bigint
        as in_progress_task_count,
      count(*) filter (where tasks.work_status = 'waiting')::bigint
        as waiting_task_count,
      count(*) filter (where tasks.work_status = 'on_hold')::bigint
        as on_hold_task_count,
      count(*) filter (where tasks.work_status = 'completed')::bigint
        as completed_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed' and tasks.stage = 'diagnosis'
      )::bigint as diagnosis_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed' and tasks.stage = 'proposal'
      )::bigint as proposal_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed' and tasks.stage = 'application'
      )::bigint as application_task_count,
      count(*) filter (
        where tasks.work_status <> 'completed' and tasks.stage = 'result'
      )::bigint as result_task_count,
      max(tasks.updated_at) as latest_task_updated_at,
      max(
        jsonb_build_object(
          'id', tasks.id,
          'title', tasks.title,
          'stage', tasks.stage,
          'workStatus', tasks.work_status,
          'dueDate', tasks.due_date,
          'daysLeft', case
            when tasks.due_date is null then null
            else tasks.due_date - p_today
          end,
          'assigneeId', tasks.assignee_id,
          'assigneeName', tasks.assignee_name,
          'categoryId', tasks.category_id,
          'categoryName', tasks.category_name,
          'updatedAt', tasks.updated_at
        )::text
      ) filter (
        where tasks.priority_rank = 1
          and tasks.work_status <> 'completed'
      )::jsonb as priority_task
    from ranked_tasks tasks
    group by tasks.company_id
  )
  select
    requested.id as company_id,
    coalesce(credentials.credential_types, '{}'::text[]) as credential_types,
    deadlines.nearest_days_left,
    coalesce(deadlines.upcoming_count, 0::bigint) as upcoming_count,
    coalesce(deadlines.upcoming_items, '[]'::jsonb) as upcoming_items,
    coalesce(deadlines.expired_count, 0::bigint) as expired_count,
    coalesce(tasks.active_task_count, 0::bigint),
    coalesce(tasks.overdue_task_count, 0::bigint),
    coalesce(tasks.due7_task_count, 0::bigint),
    coalesce(tasks.unassigned_task_count, 0::bigint),
    coalesce(tasks.planned_task_count, 0::bigint),
    coalesce(tasks.in_progress_task_count, 0::bigint),
    coalesce(tasks.waiting_task_count, 0::bigint),
    coalesce(tasks.on_hold_task_count, 0::bigint),
    coalesce(tasks.completed_task_count, 0::bigint),
    coalesce(tasks.diagnosis_task_count, 0::bigint),
    coalesce(tasks.proposal_task_count, 0::bigint),
    coalesce(tasks.application_task_count, 0::bigint),
    coalesce(tasks.result_task_count, 0::bigint),
    tasks.priority_task,
    tasks.latest_task_updated_at
  from requested_companies requested
  left join credential_stats credentials on credentials.company_id = requested.id
  left join deadline_stats deadlines on deadlines.company_id = requested.id
  left join task_stats tasks on tasks.company_id = requested.id;
$$;

revoke all on function get_company_list_stats(uuid[], date, int)
  from public, anon, authenticated;
grant execute on function get_company_list_stats(uuid[], date, int)
  to authenticated;
