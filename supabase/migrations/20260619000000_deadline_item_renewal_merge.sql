-- =============================================================
-- GWJ-001: 만료·갱신 중복 제거 (라이프사이클 병합)
-- 자격(credential)이 만료 임박하면 컨설턴트가 갱신 과제(task.source_credential_id)를
-- 생성한다. 이때 deadline_item 뷰가 같은 사건을 2행으로 방출했다:
--   ① credential 행 "<자격> 만료"   ② 갱신 task 행 "<자격> 갱신" (같은 due_date)
-- → 대시보드 '7일 내 마감' 카운트·알림센터·일일 요약이 모두 이중 노출.
--
-- 해결: 진행 중(stage <> 'result')인 갱신 과제가 있으면 credential 만료 행을 숨긴다.
--   - 갱신 진행 중      → task 행만 노출 (1 자격 = 1 항목)
--   - 갱신 완료/미생성  → credential 만료 행이 다시 노출 (만료일 갱신 전까지 리마인드 유지)
-- task_source_credential_unique(20260613000003)가 자격↔갱신과제 1:1을 보장하므로 안전.
-- 비파괴: 뷰만 교체. KST 규칙(20260613000001)은 그대로 유지한다.
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
  -- 진행 중인 갱신 과제가 있으면 만료 행을 숨겨 갱신 task 행으로 단일화 (GWJ-001)
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
where s.date >= (now() at time zone 'Asia/Seoul')::date - interval '30 days';

grant select on deadline_item to authenticated;

-- -------------------------------------------------------------
-- 1회 정리: 뷰 수정 이전에 이미 생성된 중복 알림 제거.
-- credential(만료) 알림 중, ① 진행 중인 갱신 과제가 있고 ② 그 갱신 과제의
-- task 알림이 이미 존재하는 건만 삭제한다(갱신 task 알림은 보존 → 사건당 1건 유지).
-- cron(generate_due_notifications)이 수정된 뷰에서 멱등 재생성하므로 추가 손실 없음.
-- -------------------------------------------------------------
delete from notification n
where n.ref_table = 'credential'
  and exists (
    select 1
    from task t
    where t.source_credential_id = n.ref_id
      and t.stage <> 'result'
      and exists (
        select 1
        from notification n2
        where n2.ref_table = 'task'
          and n2.ref_id = t.id
      )
  );
