-- =============================================================
-- F8: profile RLS 강화 — tenant_id 자가 변경/임의 INSERT 차단
-- 기존 정책은 `for all using(id=auth.uid()) with check(id=auth.uid())`라
-- 인증 사용자가 PostgREST로 자기 profile의 tenant_id를 임의 값으로 UPDATE하거나
-- profile을 임의 tenant_id로 INSERT할 수 있었다(멀티테넌트 개방 시 데이터 격리 우회).
--
-- 조치:
--  1) INSERT/DELETE 정책 제거 + authenticated의 insert/delete 권한 회수
--     (profile 생성은 seed.sql의 do-block = postgres 권한으로만 — RLS 우회)
--  2) UPDATE를 안전 컬럼으로만 한정(컬럼 권한). id·tenant_id는 변경 불가.
--     (auth_tenant_id()가 같은 트랜잭션 내 변경값을 보는 순환을 피하려고
--      with check 대신 컬럼 권한으로 tenant_id를 잠근다.)
-- =============================================================

drop policy if exists "profile: 본인만" on profile;

create policy "profile: 조회 본인만" on profile
  for select using (id = auth.uid());

create policy "profile: 수정 본인만" on profile
  for update using (id = auth.uid()) with check (id = auth.uid());

-- INSERT/DELETE 정책 없음 → authenticated에게는 거부됨
revoke insert, update, delete on profile from authenticated;

-- UPDATE는 사용자가 설정 화면에서 바꾸는 컬럼만 허용 (id·tenant_id 제외)
grant update (
  name, title, phone, email,
  notify_lead_days, notify_channels, notify_match, daily_summary_at,
  sender_name, sender_phone
) on profile to authenticated;
