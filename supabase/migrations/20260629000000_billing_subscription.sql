-- =============================================================
-- tenant 단위 구독 결제 (Toss Payments 빌링키 / 국내 카드 자동결제)
-- 워크스페이스(tenant)당 월간 단일 구독. Toss 결제창이 카드정보를 수집하고
-- 우리는 원본 카드정보(번호/CVC/유효기간)를 절대 저장하지 않는다.
-- 빌링키는 앱 서버에서 AES-256-GCM으로 암호화해 payment_method에만 저장하고,
-- authenticated 클라이언트는 암호화 컬럼을 직접 select할 수 없다(컬럼 grant 차단).
--
-- 격리: 모든 tenant 종속 테이블에 tenant_id + RLS. 결제 승인/상태 전이 등
--       쓰기는 service_role(RLS 우회) 서버 작업이 담당하고, authenticated는
--       자기 tenant 행을 '조회'만 한다. billing_plan은 전역 카탈로그.
-- =============================================================

-- -------------------------------------------------------------
-- 0. enum
-- -------------------------------------------------------------
create type subscription_status as enum
  ('trialing', 'active', 'past_due', 'canceled', 'expired');
create type payment_status as enum
  ('pending', 'succeeded', 'failed', 'canceled');
create type payment_kind as enum
  ('initial', 'recurring', 'refund');

-- -------------------------------------------------------------
-- 1. billing_plan — 전역 요금제 카탈로그(tenant 비종속)
--    금액은 항상 서버가 이 테이블에서 읽는다(클라이언트 요청값 불신).
-- -------------------------------------------------------------
create table billing_plan (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- 'monthly'
  name        text not null,
  amount      int not null,                         -- KRW, 원 단위 정수
  currency    text not null default 'KRW',
  interval    text not null default 'month'
    check (interval in ('month', 'year')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1차 MVP: 월간 단일 플랜
insert into billing_plan (code, name, amount, currency, interval)
values ('monthly', '관제 베이직', 49000, 'KRW', 'month');

-- -------------------------------------------------------------
-- 2. billing_customer — tenant ↔ Toss customerKey 매핑 (tenant당 1행)
--    customerKey는 우리가 발급한 불투명 식별자. 빌링키가 노출돼도
--    customerKey 없이는 결제가 불가능하므로 분리 보관한다.
-- -------------------------------------------------------------
create table billing_customer (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant (id) on delete cascade,
  toss_customer_key text not null,
  billing_email     text,
  billing_name      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id),
  unique (toss_customer_key)
);

-- -------------------------------------------------------------
-- 3. payment_method — 결제수단(빌링키). 빌링키는 AES-256-GCM 암호화 저장.
--    tenant당 active 1행(부분 unique). 카드변경 시 기존 행 status='deleted'.
-- -------------------------------------------------------------
create table payment_method (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenant (id) on delete cascade,
  billing_customer_id  uuid not null references billing_customer (id) on delete cascade,
  encrypted_billing_key text not null,              -- AES-256-GCM (iv:tag:ciphertext, base64)
  card_company         text,                        -- 발급사명/코드
  card_number_masked   text,                        -- Toss가 내려준 마스킹 번호
  card_type            text,                        -- 신용/체크/기프트
  is_default           boolean not null default true,
  status               text not null default 'active'
    check (status in ('active', 'deleted')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index payment_method_one_active_per_tenant
  on payment_method (tenant_id)
  where status = 'active';
create index payment_method_tenant_idx on payment_method (tenant_id);

-- -------------------------------------------------------------
-- 4. tenant_subscription — 구독 상태(tenant당 1행)
--    상태 전이는 서버(service_role)만. authenticated는 조회만.
-- -------------------------------------------------------------
create table tenant_subscription (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenant (id) on delete cascade,
  plan_id              uuid not null references billing_plan (id),
  payment_method_id    uuid references payment_method (id) on delete set null,
  status               subscription_status not null default 'expired',
  current_period_start timestamptz,
  current_period_end   timestamptz,                 -- = 다음 결제일
  grace_until          timestamptz,                 -- past_due 유예 만료 시각
  trial_end            timestamptz,
  canceled_at          timestamptz,                 -- 설정 시 current_period_end 이후 과금 중단
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id)
);

create index tenant_subscription_due_idx
  on tenant_subscription (status, current_period_end);

-- -------------------------------------------------------------
-- 5. payment_transaction — 결제/환불 시도 1건당 1행
--    order_id를 멱등 앵커로 사용(unique). 카드 원본정보는 저장하지 않으며
--    raw_response는 민감정보를 제외한 정제본만 적재한다.
-- -------------------------------------------------------------
create table payment_transaction (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant (id) on delete cascade,
  subscription_id   uuid references tenant_subscription (id) on delete set null,
  payment_method_id uuid references payment_method (id) on delete set null,
  kind              payment_kind not null default 'recurring',
  status            payment_status not null default 'pending',
  order_id          text not null,
  order_name        text,
  toss_payment_key  text,
  amount            int not null,
  currency          text not null default 'KRW',
  failure_code      text,
  failure_message   text,
  raw_response      jsonb,                           -- 민감정보 제외 정제본
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_id)
);

create unique index payment_transaction_payment_key_idx
  on payment_transaction (toss_payment_key)
  where toss_payment_key is not null;
create index payment_transaction_tenant_idx
  on payment_transaction (tenant_id, created_at desc);

-- -------------------------------------------------------------
-- 6. webhook_event — Toss 웹훅 멱등 로그 (service_role 전용)
--    event_key(eventId 또는 paymentKey:status) unique → 중복 수신 무시.
-- -------------------------------------------------------------
create table webhook_event (
  id           uuid primary key default gen_random_uuid(),
  event_key    text not null unique,
  event_type   text,
  order_id     text,
  payment_key  text,
  status       text,
  tenant_id    uuid references tenant (id) on delete set null,
  payload      jsonb,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------
-- updated_at 자동 갱신 (set_updated_at()는 기존 마이그레이션에서 정의됨 — 안전하게 재정의)
-- -------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger billing_plan_set_updated_at
  before update on billing_plan
  for each row execute function set_updated_at();
create trigger billing_customer_set_updated_at
  before update on billing_customer
  for each row execute function set_updated_at();
create trigger payment_method_set_updated_at
  before update on payment_method
  for each row execute function set_updated_at();
create trigger tenant_subscription_set_updated_at
  before update on tenant_subscription
  for each row execute function set_updated_at();
create trigger payment_transaction_set_updated_at
  before update on payment_transaction
  for each row execute function set_updated_at();

-- =============================================================
-- RLS
--   - billing_plan: 모든 authenticated 사용자가 카탈로그 조회(읽기 전용).
--   - billing_customer / tenant_subscription / payment_transaction:
--       자기 tenant 행 조회만. 쓰기는 service_role 전용(정책 없음 → 차단).
--   - payment_method: 자기 tenant 행 조회만 + 민감 컬럼(encrypted_billing_key)은
--       컬럼 grant에서 제외해 직접 select 불가.
--   - webhook_event: authenticated 정책 없음 → service_role 전용.
-- =============================================================
alter table billing_plan enable row level security;
alter table billing_customer enable row level security;
alter table payment_method enable row level security;
alter table tenant_subscription enable row level security;
alter table payment_transaction enable row level security;
alter table webhook_event enable row level security;

-- billing_plan: 전역 카탈로그 — 누구나(로그인) 조회, 쓰기 불가
create policy "billing_plan: 조회 전용" on billing_plan
  for select using (true);

-- billing_customer: 본인 tenant 조회만
create policy "billing_customer: tenant 조회" on billing_customer
  for select using (tenant_id = auth_tenant_id());

-- payment_method: 본인 tenant 조회만 (컬럼 grant로 빌링키 차단)
create policy "payment_method: tenant 조회" on payment_method
  for select using (tenant_id = auth_tenant_id());

-- tenant_subscription: 본인 tenant 조회만
create policy "tenant_subscription: tenant 조회" on tenant_subscription
  for select using (tenant_id = auth_tenant_id());

-- payment_transaction: 본인 tenant 조회만 (카드원본 없음)
create policy "payment_transaction: tenant 조회" on payment_transaction
  for select using (tenant_id = auth_tenant_id());

-- =============================================================
-- grant
--   authenticated에는 select만 부여(쓰기는 service_role). payment_method는
--   안전 컬럼만 select 허용 → encrypted_billing_key는 클라이언트가 읽지 못한다.
-- =============================================================
grant select on billing_plan to authenticated;
grant select on billing_customer to authenticated;
grant select on tenant_subscription to authenticated;
grant select on payment_transaction to authenticated;

-- payment_method: 테이블 단위 select 차단 후 안전 컬럼만 grant
grant select (
  id, tenant_id, billing_customer_id,
  card_company, card_number_masked, card_type,
  is_default, status, created_at, updated_at
) on payment_method to authenticated;
