-- =============================================================
-- 기업 이력 기반 정부지원사업 매칭 워크스페이스
-- - 기업별 매칭 프로필/근거 소스
-- - 기업-공고 매칭 결과 캐시
-- - 관심/제외 검토 상태
-- - 공고에서 전환한 Task 명시 연결
-- =============================================================

do $$
begin
  create type company_program_review_decision as enum ('saved', 'excluded');
exception when duplicate_object then null;
end $$;

alter table gov_program
  add column if not exists summary text,
  add column if not exists support_amount text,
  add column if not exists eligibility jsonb not null default '{}'::jsonb,
  add column if not exists analysis_version int not null default 1,
  add column if not exists analyzed_at timestamptz;

create table if not exists company_match_profile (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenant (id) on delete cascade,
  company_id          uuid not null references company (id) on delete cascade,
  status              text not null default 'ready'
    check (status in ('ready', 'stale', 'failed')),
  profile_json        jsonb not null default '{}'::jsonb,
  completeness        int not null default 0 check (completeness between 0 and 100),
  missing_information jsonb not null default '[]'::jsonb,
  source_counts       jsonb not null default '{}'::jsonb,
  source_fingerprint  text not null default '',
  model               text,
  last_error          text,
  analyzed_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint company_match_profile_tenant_company_fk
    foreign key (tenant_id, company_id)
    references company (tenant_id, id)
    on delete cascade,
  constraint company_match_profile_company_uniq unique (tenant_id, company_id)
);

create table if not exists company_match_profile_source (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant (id) on delete cascade,
  company_id        uuid not null references company (id) on delete cascade,
  source_kind       text not null
    check (source_kind in ('company', 'credential', 'ip_right', 'task', 'meeting_report', 'document')),
  source_id         text not null,
  label             text not null,
  included          boolean not null default true,
  facts_text        text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'ready', 'failed', 'skipped')),
  extraction_error  text,
  source_updated_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint company_match_profile_source_tenant_company_fk
    foreign key (tenant_id, company_id)
    references company (tenant_id, id)
    on delete cascade,
  constraint company_match_profile_source_uniq
    unique (tenant_id, company_id, source_kind, source_id)
);

create table if not exists company_program_match (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant (id) on delete cascade,
  company_id        uuid not null references company (id) on delete cascade,
  gov_program_id    uuid not null references gov_program (id) on delete cascade,
  profile_id        uuid references company_match_profile (id) on delete set null,
  eligibility       text not null default 'review'
    check (eligibility in ('eligible', 'review', 'ineligible')),
  confidence        text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  score             int not null default 0 check (score between 0 and 100),
  score_breakdown   jsonb not null default '{}'::jsonb,
  reasons           jsonb not null default '[]'::jsonb,
  warnings          jsonb not null default '[]'::jsonb,
  evidence          jsonb not null default '[]'::jsonb,
  profile_version   text not null default '',
  program_synced_at timestamptz not null,
  matched_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint company_program_match_tenant_company_fk
    foreign key (tenant_id, company_id)
    references company (tenant_id, id)
    on delete cascade,
  constraint company_program_match_uniq unique (tenant_id, company_id, gov_program_id)
);

create table if not exists company_gov_program_review (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant (id) on delete cascade,
  company_id     uuid not null references company (id) on delete cascade,
  gov_program_id uuid not null references gov_program (id) on delete cascade,
  decision       company_program_review_decision not null,
  decided_by     uuid references profile (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint company_gov_program_review_tenant_company_fk
    foreign key (tenant_id, company_id)
    references company (tenant_id, id)
    on delete cascade,
  constraint company_gov_program_review_uniq unique (tenant_id, company_id, gov_program_id)
);

alter table task
  add column if not exists source_gov_program_id uuid
  references gov_program (id) on delete set null;

create unique index if not exists task_company_gov_program_uniq
  on task (tenant_id, company_id, source_gov_program_id)
  where source_gov_program_id is not null;

create index if not exists company_match_profile_company_idx
  on company_match_profile (tenant_id, company_id);
create index if not exists company_match_profile_source_company_idx
  on company_match_profile_source (tenant_id, company_id, included);
create index if not exists company_program_match_company_rank_idx
  on company_program_match (tenant_id, company_id, eligibility, score desc);
create index if not exists company_gov_program_review_company_idx
  on company_gov_program_review (tenant_id, company_id, decision);
create index if not exists gov_program_analyzed_at_idx
  on gov_program (analyzed_at);
create unique index if not exists notification_program_match_uniq
  on notification (tenant_id, company_id, ref_table, ref_id)
  where type = 'program_match' and ref_table = 'gov_program';

drop trigger if exists company_match_profile_set_updated_at on company_match_profile;
create trigger company_match_profile_set_updated_at
  before update on company_match_profile
  for each row execute function set_updated_at();

drop trigger if exists company_match_profile_source_set_updated_at on company_match_profile_source;
create trigger company_match_profile_source_set_updated_at
  before update on company_match_profile_source
  for each row execute function set_updated_at();

drop trigger if exists company_program_match_set_updated_at on company_program_match;
create trigger company_program_match_set_updated_at
  before update on company_program_match
  for each row execute function set_updated_at();

drop trigger if exists company_gov_program_review_set_updated_at on company_gov_program_review;
create trigger company_gov_program_review_set_updated_at
  before update on company_gov_program_review
  for each row execute function set_updated_at();

-- 적합도 80점 이상 + 자격 충족 공고는 tenant 알림 설정을 존중해 최초 1회 알린다.
create or replace function notify_high_company_program_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_apply_end date;
begin
  if new.score < 80 or new.eligibility <> 'eligible' then
    return new;
  end if;

  if not exists (
    select 1
    from profile p
    where p.tenant_id = new.tenant_id
      and p.status = 'active'
      and p.notify_match
  ) then
    return new;
  end if;

  if exists (
    select 1
    from company_gov_program_review r
    where r.tenant_id = new.tenant_id
      and r.company_id = new.company_id
      and r.gov_program_id = new.gov_program_id
      and r.decision = 'excluded'
  ) then
    return new;
  end if;

  select gp.title, gp.apply_end
  into v_title, v_apply_end
  from gov_program gp
  where gp.id = new.gov_program_id;

  if v_title is null then
    return new;
  end if;

  insert into notification (
    tenant_id, type, title, body, company_id, ref_table, ref_id, is_urgent
  )
  select
    new.tenant_id,
    'program_match'::notification_type,
    v_title || ' · 맞춤도 ' || new.score::text || '점',
    '등록된 기업정보와 이력에서 높은 적합도가 확인되었습니다.',
    new.company_id,
    'gov_program',
    new.gov_program_id,
    v_apply_end is not null
      and v_apply_end between (now() at time zone 'Asia/Seoul')::date
                          and (now() at time zone 'Asia/Seoul')::date + 7
  on conflict (tenant_id, company_id, ref_table, ref_id)
    where type = 'program_match' and ref_table = 'gov_program'
    do nothing;

  return new;
end;
$$;

revoke all on function notify_high_company_program_match()
  from public, anon, authenticated;

drop trigger if exists company_program_match_notify_high on company_program_match;
create trigger company_program_match_notify_high
  after insert or update of score, eligibility on company_program_match
  for each row execute function notify_high_company_program_match();

-- 기업 원천 데이터가 바뀌면 다음 워크스페이스 진입에서 프로필을 다시 만든다.
create or replace function mark_company_match_profile_stale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_source_kind text;
begin
  if tg_table_name = 'company' then
    if tg_op = 'DELETE' then
      v_company_id := old.id;
    else
      v_company_id := new.id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_company_id := old.company_id;
    else
      v_company_id := new.company_id;
    end if;
  end if;

  update company_match_profile
  set status = 'stale', updated_at = now()
  where company_id = v_company_id;

  if tg_op = 'DELETE' and tg_table_name <> 'company' then
    v_source_kind := case tg_table_name
      when 'credential' then 'credential'
      when 'ip_right' then 'ip_right'
      when 'task' then 'task'
      when 'meeting_report' then 'meeting_report'
      when 'document' then 'document'
      else null
    end;
    if v_source_kind is not null then
      delete from company_match_profile_source
      where company_id = v_company_id
        and source_kind = v_source_kind
        and source_id = old.id::text;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function mark_company_match_profile_stale()
  from public, anon, authenticated;

drop trigger if exists company_match_profile_stale_company on company;
create trigger company_match_profile_stale_company
  after update of industry, business_condition, region, founded_date, revenue,
    headcount, condition_tags, memo
  on company for each row execute function mark_company_match_profile_stale();

drop trigger if exists company_match_profile_stale_credential on credential;
create trigger company_match_profile_stale_credential
  after insert or update or delete on credential
  for each row execute function mark_company_match_profile_stale();

drop trigger if exists company_match_profile_stale_ip_right on ip_right;
create trigger company_match_profile_stale_ip_right
  after insert or update or delete on ip_right
  for each row execute function mark_company_match_profile_stale();

drop trigger if exists company_match_profile_stale_task on task;
create trigger company_match_profile_stale_task
  after insert or update or delete on task
  for each row execute function mark_company_match_profile_stale();

drop trigger if exists company_match_profile_stale_meeting_report on meeting_report;
create trigger company_match_profile_stale_meeting_report
  after insert or update or delete on meeting_report
  for each row execute function mark_company_match_profile_stale();

drop trigger if exists company_match_profile_stale_document on document;
create trigger company_match_profile_stale_document
  after insert or update or delete on document
  for each row execute function mark_company_match_profile_stale();

alter table company_match_profile enable row level security;
alter table company_match_profile_source enable row level security;
alter table company_program_match enable row level security;
alter table company_gov_program_review enable row level security;

create policy "company_match_profile: 조회" on company_match_profile
  for select using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.read'))
  );
create policy "company_match_profile: 관리" on company_match_profile
  for all using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
  ) with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
  );

create policy "company_match_profile_source: 조회" on company_match_profile_source
  for select using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.read'))
  );
create policy "company_match_profile_source: 관리" on company_match_profile_source
  for all using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
  ) with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
  );

create policy "company_program_match: 조회" on company_program_match
  for select using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.read'))
  );
create policy "company_program_match: 관리" on company_program_match
  for all using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
  ) with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
  );

create policy "company_gov_program_review: 조회" on company_gov_program_review
  for select using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.read'))
  );
create policy "company_gov_program_review: 관리" on company_gov_program_review
  for all using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('tasks.write'))
  ) with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('tasks.write'))
  );

grant select, insert, update, delete on
  company_match_profile,
  company_match_profile_source,
  company_program_match,
  company_gov_program_review
to authenticated;

comment on table company_match_profile is
  '기업 기본정보와 누적 이력을 정부지원사업 매칭용으로 구조화한 최신 프로필';
comment on table company_match_profile_source is
  '매칭 프로필에 포함되는 기업 이력 출처와 사용자 포함/제외 설정';
comment on table company_program_match is
  '기업 프로필 버전별 공고 자격판단·적합도·근거 캐시';
comment on column task.source_gov_program_id is
  '정부지원사업 워크스페이스에서 전환된 Task의 원본 공고';
