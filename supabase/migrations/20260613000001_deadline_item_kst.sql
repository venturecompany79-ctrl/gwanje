-- =============================================================
-- F1: deadline_item 뷰의 D-day 계산을 KST 기준으로 고정
-- 기존 뷰는 current_date(= DB 타임존 UTC)를 써서, 운영 서버에서
-- 00:00~09:00 KST 구간 동안 days_left가 하루 어긋났다.
-- 앱(lib/datetime.ts)과 동일하게 (now() at time zone 'Asia/Seoul')::date 사용.
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
where s.date >= (now() at time zone 'Asia/Seoul')::date - interval '30 days';

grant select on deadline_item to authenticated;
