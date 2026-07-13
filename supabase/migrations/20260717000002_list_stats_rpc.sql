-- 목록 화면용 자식 행 집계 RPC
--
-- Data API의 전역 max_rows와 무관하게 요청된 부모별 통계만 반환한다.
-- 전체 count/min은 정확히 계산하되 툴팁용 상세 JSON은 기업별 10건으로 제한한다.
-- security invoker로 실행해 company/credential/deadline_item/campaign_recipient의
-- 기존 RLS와 권한 검사를 호출 사용자 기준으로 그대로 적용한다.

create or replace function get_company_list_stats(
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
  expired_count bigint
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
  )
  select
    requested.id as company_id,
    coalesce(credentials.credential_types, '{}'::text[]) as credential_types,
    deadlines.nearest_days_left,
    coalesce(deadlines.upcoming_count, 0::bigint) as upcoming_count,
    coalesce(deadlines.upcoming_items, '[]'::jsonb) as upcoming_items,
    coalesce(deadlines.expired_count, 0::bigint) as expired_count
  from requested_companies requested
  left join credential_stats credentials on credentials.company_id = requested.id
  left join deadline_stats deadlines on deadlines.company_id = requested.id;
$$;

revoke all on function get_company_list_stats(uuid[], date, int)
  from public, anon, authenticated;
grant execute on function get_company_list_stats(uuid[], date, int)
  to authenticated;

create or replace function get_campaign_list_stats(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  recipient_count bigint,
  responded_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested_campaigns as (
    select c.id
    from campaign c
    where c.id = any(coalesce(p_campaign_ids, '{}'::uuid[]))
  )
  select
    r.campaign_id,
    count(*)::bigint as recipient_count,
    count(*) filter (where r.responded)::bigint as responded_count
  from campaign_recipient r
  join requested_campaigns requested on requested.id = r.campaign_id
  group by r.campaign_id;
$$;

revoke all on function get_campaign_list_stats(uuid[])
  from public, anon, authenticated;
grant execute on function get_campaign_list_stats(uuid[])
  to authenticated;
