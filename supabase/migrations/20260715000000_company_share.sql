-- =============================================================
-- 기업별 공유 대시보드: 고객사 대표용 공개 링크 + 비밀번호 게이트
-- 대표는 Supabase 계정 없이 /share/<token> + 본인이 설정한 비밀번호로 입장.
-- anon RLS 정책은 만들지 않는다 — 공개 페이지는 service role로 서버 렌더하고
-- 코드에서 share 행 기준으로 tenant/company 스코프를 강제한다(lib/data/company-share.ts).
-- =============================================================

create table if not exists company_share (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenant (id) on delete cascade,
  company_id       uuid not null references company (id) on delete cascade,
  token            text not null,                -- URL용 원문 토큰 (randomBytes(32) base64url, 256bit)
  password_hash    text,                         -- scrypt 직렬화 문자열. null = 대표가 아직 미설정
  password_set_at  timestamptz,
  enabled          boolean not null default true,
  failed_attempts  int not null default 0,       -- 비밀번호 오입력 누적 (성공 시 리셋)
  locked_until     timestamptz,                  -- 5회 실패 시 now()+10분
  session_version  int not null default 1,       -- 링크 재발급/비번 초기화 시 +1 → 기존 쿠키 일괄 무효
  rotated_at       timestamptz,                  -- 마지막 링크 재발급 시각
  created_by       uuid references profile (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id),                           -- 기업당 공유 1개
  unique (token)
);

create index if not exists idx_company_share_tenant
  on company_share (tenant_id);

alter table company_share enable row level security;

-- 컨설턴트(같은 테넌트)만 관리 — 공개 접근은 service role 경유이므로 anon 정책 없음
drop policy if exists "company_share: 테넌트 격리" on company_share;
create policy "company_share: 테넌트 격리" on company_share
  for all using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

grant select, insert, update, delete on company_share to authenticated;
revoke all on company_share from anon;

-- updated_at 자동 갱신 — 기존 범용 함수 재사용 (20260628 google_drive_sync에서 최초 정의)
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists company_share_set_updated_at on company_share;
create trigger company_share_set_updated_at
before update on company_share
for each row execute function set_updated_at();

-- 비밀번호 오입력 기록 — 원자적 증가(read-modify-write 레이스 방지).
-- 앱 레벨 +1은 병렬 요청이 같은 값을 읽어 5회 잠금 임계를 우회할 수 있고,
-- 스테일 쓰기가 방금 걸린 잠금을 지울 수 있어 DB 측 단일 UPDATE로 처리한다.
-- 잠금 정책: 5회 실패 → 10분 잠금. 잠금 만료 후 첫 실패는 카운터를 1로 리셋
-- (리셋 없으면 만료 후 1회 오입력마다 즉시 재잠금되는 스파이럴 발생).
create or replace function company_share_record_failure(p_share_id uuid)
returns table (out_failed_attempts int, out_locked_until timestamptz)
language plpgsql
as $$
begin
  return query
  update company_share s
  set
    failed_attempts = case
      when s.locked_until is not null and s.locked_until <= now() then 1
      else s.failed_attempts + 1
    end,
    locked_until = case
      when s.locked_until is not null and s.locked_until <= now() then null
      when s.failed_attempts + 1 >= 5 then now() + interval '10 minutes'
      else s.locked_until
    end
  where s.id = p_share_id
  returning s.failed_attempts, s.locked_until;
end;
$$;

-- service role 전용 — 공개 경로에서 호출되므로 다른 롤의 실행 권한 제거
revoke all on function company_share_record_failure(uuid) from public, anon, authenticated;
