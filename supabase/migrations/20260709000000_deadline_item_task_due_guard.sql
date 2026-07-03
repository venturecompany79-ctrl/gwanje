-- =============================================================
-- deadline_item 갱신 과제 병합 방어
-- source_credential_id만 있고 due_date가 비어 있는 초안/진행 과제는
-- 자격 만료 D-day를 대체할 수 없으므로 credential 행을 숨기지 않는다.
-- =============================================================

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

grant select on deadline_item to authenticated;
