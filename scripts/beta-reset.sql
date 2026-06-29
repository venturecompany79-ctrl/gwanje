-- =============================================================
-- 베타테스트 초기화 — admin@gwanje.com 운영 데이터 + 카테고리 전체 삭제
-- (계정 유지: auth.users / profile / tenant 는 남겨 로그인·빈화면 테스트 가능)
--
-- ⚠️ 파괴적 SQL. migrations/ 가 아니라 scripts/ 에 두어 `supabase db push`로
--    자동 실행되지 않는다. 운영자가 Supabase SQL Editor(또는 psql)에서 수동 실행.
--    전체가 단일 트랜잭션 — 실패/검증불통과 시 rollback 된다.
--
-- 범위(2026-06-21 승인): 운영 데이터 + category 삭제, 계정만 유지.
--   삭제 대상 테이블(전부 tenant 범위):
--     task_file, campaign_recipient, todo_note, notification, document,
--     schedule, task, credential, campaign, rule, company, category
--   유지: auth.users(admin@gwanje.com), profile, tenant
--   스토리지(company-documents) 파일은 직접 DELETE 불가 → Storage API 로 별도 정리.
-- =============================================================

-- 사전 확인(권장) — 트랜잭션 실행 전 따로 한 번 돌려 대상 tenant·건수 눈으로 검증:
--   select u.id user_id, p.tenant_id
--     from auth.users u join profile p on p.id = u.id
--    where lower(u.email) = lower('admin@gwanje.com');

begin;

do $reset$
declare
  v_email   text := 'admin@gwanje.com';   -- 대상 계정
  v_user    uuid;
  v_tenant  uuid;
  v_others  int;
  v_remain  int;
begin
  -- 0) 대상 식별 (이메일 → user → tenant). 없으면 즉시 중단.
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception '계정 % 없음 — 중단', v_email;
  end if;
  select tenant_id into v_tenant from profile where id = v_user;
  if v_tenant is null then
    raise exception 'profile/tenant 없음(user=%) — 중단', v_user;
  end if;

  -- 0-1) 같은 tenant 에 다른 사용자가 있으면 그들의 데이터도 지워진다 → 경고.
  --      단일 컨설턴트 MVP 가정상 0 이어야 정상.
  select count(*) into v_others from profile where tenant_id = v_tenant and id <> v_user;
  if v_others > 0 then
    raise notice '경고: tenant % 에 다른 사용자 %명 존재 — 그들의 데이터도 함께 삭제됨', v_tenant, v_others;
  end if;

  raise notice '대상 user=% tenant=% — 삭제 시작', v_user, v_tenant;

  -- 1) 삭제 — 자식 → 부모 순. 전부 tenant_id 범위. cascade 도 있으나 명시 삭제로 확실히.
  delete from task_file          where tenant_id = v_tenant;
  delete from campaign_recipient where tenant_id = v_tenant;
  delete from todo_note          where tenant_id = v_tenant;
  delete from notification       where tenant_id = v_tenant;
  delete from document           where tenant_id = v_tenant;
  delete from schedule           where tenant_id = v_tenant;
  delete from task               where tenant_id = v_tenant;
  delete from credential         where tenant_id = v_tenant;
  delete from campaign           where tenant_id = v_tenant;
  delete from rule               where tenant_id = v_tenant;
  delete from company            where tenant_id = v_tenant;
  delete from category           where tenant_id = v_tenant;

  -- 2) (스토리지) — storage.objects 직접 DELETE 는 Supabase 가 트리거로 차단한다.
  --    DB row(document) 삭제만으로 UI 에는 노출되지 않으므로 베타테스트엔 충분.
  --    버킷 'company-documents' 의 잔여 파일은 Storage API 로 별도 정리한다
  --    (scripts/beta-reset-storage.mjs 또는 대시보드 Storage). 경로: {tenant_id}/...

  -- 3) 검증 — 운영 테이블 잔여 0 이어야. 아니면 rollback.
  select
      (select count(*) from task_file          where tenant_id = v_tenant)
    + (select count(*) from campaign_recipient where tenant_id = v_tenant)
    + (select count(*) from todo_note          where tenant_id = v_tenant)
    + (select count(*) from notification       where tenant_id = v_tenant)
    + (select count(*) from document           where tenant_id = v_tenant)
    + (select count(*) from schedule           where tenant_id = v_tenant)
    + (select count(*) from task               where tenant_id = v_tenant)
    + (select count(*) from credential         where tenant_id = v_tenant)
    + (select count(*) from campaign           where tenant_id = v_tenant)
    + (select count(*) from rule               where tenant_id = v_tenant)
    + (select count(*) from company            where tenant_id = v_tenant)
    + (select count(*) from category           where tenant_id = v_tenant)
    into v_remain;

  if v_remain <> 0 then
    raise exception '검증 실패: 잔여 % 건 — rollback', v_remain;
  end if;

  -- 4) 계정 유지 확인
  if not exists (select 1 from profile where id = v_user and tenant_id = v_tenant) then
    raise exception '계정/프로파일이 사라짐 — rollback';
  end if;

  raise notice '검증 통과 — 운영 데이터/카테고리 0건, 계정(% / tenant %) 유지', v_email, v_tenant;
end
$reset$;

commit;
