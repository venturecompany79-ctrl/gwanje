-- =============================================================
-- 통합 관제 담당 컨설턴트 + 개인 AI 비서 저장소
-- =============================================================

-- -------------------------------------------------------------
-- 1. AI 비서 권한 키
-- -------------------------------------------------------------
alter table profile
  drop constraint if exists profile_permissions_check;

alter table profile
  alter column permissions set default array[
    'companies.read',
    'companies.write',
    'tasks.read',
    'tasks.write',
    'campaigns.read',
    'campaigns.write',
    'notifications.read',
    'settings.categories.write',
    'settings.rules.write',
    'settings.drive.write',
    'ai.assistant.use',
    'billing.manage'
  ]::text[];

-- 새 기능은 활성 여부와 관계없이 역할 프리셋(owner/manager/member)에 맞춰
-- 부여한다. viewer와 향후 명시적으로 회수된 사용자는 이 마이그레이션 이후
-- 설정 화면에서 별도로 관리한다.
update profile
set permissions = array_append(permissions, 'ai.assistant.use')
where role in ('owner', 'manager', 'member')
  and not ('ai.assistant.use' = any (permissions));

alter table profile
  add constraint profile_permissions_check
    check (permissions <@ array[
      'companies.read',
      'companies.write',
      'tasks.read',
      'tasks.write',
      'campaigns.read',
      'campaigns.write',
      'notifications.read',
      'settings.categories.write',
      'settings.rules.write',
      'settings.drive.write',
      'ai.assistant.use',
      'billing.manage'
    ]::text[]);

create or replace function app_permission_keys()
returns text[]
language sql immutable
as $$
  select array[
    'companies.read',
    'companies.write',
    'tasks.read',
    'tasks.write',
    'campaigns.read',
    'campaigns.write',
    'notifications.read',
    'settings.categories.write',
    'settings.rules.write',
    'settings.drive.write',
    'ai.assistant.use',
    'billing.manage'
  ]::text[];
$$;

-- -------------------------------------------------------------
-- 2. 기업 주담당 컨설턴트
-- -------------------------------------------------------------
-- 복합 FK가 tenant_id까지 함께 검증할 수 있도록 profile에 tenant-safe
-- candidate key를 둔다. id 자체가 PK이므로 데이터 의미는 바뀌지 않는다.
create unique index if not exists profile_tenant_id_id_uniq
  on profile (tenant_id, id);

alter table company
  add column if not exists primary_consultant_id uuid;

-- 각 tenant에서 가장 오래된 활성 owner를 우선하고, 없으면 가장 오래된
-- 활성 profile을 선택한다. created_at 동률은 id로 결정해 백필을 재현 가능하게 한다.
with tenant_candidate as (
  select distinct on (p.tenant_id)
    p.tenant_id,
    p.id
  from profile p
  where p.status = 'active'
  order by
    p.tenant_id,
    case when p.role = 'owner' then 0 else 1 end,
    p.created_at,
    p.id
)
update company co
set primary_consultant_id = candidate.id
from tenant_candidate candidate
where co.tenant_id = candidate.tenant_id
  and co.primary_consultant_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_primary_consultant_tenant_fk'
      and conrelid = 'company'::regclass
  ) then
    alter table company
      add constraint company_primary_consultant_tenant_fk
      foreign key (tenant_id, primary_consultant_id)
      references profile (tenant_id, id)
      on delete set null (primary_consultant_id);
  end if;
end $$;

create index if not exists idx_company_primary_consultant
  on company (tenant_id, primary_consultant_id)
  where primary_consultant_id is not null;

comment on column company.primary_consultant_id is
  '기업 관제의 주담당 컨설턴트. 비활성화·이관 중에는 null(미배정)을 허용한다.';

-- deadline_item의 기존 열 순서를 유지하고 주담당자를 마지막 열에 추가한다.
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
      and t.stage <> 'result'
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
  and t.stage <> 'result'
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

-- -------------------------------------------------------------
-- 3. 개인 AI 대화, 메시지, 승인 작업
-- -------------------------------------------------------------
create table ai_conversation (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  owner_id        uuid not null,
  title           text not null default '새 대화',
  scope           jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_conversation_scope_object_check
    check (jsonb_typeof(scope) = 'object'),
  constraint ai_conversation_owner_tenant_fk
    foreign key (tenant_id, owner_id)
    references profile (tenant_id, id)
    on delete cascade,
  constraint ai_conversation_tenant_id_id_uniq
    unique (tenant_id, id)
);

create table ai_message (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  conversation_id uuid not null,
  author_id       uuid,
  role            text not null,
  content         text not null,
  sources         jsonb not null default '[]'::jsonb,
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  total_tokens    integer,
  latency_ms      integer,
  created_at      timestamptz not null default now(),
  constraint ai_message_role_check
    check (role in ('user', 'assistant')),
  constraint ai_message_sources_array_check
    check (jsonb_typeof(sources) = 'array'),
  constraint ai_message_input_tokens_check
    check (input_tokens is null or input_tokens >= 0),
  constraint ai_message_output_tokens_check
    check (output_tokens is null or output_tokens >= 0),
  constraint ai_message_total_tokens_check
    check (total_tokens is null or total_tokens >= 0),
  constraint ai_message_latency_ms_check
    check (latency_ms is null or latency_ms >= 0),
  constraint ai_message_conversation_tenant_fk
    foreign key (tenant_id, conversation_id)
    references ai_conversation (tenant_id, id)
    on delete cascade,
  constraint ai_message_author_tenant_fk
    foreign key (tenant_id, author_id)
    references profile (tenant_id, id)
    on delete set null (author_id)
);

create table ai_action (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  conversation_id uuid,
  action_type     text not null,
  status          text not null default 'pending',
  payload         jsonb not null default '{}'::jsonb,
  preview         jsonb not null default '{}'::jsonb,
  target_type     text,
  target_id       uuid,
  requested_by    uuid not null,
  decided_by      uuid,
  decided_at      timestamptz,
  executed_at     timestamptz,
  result          jsonb,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_action_type_check
    check (action_type in (
      'task.create',
      'task.update',
      'company.memo_append',
      'campaign.draft'
    )),
  constraint ai_action_status_check
    check (status in (
      'pending',
      'approved',
      'rejected',
      'executing',
      'executed',
      'failed'
    )),
  constraint ai_action_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint ai_action_preview_object_check
    check (jsonb_typeof(preview) = 'object'),
  constraint ai_action_result_object_check
    check (result is null or jsonb_typeof(result) = 'object'),
  constraint ai_action_conversation_tenant_fk
    foreign key (tenant_id, conversation_id)
    references ai_conversation (tenant_id, id)
    on delete set null (conversation_id),
  constraint ai_action_requester_tenant_fk
    foreign key (tenant_id, requested_by)
    references profile (tenant_id, id)
    on delete restrict,
  constraint ai_action_decider_tenant_fk
    foreign key (tenant_id, decided_by)
    references profile (tenant_id, id)
    on delete set null (decided_by)
);

create index idx_ai_conversation_owner_recent
  on ai_conversation (owner_id, last_message_at desc);
create index idx_ai_message_conversation_created
  on ai_message (conversation_id, created_at, id);
create index idx_ai_message_author
  on ai_message (author_id)
  where author_id is not null;
create index idx_ai_action_requester_created
  on ai_action (requested_by, created_at desc);
create index idx_ai_action_tenant_status_created
  on ai_action (tenant_id, status, created_at desc);
create index idx_ai_action_conversation
  on ai_action (conversation_id)
  where conversation_id is not null;
create index idx_ai_action_decider
  on ai_action (decided_by)
  where decided_by is not null;

create trigger ai_conversation_set_updated_at
  before update on ai_conversation
  for each row execute function set_updated_at();
create trigger ai_action_set_updated_at
  before update on ai_action
  for each row execute function set_updated_at();

alter table ai_conversation enable row level security;
alter table ai_message enable row level security;
alter table ai_action enable row level security;

-- 대화 원문은 작성자 본인만 접근한다. owner/manager도 타인의 대화는 볼 수 없다.
create policy "ai_conversation: 본인 조회" on ai_conversation
  for select to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and owner_id = (select auth.uid())
    and (select auth_has_permission('ai.assistant.use'))
  );

create policy "ai_conversation: 본인 생성" on ai_conversation
  for insert to authenticated
  with check (
    tenant_id = (select auth_tenant_id())
    and owner_id = (select auth.uid())
    and (select auth_has_permission('ai.assistant.use'))
  );

create policy "ai_conversation: 본인 수정" on ai_conversation
  for update to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and owner_id = (select auth.uid())
    and (select auth_has_permission('ai.assistant.use'))
  )
  with check (
    tenant_id = (select auth_tenant_id())
    and owner_id = (select auth.uid())
    and (select auth_has_permission('ai.assistant.use'))
  );

create policy "ai_conversation: 본인 삭제" on ai_conversation
  for delete to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and owner_id = (select auth.uid())
    and (select auth_has_permission('ai.assistant.use'))
  );

create policy "ai_message: 본인 조회" on ai_message
  for select to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('ai.assistant.use'))
    and exists (
      select 1
      from ai_conversation c
      where c.id = ai_message.conversation_id
        and c.tenant_id = ai_message.tenant_id
        and c.owner_id = (select auth.uid())
    )
  );

-- authenticated 직접 입력은 사용자 발화만 허용한다. assistant 발화와 모델
-- 메타데이터는 검증된 서버 경로(service_role)가 기록한다.
create policy "ai_message: 본인 사용자 발화 생성" on ai_message
  for insert to authenticated
  with check (
    tenant_id = (select auth_tenant_id())
    and author_id = (select auth.uid())
    and role = 'user'
    and (select auth_has_permission('ai.assistant.use'))
    and exists (
      select 1
      from ai_conversation c
      where c.id = ai_message.conversation_id
        and c.tenant_id = ai_message.tenant_id
        and c.owner_id = (select auth.uid())
    )
  );

-- payload/preview/result 원문을 포함하는 행은 요청자 본인만 조회한다.
create policy "ai_action: 요청자 조회" on ai_action
  for select to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and requested_by = (select auth.uid())
    and (select auth_has_permission('ai.assistant.use'))
  );

create policy "ai_action: 요청자 제안 생성" on ai_action
  for insert to authenticated
  with check (
    tenant_id = (select auth_tenant_id())
    and requested_by = (select auth.uid())
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and executed_at is null
    and result is null
    and error_message is null
    and (select auth_has_permission('ai.assistant.use'))
    and (
      conversation_id is null
      or exists (
        select 1
        from ai_conversation c
        where c.id = ai_action.conversation_id
          and c.tenant_id = ai_action.tenant_id
          and c.owner_id = (select auth.uid())
      )
    )
  );

-- owner/manager의 팀 감사 화면은 이 마스킹된 뷰만 사용한다. 기본 security
-- definer 동작으로 base-table RLS를 우회하되, 뷰 자체에서 호출자의 tenant/role을
-- 고정하고 security_barrier로 외부 조건의 predicate pushdown을 차단한다.
create view ai_action_audit
with (security_barrier = on)
as
select
  a.id,
  a.action_type,
  a.status,
  a.target_type,
  a.target_id,
  a.requested_by,
  a.decided_by,
  a.decided_at,
  a.executed_at,
  a.result ->> 'summary' as result_summary,
  a.error_message,
  a.created_at,
  a.updated_at
from ai_action a
where a.tenant_id = auth_tenant_id()
  and auth_member_role() in ('owner', 'manager');

comment on view ai_action_audit is
  'owner/manager용 AI 실행 감사 뷰. 대화, payload, preview, 전체 result는 노출하지 않는다.';

-- 초기 스키마의 default privileges가 새 테이블에 authenticated 전체 DML을
-- 부여하므로 먼저 회수한 뒤 필요한 열/명령만 다시 연다.
revoke all on ai_conversation, ai_message, ai_action, ai_action_audit
  from public, anon, authenticated;

grant select, delete on ai_conversation to authenticated;
grant insert (tenant_id, owner_id, title, scope)
  on ai_conversation to authenticated;
grant update (title, scope)
  on ai_conversation to authenticated;

grant select on ai_message to authenticated;
grant insert (tenant_id, conversation_id, author_id, role, content)
  on ai_message to authenticated;

grant select on ai_action to authenticated;
grant insert (
  tenant_id,
  conversation_id,
  action_type,
  payload,
  preview,
  target_type,
  target_id,
  requested_by
) on ai_action to authenticated;

grant select on ai_action_audit to authenticated;

comment on table ai_conversation is '컨설턴트별 개인 AI 비서 대화';
comment on table ai_message is 'AI 비서 대화 메시지와 모델 사용 메타데이터';
comment on table ai_action is '사용자 승인 후 서버가 실행하는 AI 제안 작업과 감사 기록';
