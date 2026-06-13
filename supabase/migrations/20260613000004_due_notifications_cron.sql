-- =============================================================
-- F4: 만료·마감 사전 알림 자동 생성 (무인 일일 잡)
-- 기존엔 notification을 생성하는 코드가 없어 알림센터·안읽음 배지·일일 요약이
-- 시드 소진 후 영구히 비어 있었다. deadline_item(D-day) × profile.notify_lead_days를
-- 매칭해 매일 1회 notification을 멱등 생성한다.
-- =============================================================

-- 1) 알림 생성 함수 — pg_cron 유무와 무관하게 항상 생성된다.
--    security definer(postgres 소유) → security_invoker 뷰 deadline_item을
--    전체 tenant 범위로 조회/삽입(RLS 우회). 외부 execute 권한은 주지 않는다.
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
    case
      when d.source = 'credential' then 'expiry'::notification_type
      else 'deadline'::notification_type
    end,
    coalesce(d.company_name || ' · ', '') || d.title
      || ' D-' || d.days_left::text,
    '사전 알림 — 만료·마감이 다가옵니다.',
    d.company_id,
    d.source,
    d.id,
    d.days_left <= 3
  from deadline_item d
  join profile p on p.tenant_id = d.tenant_id
  where d.days_left = any (p.notify_lead_days)
    and not exists (
      select 1
      from notification n
      where n.ref_table = d.source
        and n.ref_id = d.id
        and (n.created_at at time zone 'Asia/Seoul')::date
            = (now() at time zone 'Asia/Seoul')::date
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function generate_due_notifications() from public, anon, authenticated;

-- 2) pg_cron 스케줄 등록 — 확장이 없거나 권한이 없어도 마이그레이션을 실패시키지 않고
--    경고만 남긴다. 위 함수는 이미 생성됐으므로, pg_cron 미사용 시
--    Vercel Cron 등 외부 스케줄러로 generate_due_notifications()를 호출해도 된다.
--    매일 00:05 KST = 15:05 UTC (pg_cron 스케줄은 서버 타임존 UTC 기준).
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'generate-due-notifications',
    '5 15 * * *',
    $job$select generate_due_notifications();$job$
  );
  raise notice 'pg_cron 알림 잡 등록됨 (매일 15:05 UTC = 00:05 KST)';
exception
  when others then
    raise notice 'pg_cron 스케줄 등록 건너뜀 — Dashboard에서 pg_cron 활성화 후 수동 등록 필요: %', sqlerrm;
end
$cron$;
