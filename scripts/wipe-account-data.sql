-- =============================================================
-- 계정 데이터 비우기 (범용·이메일 기준) — beta-reset.sql 패턴
-- 지정 이메일 계정의 운영 데이터 + 카테고리를 전부 삭제. 계정은 유지
-- (auth.users / profile / tenant 보존 → 로그인·빈화면 체험 가능).
--
-- 사용: 아래 v_email 을 대상 계정으로 변경 후 Supabase SQL Editor 에서 실행.
-- ⚠️ 파괴적. 단일 트랜잭션 — 검증 실패 시 rollback. 멱등(재실행 안전).
-- 스토리지(company-documents) 파일은 직접 DELETE 불가 → Storage API/대시보드 별도 정리.
-- =============================================================

begin;

do $wipe$
declare
  v_email   text := 'CHANGE_ME@example.com';   -- ★ 데이터를 비울 대상 계정 이메일
  v_user    uuid;
  v_tenant  uuid;
  v_others  int;
  v_remain  int;
begin
  -- 0) 대상 식별 (이메일 → user → tenant). 플레이스홀더 그대로면 아래 '계정 없음'에서 중단됨.
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception '계정 % 없음 — 중단', v_email;
  end if;
  select tenant_id into v_tenant from profile where id = v_user;
  if v_tenant is null then
    raise exception 'profile/tenant 없음(user=%) — 중단', v_user;
  end if;

  -- 0-1) 같은 tenant 에 다른 사용자가 있으면 그들의 데이터도 지워진다 → 경고
  select count(*) into v_others from profile where tenant_id = v_tenant and id <> v_user;
  if v_others > 0 then
    raise notice '경고: tenant % 에 다른 사용자 %명 존재 — 그들의 데이터도 함께 삭제됨', v_tenant, v_others;
  end if;

  raise notice '대상 user=% tenant=% — 삭제 시작', v_user, v_tenant;

  -- 1) 삭제 — 자식 → 부모 순. 전부 tenant_id 범위.
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

  -- 2) 검증 — 운영 테이블 잔여 0 이어야. 아니면 rollback.
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

  -- 3) 계정 유지 확인
  if not exists (select 1 from profile where id = v_user and tenant_id = v_tenant) then
    raise exception '계정/프로파일이 사라짐 — rollback';
  end if;

  raise notice '검증 통과 — 운영 데이터/카테고리 0건, 계정(% / tenant %) 유지', v_email, v_tenant;
end
$wipe$;

commit;
