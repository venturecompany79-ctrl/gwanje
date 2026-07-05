-- =============================================================
-- 누락된 외래키 인덱스 보강 (코드리뷰 P3)
--
-- company/task/profile 삭제 시 cascade·set null 대상 자식 테이블이 seq scan 하던
-- 컬럼과, 조회 필터로 쓰이는 FK 컬럼에 btree 인덱스를 추가한다. 순수 추가라
-- 기존 동작에 영향 없음.
-- =============================================================

-- company 삭제 cascade / 캠페인 상세의 company 조인
create index if not exists idx_recipient_company
  on campaign_recipient (company_id);

-- company 삭제 cascade / 기업별 일정 조회
create index if not exists idx_schedule_company
  on schedule (company_id);

-- task 삭제 set null / 일정-과제 역참조
create index if not exists idx_schedule_related_task
  on schedule (related_task_id);

-- profile 삭제 set null / 담당자별 과제 조회
create index if not exists idx_task_assignee
  on task (assignee_id);

-- company 삭제 cascade / 기업별 알림 필터
create index if not exists idx_notification_company
  on notification (company_id);

-- 일일 알림 크론(generate_due_notifications)의 NOT EXISTS 검사 + 알림센터 ref 역참조
create index if not exists idx_notification_ref
  on notification (ref_table, ref_id, created_at desc);
