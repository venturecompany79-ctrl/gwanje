-- =============================================================
-- 체험 계정 프로비저닝 (빈 워크스페이스 버전) — 데모 데이터 없음
-- tenant + profile 만 생성. 잠재고객이 직접 입력해보는 "빈 화면" 체험용.
--
-- 사용:
--   1) 아래 v_email 을 새 체험 계정 이메일로 변경.
--   2) Supabase → Authentication → Users → Add user
--        Email: (위와 동일)  Password: 원하는 값  ✅ Auto Confirm User
--   3) 이 스크립트를 SQL Editor 에서 실행 → '빈 워크스페이스 생성 완료' notice 확인.
--
-- 단일 트랜잭션. 멱등: 이미 데이터가 있으면 중복 방지로 중단.
-- ※ 데모 데이터가 필요하면 scripts/provision-trial-account.sql 사용.
-- =============================================================

begin;

do $prov$
declare
  v_email     text := 'CHANGE_ME@example.com';   -- ★ 새 체험 계정 이메일로 변경
  v_user_id   uuid;
  v_tenant_id uuid;
  v_existing  uuid;
begin
  -- 0) 대상 유저 확인 (대시보드에서 먼저 생성했어야 함). 플레이스홀더 그대로면 아래에서 중단됨.
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception '계정 % 없음 — 대시보드 Authentication 에서 먼저 생성(Auto Confirm)하세요.', v_email;
  end if;

  -- 1) 멱등 가드 — 이미 데이터가 있으면 중단
  select tenant_id into v_existing from profile where id = v_user_id;
  if v_existing is not null then
    if exists (select 1 from company where tenant_id = v_existing) then
      raise exception '이미 데이터가 있는 계정(tenant=%) — 중복 방지 위해 중단', v_existing;
    end if;
    v_tenant_id := v_existing;  -- 프로필만 있고 비어있으면 재사용
  end if;

  -- 2) 워크스페이스(tenant) + 프로필 (데이터는 만들지 않음)
  if v_tenant_id is null then
    insert into tenant (name) values ('체험 컨설팅') returning id into v_tenant_id;
  end if;

  insert into profile (id, tenant_id, name, title, email, sender_name)
  values (v_user_id, v_tenant_id, '체험 컨설턴트', '경영컨설턴트', v_email, '체험 컨설팅')
  on conflict (id) do update set tenant_id = excluded.tenant_id;

  -- (선택) 분류 5종이 필요하면 아래 주석을 해제. 완전 빈 상태면 그대로 둔다.
  -- insert into category (tenant_id, name, sort_order) values
  --   (v_tenant_id, '정부지원사업', 1), (v_tenant_id, '벤처기업확인', 2),
  --   (v_tenant_id, '기업부설연구소', 3), (v_tenant_id, '세액공제', 4),
  --   (v_tenant_id, '정책자금', 5);

  raise notice '빈 워크스페이스 생성 완료 — % / tenant=% (데이터 0건)', v_email, v_tenant_id;
end
$prov$;

commit;
