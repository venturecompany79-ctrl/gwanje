-- =============================================================
-- F9: 자격 1건당 갱신 과제 1건 보장 (동시요청 경합 방어)
-- 앱의 read-then-write 중복 가드는 더블클릭/멀티탭 경합에 취약하므로
-- DB 부분 유니크 인덱스로 1:1을 강제한다. 경합 시 두 번째 insert는
-- 23505로 실패하고, 액션이 "이미 갱신 과제가 있습니다"로 변환한다.
-- (source_credential_id가 null인 일반 과제는 제약 대상 아님)
-- =============================================================

create unique index if not exists task_source_credential_unique
  on task (source_credential_id)
  where source_credential_id is not null;
