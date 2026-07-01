-- =============================================================
-- 기업 라이프사이클: 계약기간 + 관리 상태(관리중/종료)
-- - company에 status / 계약기간 / 종료 메타 컬럼 추가
-- - deadline_item 뷰에서 종료(status='ended') 기업의 자격·과제·일정·IP 기한 제외
--   → 대시보드 D-day 관제·목록 카운트·알림 잡이 코드 변경 없이 종료기업을 자동 제외
-- =============================================================

alter table company
  add column status             text not null default 'active'
    check (status in ('active', 'ended')),  -- 관리중 / 종료
  add column contract_start_date date,       -- 계약 시작일(선택)
  add column contract_end_date   date,       -- 계약 종료일(선택)
  add column ended_at            timestamptz,-- 관리 종료 확정 시각
  add column ended_reason        text;       -- 종료 사유(선택)

create index idx_company_status on company (tenant_id, status);

-- -------------------------------------------------------------
-- deadline_item 뷰 재정의 — 각 브랜치에 활성 기업 조건 추가
-- (컬럼 구성은 동일, where 절만 보강)
-- -------------------------------------------------------------
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
  and co.status = 'active'
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

grant select on deadline_item to authenticated;
