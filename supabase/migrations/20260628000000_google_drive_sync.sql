-- =============================================================
-- 사용자별 Google Drive 자동 동기화
-- 기업 자료 업로드 → Supabase Storage 저장(1차 완료) 후, 연결된 사용자의
-- Google Drive로 비동기 복제한다. Drive 업로드 실패가 원본 저장 실패로
-- 이어지면 안 되므로, 별도 잡 테이블에 적재하고 워커(/api/google-drive/sync)가
-- 재시도 가능·멱등하게 처리한다.
--
-- 격리: 모든 행에 tenant_id + user_id. RLS는 authenticated 사용자가 자기
--       tenant/user 행만 보게 하고, 워커는 service_role(RLS 우회)로 처리한다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. google_drive_connections — 사용자별 OAuth 연결
--    refresh token은 앱 서버에서 AES-256-GCM으로 암호화해 저장한다(평문 금지).
--    user당 1행(unique). 재연결 시 같은 행을 갱신, 해제 시 revoked_at 기록.
-- -------------------------------------------------------------
create table google_drive_connections (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenant (id) on delete cascade,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  google_email            text,
  encrypted_refresh_token text not null,            -- AES-256-GCM (iv:tag:ciphertext, base64)
  root_folder_id          text,                     -- 앱 전용 루트 폴더 (예: "관제 자료")
  root_folder_name        text,
  connected_at            timestamptz not null default now(),
  revoked_at              timestamptz,              -- not null이면 연결 해제됨
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id)
);

create index google_drive_connections_tenant_idx
  on google_drive_connections (tenant_id);

-- -------------------------------------------------------------
-- 2. google_drive_sync_jobs — 동기화 작업 큐
--    document당 1잡(unique) → 재업로드/재시도시 멱등 적재.
--    워커는 status='pending' 이고 next_run_at <= now() 인 잡을 집어 처리.
-- -------------------------------------------------------------
create table google_drive_sync_jobs (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null references tenant (id) on delete cascade,
  user_id                    uuid not null references auth.users (id) on delete cascade,
  document_id                uuid not null references document (id) on delete cascade,
  storage_bucket             text not null,
  storage_path               text not null,
  file_name                  text not null,
  mime_type                  text,
  size_bytes                 bigint,
  status                     text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempts                   int not null default 0,
  google_drive_file_id       text,
  google_drive_web_view_link text,
  last_error                 text,
  next_run_at                timestamptz not null default now(),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (document_id)
);

-- 워커 픽업 인덱스 (pending + 실행시각)
create index google_drive_sync_jobs_due_idx
  on google_drive_sync_jobs (status, next_run_at);
create index google_drive_sync_jobs_user_idx
  on google_drive_sync_jobs (user_id);

-- updated_at 자동 갱신
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger google_drive_connections_set_updated_at
  before update on google_drive_connections
  for each row execute function set_updated_at();

create trigger google_drive_sync_jobs_set_updated_at
  before update on google_drive_sync_jobs
  for each row execute function set_updated_at();

-- -------------------------------------------------------------
-- 3. RLS — authenticated 사용자는 자기 tenant/user 행만.
--    워커는 service_role 키로 접근하므로 RLS를 우회한다(정책 불필요).
-- -------------------------------------------------------------
alter table google_drive_connections enable row level security;
alter table google_drive_sync_jobs enable row level security;

-- 연결: 본인 것만 조회/생성/수정/삭제 (tenant + user 동시 일치)
create policy "google_drive_connections: 본인만" on google_drive_connections
  for all
  using (tenant_id = auth_tenant_id() and user_id = auth.uid())
  with check (tenant_id = auth_tenant_id() and user_id = auth.uid());

-- 잡: 본인 것만 조회/생성 (상태 갱신은 워커=service_role가 담당).
--     UI는 진행상태 표시·재적재(enqueue)만 하므로 select/insert면 충분.
create policy "google_drive_sync_jobs: 본인 조회" on google_drive_sync_jobs
  for select
  using (tenant_id = auth_tenant_id() and user_id = auth.uid());

create policy "google_drive_sync_jobs: 본인 생성" on google_drive_sync_jobs
  for insert
  with check (tenant_id = auth_tenant_id() and user_id = auth.uid());
