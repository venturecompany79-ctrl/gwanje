-- =============================================================
-- GWJ-027 운영 데이터 정리 (승인 확정본)
-- ⚠️ 파괴적 SQL. migrations/ 가 아니라 scripts/ 에 두어 `supabase db push`로
--    자동 실행되지 않는다. 승인 후 운영자가 Supabase SQL Editor(또는 psql)에서
--    수동 실행한다. 전체가 단일 트랜잭션이며, 실패 시 rollback 된다.
--
-- 승인 내용 (2026-06-20):
--   1) 테스트 과제 '테스트' 완전 삭제
--   2) 중복 기업 병합: '유니콘 파트너스'(유지) ← '유니콘파트너스'(삭제), 연결 데이터 이전
--
-- 대상 ID (audit-test-data.mjs 결과):
--   test_task   = ebbbd37d-ee65-45ed-86be-c523ca3419e2
--   keeper(유지) = f9d46b10-d33c-439e-9cd2-1da63639a1a1  (유니콘 파트너스)
--   loser(삭제)  = cb447982-1a77-46b7-95f4-ebb0ac55bd75  (유니콘파트너스)
-- =============================================================

-- 0) 실행 전 사전 확인 — 아래 SELECT 를 먼저 따로 돌려 대상이 맞는지 눈으로 검증한다.
--    (트랜잭션 안에서도 실행되지만, 사전에 별도로 확인할 것을 권장)
--   select id, title, stage, due_date from task
--     where id = 'ebbbd37d-ee65-45ed-86be-c523ca3419e2';
--   select id, name, biz_no from company
--     where id in ('f9d46b10-d33c-439e-9cd2-1da63639a1a1',
--                  'cb447982-1a77-46b7-95f4-ebb0ac55bd75');

begin;

-- 0-1) 사전 guard — 대상 ID가 기대한 레코드인지 확인(ID 재사용으로 인한 오삭제/오병합 방지).
--      대상이 이미 정리돼 없으면 통과(멱등). 이름이 다르면 즉시 중단(rollback).
do $guard$
declare
  v_task_title  text;
  v_keeper_name text;
  v_loser_name  text;
begin
  select title into v_task_title from task
    where id = 'ebbbd37d-ee65-45ed-86be-c523ca3419e2';
  select name into v_keeper_name from company
    where id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1';
  select name into v_loser_name from company
    where id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';

  if v_task_title is not null and v_task_title <> '테스트' then
    raise exception 'GWJ-027 guard: 삭제 대상 과제 이름 불일치(%) — 중단', v_task_title;
  end if;
  if v_keeper_name is not null and v_keeper_name <> '유니콘 파트너스' then
    raise exception 'GWJ-027 guard: keeper 이름 불일치(%) — 중단', v_keeper_name;
  end if;
  if v_loser_name is not null and v_loser_name <> '유니콘파트너스' then
    raise exception 'GWJ-027 guard: loser 이름 불일치(%) — 중단', v_loser_name;
  end if;
end
$guard$;

-- 1) 테스트 과제 삭제
delete from task
where id = 'ebbbd37d-ee65-45ed-86be-c523ca3419e2';

-- 2) 중복 기업 병합 — loser 의 모든 연결 데이터를 keeper 로 이전
--    company 를 참조하는 전 테이블(credential/task/schedule/document/
--    campaign_recipient/notification). loser 가 비어 있는 테이블은 0건 no-op.
update credential        set company_id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1'
  where company_id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';
update task              set company_id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1'
  where company_id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';
update schedule          set company_id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1'
  where company_id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';
update document          set company_id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1'
  where company_id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';
update campaign_recipient set company_id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1'
  where company_id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';
update notification      set company_id = 'f9d46b10-d33c-439e-9cd2-1da63639a1a1'
  where company_id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';

-- 3) 빈 loser 기업 삭제 (연결 데이터가 모두 이전된 뒤)
delete from company
where id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';

-- 4) 검증 — 아래는 모두 0 이어야 한다. 0 이 아니면 rollback 한다.
--    (psql 사용 시 \gset 등으로 확인, SQL Editor 사용 시 결과 확인)
do $verify$
declare
  v_task   integer;
  v_loser  integer;
begin
  select count(*) into v_task  from task
    where id = 'ebbbd37d-ee65-45ed-86be-c523ca3419e2';
  select count(*) into v_loser from company
    where id = 'cb447982-1a77-46b7-95f4-ebb0ac55bd75';
  if v_task <> 0 or v_loser <> 0 then
    raise exception 'GWJ-027 검증 실패: test_task=% loser_company=% (rollback)', v_task, v_loser;
  end if;
  raise notice 'GWJ-027 정리 검증 통과 — 테스트 과제 삭제·중복 기업 병합 완료';
end
$verify$;

commit;
