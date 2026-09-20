-- 알림톡(카카오톡) 실발송 연동 — 테넌트별 Solapi 계정 + 수신자별 발송 상태
--
-- 배경: 일괄안내(campaign) 화면은 완성돼 있으나 발송은 기록만 남기는 가짜였다.
-- 이 마이그레이션은 실발송에 필요한 3가지를 추가한다.
--   1) alimtalk_settings — 테넌트(컨설팅사)별 Solapi 자격증명. 요금은 각 사 계정에서 차감.
--   2) alimtalk_template — 카카오 검수를 통과한 템플릿 미러(발송은 solapi_template_id로).
--   3) campaign_recipient 상태 컬럼 — 수신자별 도달/실패/제외를 화면에 반영하기 위함.

-- -------------------------------------------------------------
-- 1. alimtalk_settings — 테넌트별 Solapi 연동 (BYO 계정)
-- -------------------------------------------------------------
-- api_key/secret은 AES-256-GCM으로 암호화해 저장한다(ALIMTALK_CRED_KEY).
-- 복호화는 서버 전용 모듈에서만 하며 클라이언트로 내려보내지 않는다.
create table alimtalk_settings (
  tenant_id      uuid primary key references tenant (id) on delete cascade,
  api_key_enc    text not null,
  api_secret_enc text not null,
  pf_id          text not null,            -- 카카오 비즈니스 채널 ID
  sender_phone   text not null,            -- 사전 등록된 발신번호 (SMS 대체발송용)
  sms_fallback   boolean not null default true,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table alimtalk_settings enable row level security;

create policy "alimtalk_settings: 조회" on alimtalk_settings
  for select to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

create policy "alimtalk_settings: 생성" on alimtalk_settings
  for insert to authenticated
  with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

create policy "alimtalk_settings: 수정" on alimtalk_settings
  for update to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  )
  with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

create policy "alimtalk_settings: 삭제" on alimtalk_settings
  for delete to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

-- -------------------------------------------------------------
-- 2. alimtalk_template — 검수 완료된 알림톡 템플릿 미러
-- -------------------------------------------------------------
-- content는 미리보기 전용 사본이다. 실제 발송 내용은 카카오가 승인한
-- solapi_template_id의 원본이므로, 이 값이 어긋나면 미리보기만 틀린다.
create table alimtalk_template (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant (id) on delete cascade,
  name               text not null,
  solapi_template_id text not null,
  content            text not null,
  variables          text[] not null default '{}',   -- content에서 추출한 #{변수} 목록
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, solapi_template_id)
);

create index idx_alimtalk_template_tenant on alimtalk_template (tenant_id);

alter table alimtalk_template enable row level security;

create policy "alimtalk_template: 조회" on alimtalk_template
  for select to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.read'))
  );

create policy "alimtalk_template: 생성" on alimtalk_template
  for insert to authenticated
  with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

create policy "alimtalk_template: 수정" on alimtalk_template
  for update to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  )
  with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

create policy "alimtalk_template: 삭제" on alimtalk_template
  for delete to authenticated
  using (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('campaigns.write'))
  );

-- -------------------------------------------------------------
-- 3. campaign — 템플릿 연결 + 발송 선점 시각
-- -------------------------------------------------------------
alter table campaign
  add column template_id     uuid references alimtalk_template (id) on delete set null,
  add column send_started_at timestamptz;   -- sending 고착(함수 타임아웃) 판정용

create index idx_campaign_template on campaign (template_id);
-- 예약 발송 스캔 경로(status + scheduled_at) 전용 인덱스
create index idx_campaign_due on campaign (status, scheduled_at);

-- -------------------------------------------------------------
-- 4. campaign_recipient — 수신자별 발송 상태
-- -------------------------------------------------------------
-- pending  대기      — 아직 발송 시도 전
-- sent     발송됨    — Solapi 접수 완료, 도달 확인 대기
-- delivered 도달     — 수신자 단말 도달 확인
-- failed   실패      — 접수 거절 또는 도달 실패
-- skipped  제외      — 연락처 없음/형식 오류로 발송 대상에서 제외
create type recipient_status as enum ('pending', 'sent', 'delivered', 'failed', 'skipped');

alter table campaign_recipient
  add column status              recipient_status not null default 'pending',
  add column phone               text,   -- 발송 시점 정규화 스냅샷 (01012345678)
  add column provider_message_id text,
  add column provider_group_id   text,   -- Solapi groupId — 도달 폴링 키
  add column error_code          text,
  add column error_message       text,
  add column attempts            int not null default 0,
  add column sent_at             timestamptz;

-- 기존 가짜 발송 기록 정합 — delivered=true 행은 도달로 간주한다.
update campaign_recipient set status = 'delivered' where delivered;

-- 같은 (캠페인, 기업) 중복 적재 차단은 이미 걸려 있다 —
-- 20260707000000_security_mobile_review_fixes.sql의
-- campaign_recipient_campaign_company_uniq (campaign_id, company_id).
-- 여기서 다시 만들면 같은 컬럼에 중복 인덱스가 생겨 적재 비용만 늘어난다.

create index idx_recipient_campaign_status
  on campaign_recipient (campaign_id, status);
create index idx_recipient_group
  on campaign_recipient (provider_group_id)
  where provider_group_id is not null;

-- -------------------------------------------------------------
-- 5. 목록 집계 RPC — 도달/실패/제외 건수 추가
-- -------------------------------------------------------------
-- 반환 컬럼이 늘어나므로 replace가 아니라 drop 후 재생성해야 한다.
drop function if exists get_campaign_list_stats(uuid[]);

create function get_campaign_list_stats(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  recipient_count bigint,
  responded_count bigint,
  delivered_count bigint,
  failed_count bigint,
  skipped_count bigint
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
    count(*) filter (where r.responded)::bigint as responded_count,
    count(*) filter (where r.status = 'delivered')::bigint as delivered_count,
    count(*) filter (where r.status = 'failed')::bigint as failed_count,
    count(*) filter (where r.status = 'skipped')::bigint as skipped_count
  from campaign_recipient r
  join requested_campaigns requested on requested.id = r.campaign_id
  group by r.campaign_id;
$$;

revoke all on function get_campaign_list_stats(uuid[])
  from public, anon, authenticated;
grant execute on function get_campaign_list_stats(uuid[])
  to authenticated;
