-- =============================================================
-- 「관제」 DB 스키마 (Supabase Postgres)
-- 권위 문서: CLAUDE.md 7절 데이터 레이어와 1:1 대응
-- 멀티테넌트 준비 완료 — RLS가 tenant 격리를 자동 처리
-- =============================================================

-- -------------------------------------------------------------
-- 0. Enums (DB는 영문, UI 라벨은 lib/labels.ts에서 한국어 매핑)
-- -------------------------------------------------------------
create type task_stage as enum ('diagnosis', 'proposal', 'application', 'result');
create type schedule_type as enum ('expiry', 'deadline', 'meeting', 'renewal', 'etc');
create type document_uploader as enum ('consultant', 'client');
create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent');
create type campaign_channel as enum ('alimtalk', 'email');
create type notification_type as enum ('expiry', 'deadline', 'program_match');
create type ip_right_kind as enum ('patent', 'trademark');
create type ip_right_status as enum (
  'preparing',
  'filed',
  'examining',
  'office_action',
  'registered',
  'rejected',
  'abandoned',
  'expired'
);
create type ip_deadline_type as enum (
  'office_action',
  'registration_fee',
  'renewal',
  'annuity',
  'etc'
);
create type meeting_report_status as enum ('pending', 'processing', 'succeeded', 'failed');
create type meeting_report_source_role as enum ('company_info', 'meeting_note');

-- -------------------------------------------------------------
-- 1. tenant / profile — 워크스페이스 / 컨설턴트
-- -------------------------------------------------------------
create table tenant (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table profile (
  id                uuid primary key references auth.users (id) on delete cascade,
  tenant_id         uuid not null references tenant (id) on delete cascade,
  name              text not null,
  title             text,                                   -- 직함
  phone             text,
  email             text,
  -- 알림 규칙 (설정 > 알림 규칙)
  notify_lead_days  int[] not null default '{7,3,1}',       -- D-7 / D-3 / D-1
  notify_channels   text[] not null default '{email}',      -- email / alimtalk
  notify_match      boolean not null default true,          -- 공고매칭 알림
  daily_summary_at  time,                                   -- 일일 요약 시각 (null = off)
  -- 알림톡 발신 정보
  sender_name       text,
  sender_phone      text,
  created_at        timestamptz not null default now()
);

-- 현재 사용자의 tenant_id (RLS 정책에서 사용)
create or replace function auth_tenant_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from profile where id = auth.uid();
$$;

-- -------------------------------------------------------------
-- 2. category — 분류 5종 (설정에서 수정 가능)
-- -------------------------------------------------------------
create table category (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenant (id) on delete cascade,
  name       text not null,           -- 정부지원사업 / 벤처기업확인 / 기업부설연구소 / 세액공제 / 정책자금
  color      text,                    -- 팀이 정식 정의 전까지 null (칩은 중립 스타일)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 3. company — 고객사
-- -------------------------------------------------------------
create table company (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant (id) on delete cascade,
  name           text not null,
  biz_no         text,                -- 사업자등록번호
  industry       text,
  founded_date   date,
  revenue        bigint,              -- 연 매출 (원)
  headcount      int,
  ceo_name       text,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  condition_tags text[] not null default '{}',  -- 성장기 등 컨디션 태그
  memo           text,
  status         text not null default 'active'
    check (status in ('active', 'ended')),       -- 관리중 / 종료
  contract_start_date date,                       -- 계약 시작일(선택)
  contract_end_date   date,                       -- 계약 종료일(선택)
  ended_at            timestamptz,                -- 관리 종료 확정 시각
  ended_reason        text,                       -- 종료 사유(선택)
  created_at     timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 4. credential — 자격·인증
--    상태(valid/expiring/expired)는 저장하지 않고 만료일로 파생
-- -------------------------------------------------------------
create table credential (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  company_id      uuid not null references company (id) on delete cascade,
  type            text not null,      -- 벤처기업확인, 이노비즈 등 자격 종류명
  category_id     uuid references category (id) on delete set null,
  issued_date     date,
  expires_date    date,
  renew_lead_days int not null default 60,  -- 이 일수 이내면 '임박(expiring)'
  memo            text,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 5. task — 관리포인트 (현황진단→제안→신청→결과)
-- -------------------------------------------------------------
create table task (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenant (id) on delete cascade,
  company_id           uuid not null references company (id) on delete cascade,
  title                text not null,
  category_id          uuid references category (id) on delete set null,
  stage                task_stage not null default 'diagnosis',
  due_date             date,
  assignee_id          uuid references profile (id) on delete set null,
  source_credential_id uuid references credential (id) on delete set null,  -- 만료 임박 자격 → 갱신 과제 자동 전환 출처
  memo                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 6. schedule — 일정
-- -------------------------------------------------------------
create table schedule (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  company_id      uuid references company (id) on delete cascade,
  title           text not null,
  date            date not null,
  type            schedule_type not null default 'etc',
  related_task_id uuid references task (id) on delete set null,
  memo            text,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 7. document — 자료 (파일 본체는 Cloudinary)
-- -------------------------------------------------------------
create table document (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant (id) on delete cascade,
  company_id    uuid not null references company (id) on delete cascade,
  credential_id uuid references credential (id) on delete set null,  -- 자격 첨부면 연결, 일반 자료는 null
  name          text not null,
  doc_category  text,                          -- 재무 / 인증 / 계약 등
  version       int not null default 1,
  uploaded_by   document_uploader not null default 'consultant',
  storage_url   text,
  file_type     text,                          -- pdf / xlsx ...
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 8. meeting_report — 미팅 기반 AI 진단 보고서
-- -------------------------------------------------------------
create table meeting_report (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant (id) on delete cascade,
  company_id         uuid not null references company (id) on delete cascade,
  requested_by       uuid references profile (id) on delete set null,
  title              text not null,
  status             meeting_report_status not null default 'pending',
  attempts           int not null default 0 check (attempts >= 0),
  model              text,
  report_json        jsonb,
  summary            text,
  output_document_id uuid references document (id) on delete set null,
  last_error         text,
  next_run_at        timestamptz not null default now(),
  generated_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table meeting_report_source (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  company_id  uuid not null references company (id) on delete cascade,
  report_id   uuid not null references meeting_report (id) on delete cascade,
  document_id uuid not null references document (id) on delete cascade,
  role        meeting_report_source_role not null,
  created_at  timestamptz not null default now(),
  unique (report_id, role)
);

-- -------------------------------------------------------------
-- 9. ip_right / ip_deadline — 지식재산권(특허·상표) / 대응·납부·갱신 기한
-- -------------------------------------------------------------
create table ip_right (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant (id) on delete cascade,
  company_id      uuid not null references company (id) on delete cascade,
  kind            ip_right_kind not null,
  title           text not null,
  application_no  text,
  registration_no text,
  agent_name      text,
  status          ip_right_status not null default 'preparing',
  applied_date    date,
  registered_date date,
  memo            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table ip_deadline (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  company_id  uuid not null references company (id) on delete cascade,
  ip_right_id uuid not null references ip_right (id) on delete cascade,
  type        ip_deadline_type not null default 'etc',
  title       text not null,
  due_date    date not null,
  is_done     boolean not null default false,
  memo        text,
  created_at  timestamptz not null default now()
);

alter table document
  add column ip_right_id uuid references ip_right (id) on delete set null;

-- -------------------------------------------------------------
-- 10. campaign / campaign_recipient — 일괄안내 / 수신·응답
-- -------------------------------------------------------------
create table campaign (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant (id) on delete cascade,
  title        text not null,
  body         text,
  channel      campaign_channel not null default 'alimtalk',
  segment      jsonb not null default '{}',   -- 조건 빌더 결과 ({rules:[{field,op,value}],join:'and'})
  status       campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table campaign_recipient (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant (id) on delete cascade,
  campaign_id   uuid not null references campaign (id) on delete cascade,
  company_id    uuid not null references company (id) on delete cascade,
  delivered     boolean not null default false,
  delivered_at  timestamptz,
  responded     boolean not null default false,
  responded_at  timestamptz,
  response_note text,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 10. notification — 알림
-- -------------------------------------------------------------
create table notification (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenant (id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  body       text,
  company_id uuid references company (id) on delete cascade,
  ref_table  text,                    -- credential / task / schedule / campaign
  ref_id     uuid,
  is_urgent  boolean not null default false,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 11. gov_program — 정부지원사업 공개 공고 공유 풀
--     테넌트 무관 공개 데이터. service_role 크론이 쓰고 authenticated는 읽기 전용.
-- -------------------------------------------------------------
create or replace function gov_program_to_search_vector(
  title text,
  support_field text,
  org_name text,
  target_text text,
  hashtags text[]
)
returns tsvector
language sql
immutable
as $$
  select to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    coalesce(support_field, '') || ' ' ||
    coalesce(org_name, '') || ' ' ||
    coalesce(target_text, '') || ' ' ||
    array_to_string(coalesce(hashtags, '{}'), ' ')
  );
$$;

create table gov_program (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('bizinfo', 'kstartup', 'smes', 'msit')),
  external_id   text not null,
  content_key   text not null,                    -- 정규화 제목+기관+마감 기반 dedup 키
  title         text not null,
  support_field text check (
    support_field is null or
    support_field in ('금융', '기술', '인력', '수출', '내수', '창업', '경영', '기타')
  ),
  org_name      text,
  target_text   text,
  hashtags      text[] not null default '{}',
  region        text,
  apply_start   date,
  apply_end     date,
  detail_url    text,
  raw           jsonb,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  search_vector tsvector generated always as (
    gov_program_to_search_vector(title, support_field, org_name, target_text, hashtags)
  ) stored,
  unique (source, external_id)
);

create table gov_program_sync_log (
  id        uuid primary key default gen_random_uuid(),
  source    text not null check (source in ('bizinfo', 'kstartup', 'smes', 'msit')),
  status    text not null check (status in ('success', 'failed')),
  fetched   int not null default 0,
  upserted  int not null default 0,
  error     text,
  ran_at    timestamptz not null default now()
);

create or replace function match_gov_program_candidates(
  q text default '',
  tags text[] default '{}',
  fields text[] default '{}',
  today date default current_date,
  max_rows int default 80
)
returns setof gov_program
language sql
stable
security invoker
set search_path = public
as $$
  with args as (
    select
      nullif(btrim(coalesce(q, '')), '') as query_text,
      coalesce(tags, '{}') as tag_list,
      coalesce(fields, '{}') as field_list,
      greatest(1, least(coalesce(max_rows, 80), 200)) as row_limit
  )
  select gp.*
  from gov_program gp
  cross join args a
  where (gp.apply_end is null or gp.apply_end >= today)
    and (
      a.query_text is null
      or gp.hashtags && a.tag_list
      or gp.support_field = any(a.field_list)
      or gp.search_vector @@ plainto_tsquery('simple', a.query_text)
      or gp.title ilike '%' || a.query_text || '%'
      or coalesce(gp.target_text, '') ilike '%' || a.query_text || '%'
      or coalesce(gp.org_name, '') ilike '%' || a.query_text || '%'
    )
  order by
    case when gp.hashtags && a.tag_list then 0 else 1 end,
    case when gp.support_field = any(a.field_list) then 0 else 1 end,
    case when gp.apply_end is null then 1 else 0 end,
    gp.apply_end asc,
    gp.synced_at desc
  limit (select row_limit from args);
$$;

-- -------------------------------------------------------------
-- 12. rule — 룰엔진 (Phase 2, 테이블만)
-- -------------------------------------------------------------
create table rule (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  name        text not null,
  eligibility jsonb not null default '{}',
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 13. deadline_item 뷰 — 대시보드 D-day 통합 (자격+과제+일정+지식재산권 기한)
--     security_invoker: 조회자의 RLS가 그대로 적용됨
--     days_left는 KST 기준 ((now() at time zone 'Asia/Seoul')::date) — 앱(lib/datetime.ts)과 일치
-- -------------------------------------------------------------
create view deadline_item
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
  (c.expires_date - (now() at time zone 'Asia/Seoul')::date)     as days_left,
  case
    when c.expires_date < (now() at time zone 'Asia/Seoul')::date then 'expired'
    when c.expires_date - (now() at time zone 'Asia/Seoul')::date <= c.renew_lead_days then 'expiring'
    else 'valid'
  end                                 as status
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
  t.stage::text
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
  s.type::text
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
  d.type::text
from ip_deadline d
join ip_right r on r.id = d.ip_right_id
join company co on co.id = d.company_id
where d.is_done = false
  and co.status = 'active';

-- -------------------------------------------------------------
-- 14. RLS — 모든 tenant 종속 테이블은 tenant 격리, gov_program은 읽기 전용 공개
-- -------------------------------------------------------------
alter table tenant enable row level security;
alter table profile enable row level security;
alter table category enable row level security;
alter table company enable row level security;
alter table credential enable row level security;
alter table task enable row level security;
alter table schedule enable row level security;
alter table document enable row level security;
alter table meeting_report enable row level security;
alter table meeting_report_source enable row level security;
alter table ip_right enable row level security;
alter table ip_deadline enable row level security;
alter table campaign enable row level security;
alter table campaign_recipient enable row level security;
alter table notification enable row level security;
alter table gov_program enable row level security;
alter table gov_program_sync_log enable row level security;
alter table rule enable row level security;

create policy "tenant: 본인 워크스페이스만" on tenant
  for all using (id = auth_tenant_id()) with check (id = auth_tenant_id());

-- profile: 본인 행만. tenant_id 자가 변경/임의 INSERT 차단(F8) —
-- INSERT/DELETE 정책 없음(인증 사용자 거부, 생성은 seed의 postgres 권한으로만),
-- UPDATE는 안전 컬럼(아래 grant)으로만 한정해 id·tenant_id를 잠근다.
create policy "profile: 조회 본인만" on profile
  for select using (id = auth.uid());
create policy "profile: 수정 본인만" on profile
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "category: tenant 격리" on category
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "company: tenant 격리" on company
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "credential: tenant 격리" on credential
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "task: tenant 격리" on task
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "schedule: tenant 격리" on schedule
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "document: tenant 격리" on document
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "meeting_report: tenant 격리" on meeting_report
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "meeting_report_source: tenant 격리" on meeting_report_source
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "ip_right: tenant 격리" on ip_right
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "ip_deadline: tenant 격리" on ip_deadline
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "campaign: tenant 격리" on campaign
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "campaign_recipient: tenant 격리" on campaign_recipient
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "notification: tenant 격리" on notification
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "gov_program: 읽기 전용 공개" on gov_program
  for select to authenticated using (true);
create policy "rule: tenant 격리" on rule
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

-- -------------------------------------------------------------
-- 15. API 권한 — Supabase Data API에서 authenticated role에 명시 부여
--     RLS가 실제 tenant 격리를 담당하고, grant는 API 접근 권한만 연다.
-- -------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on deadline_item to authenticated;
grant select on gov_program to authenticated;
revoke insert, update, delete on gov_program from authenticated;
revoke all on gov_program_sync_log from authenticated;
revoke all on function match_gov_program_candidates(text, text[], text[], date, int) from public, anon;
grant execute on function match_gov_program_candidates(text, text[], text[], date, int) to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- profile 권한 축소(F8) — insert/delete/임의 update 회수 후 안전 컬럼만 update 허용
revoke insert, update, delete on profile from authenticated;
grant update (
  name, title, phone, email,
  notify_lead_days, notify_channels, notify_match, daily_summary_at,
  sender_name, sender_phone
) on profile to authenticated;

-- -------------------------------------------------------------
-- 16. 인덱스
-- -------------------------------------------------------------
create index idx_company_tenant on company (tenant_id);
create unique index company_tenant_id_id_uniq on company (tenant_id, id);
create index idx_company_status on company (tenant_id, status);
create index idx_credential_company on credential (company_id);
create index idx_credential_expires on credential (tenant_id, expires_date);
create index idx_task_company on task (company_id);
create index idx_task_due on task (tenant_id, due_date);
create index idx_task_stage on task (tenant_id, stage);
create index idx_schedule_date on schedule (tenant_id, date);
create index idx_document_company on document (company_id);
create unique index document_tenant_company_id_uniq on document (tenant_id, company_id, id);
create unique index document_company_name_version_uniq on document (company_id, name, version);
create index idx_document_credential on document (credential_id);
create index idx_document_ip_right on document (ip_right_id);
create index idx_meeting_report_company_created
  on meeting_report (tenant_id, company_id, created_at desc);
create unique index meeting_report_tenant_company_id_uniq
  on meeting_report (tenant_id, company_id, id);
create index idx_meeting_report_due on meeting_report (status, next_run_at);
create index idx_meeting_report_source_report on meeting_report_source (report_id);
create index idx_meeting_report_source_document on meeting_report_source (document_id);
create index idx_ip_right_company on ip_right (company_id);
create index idx_ip_right_tenant_status on ip_right (tenant_id, status);
create index idx_ip_deadline_company on ip_deadline (company_id);
create index idx_ip_deadline_due on ip_deadline (tenant_id, due_date) where is_done = false;
create index idx_ip_deadline_right on ip_deadline (ip_right_id);
create index idx_campaign_tenant on campaign (tenant_id);
create index idx_recipient_campaign on campaign_recipient (campaign_id);
create index idx_notification_unread on notification (tenant_id, is_read, created_at desc);
create index gov_program_apply_end_idx on gov_program (apply_end);
create index gov_program_content_key_idx on gov_program (content_key);
create index gov_program_hashtags_idx on gov_program using gin (hashtags);
create index gov_program_search_vector_idx on gov_program using gin (search_vector);
create index gov_program_support_field_idx on gov_program (support_field);

-- 자격 1건당 갱신 과제 1건 보장(F9) — 동시요청 중복 방어
create unique index if not exists task_source_credential_unique
  on task (source_credential_id)
  where source_credential_id is not null;

alter table credential
  add constraint credential_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table task
  add constraint task_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table schedule
  add constraint schedule_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table document
  add constraint document_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table meeting_report
  add constraint meeting_report_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table meeting_report_source
  add constraint meeting_report_source_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table meeting_report_source
  add constraint meeting_report_source_report_tenant_company_fk
  foreign key (tenant_id, company_id, report_id)
  references meeting_report (tenant_id, company_id, id)
  on delete cascade;
alter table meeting_report_source
  add constraint meeting_report_source_document_tenant_company_fk
  foreign key (tenant_id, company_id, document_id)
  references document (tenant_id, company_id, id)
  on delete cascade;
alter table campaign_recipient
  add constraint campaign_recipient_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table notification
  add constraint notification_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table ip_right
  add constraint ip_right_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;
alter table ip_deadline
  add constraint ip_deadline_tenant_company_fk
  foreign key (tenant_id, company_id) references company (tenant_id, id)
  on delete cascade not valid;

-- -------------------------------------------------------------
-- 17. 알림 자동 생성 잡 (F4) — deadline_item × profile.notify_lead_days 매칭
--     매일 1회 멱등 생성. 함수는 항상 생성되고, pg_cron 스케줄 등록은 가드 블록으로
--     감싸 확장이 없어도 마이그레이션이 실패하지 않는다(경고만).
--     상세는 supabase/migrations/20260613000004_due_notifications_cron.sql 참고.
-- -------------------------------------------------------------
create or replace function generate_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into notification (tenant_id, type, title, body, company_id, ref_table, ref_id, is_urgent)
  select
    d.tenant_id,
    case when d.source = 'credential' then 'expiry'::notification_type
         else 'deadline'::notification_type end,
    coalesce(d.company_name || ' · ', '') || d.title || ' D-' || d.days_left::text,
    '사전 알림 — 만료·마감이 다가옵니다.',
    d.company_id,
    d.source,
    d.id,
    d.days_left <= 3
  from deadline_item d
  join profile p on p.tenant_id = d.tenant_id
  where d.days_left = any (p.notify_lead_days)
    and not exists (
      select 1 from notification n
      where n.ref_table = d.source and n.ref_id = d.id
        and (n.created_at at time zone 'Asia/Seoul')::date
            = (now() at time zone 'Asia/Seoul')::date
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function generate_due_notifications() from public, anon, authenticated;

-- pg_cron 스케줄 등록 — 확장이 없어도 마이그레이션을 실패시키지 않도록 가드(매일 15:05 UTC = 00:05 KST)
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'generate-due-notifications',
    '5 15 * * *',
    $job$select generate_due_notifications();$job$
  );
exception
  when others then
    raise notice 'pg_cron 스케줄 등록 건너뜀 — Dashboard에서 활성화 후 수동 등록 필요: %', sqlerrm;
end
$cron$;
