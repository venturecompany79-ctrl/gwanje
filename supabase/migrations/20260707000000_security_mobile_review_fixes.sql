-- =============================================================
-- 보안 리뷰 후속 보강
-- - billing 테이블 default privileges로 열린 쓰기/민감 조회 권한 회수
-- - due notification 중복 생성 방지(active 멤버만 lead-day 판정)
-- - campaign/category 무결성 인덱스 추가
-- - authenticated 알림 쓰기는 읽음 처리(is_read)만 허용
-- =============================================================

-- 1) billing 권한 축소
revoke all privileges on table billing_customer from authenticated;
revoke all privileges on table payment_method from authenticated;
revoke all privileges on table tenant_subscription from authenticated;
revoke all privileges on table payment_transaction from authenticated;
revoke all privileges on table webhook_event from authenticated;

grant select on table billing_plan to authenticated;
grant select on table tenant_subscription to authenticated;

grant select (
  id, tenant_id,
  card_company, card_number_masked, card_type,
  is_default, status, created_at, updated_at
) on table payment_method to authenticated;

grant select (
  id, tenant_id, subscription_id, payment_method_id,
  kind, status, order_id, order_name, amount, currency,
  failure_code, failure_message, approved_at, created_at, updated_at
) on table payment_transaction to authenticated;

-- 2) 알림 생성 함수: profile JOIN으로 active 멤버 수만큼 중복 생성되던 문제 방지
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
  where exists (
      select 1
      from profile p
      where p.tenant_id = d.tenant_id
        and p.status = 'active'
        and d.days_left = any (p.notify_lead_days)
    )
    and not exists (
      select 1
      from notification n
      where n.tenant_id = d.tenant_id
        and n.ref_table = d.source
        and n.ref_id = d.id
        and (n.created_at at time zone 'Asia/Seoul')::date
            = (now() at time zone 'Asia/Seoul')::date
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function generate_due_notifications() from public, anon, authenticated;

-- 3) 무결성/조회 인덱스
create unique index if not exists campaign_recipient_campaign_company_uniq
  on campaign_recipient (campaign_id, company_id);

create unique index if not exists category_tenant_name_uniq
  on category (tenant_id, name);

create index if not exists campaign_recipient_tenant_idx
  on campaign_recipient (tenant_id);

-- 4) notification 쓰기 축소: 조회 권한이 있어도 생성/삭제는 불가, 읽음 처리만 가능
drop policy if exists "notification: 생성" on notification;
drop policy if exists "notification: 삭제" on notification;

revoke insert, delete on table notification from authenticated;
revoke update on table notification from authenticated;
grant update (is_read) on table notification to authenticated;
