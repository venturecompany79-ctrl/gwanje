-- =============================================================
-- 기업별 지식재산권(특허·상표) 관리
-- - ip_right: 권리 본체(특허/상표, 출원·등록 정보, 진행상태)
-- - ip_deadline: 권리별 대응/납부/갱신 기한
-- - document.ip_right_id: IP 첨부 자료 연결
-- - deadline_item 뷰에 ip_deadline 합류 → 기존 D-day 관제/알림 흐름 재사용
-- =============================================================

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
  add column if not exists ip_right_id uuid references ip_right (id) on delete set null;

comment on table ip_right is '기업별 지식재산권 본체 — 특허/상표 출원·등록 정보';
comment on table ip_deadline is '지식재산권별 대응·납부·갱신 기한';
comment on column document.ip_right_id is
  '연결된 지식재산권(ip_right). 특허·상표 탭에서 업로드한 자료에 설정된다. 일반 자료는 null.';

alter table ip_right enable row level security;
alter table ip_deadline enable row level security;

create policy "ip_right: tenant 격리" on ip_right
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy "ip_deadline: tenant 격리" on ip_deadline
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

grant select, insert, update, delete on ip_right to authenticated;
grant select, insert, update, delete on ip_deadline to authenticated;

create index idx_ip_right_company on ip_right (company_id);
create index idx_ip_right_tenant_status on ip_right (tenant_id, status);
create index idx_ip_deadline_company on ip_deadline (company_id);
create index idx_ip_deadline_due on ip_deadline (tenant_id, due_date) where is_done = false;
create index idx_ip_deadline_right on ip_deadline (ip_right_id);
create index idx_document_ip_right on document (ip_right_id);

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
  end                                 as status
from credential c
join company co on co.id = c.company_id
left join category cat on cat.id = c.category_id
where c.expires_date is not null
  and not exists (
    select 1
    from task t
    where t.source_credential_id = c.id
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
where d.is_done = false;

grant select on deadline_item to authenticated;
