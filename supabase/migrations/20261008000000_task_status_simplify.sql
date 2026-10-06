-- =============================================================
-- Task 단순화: 보류(on_hold) → 대기(waiting) 통합 + 미배정 담당자 백필
-- 단계(stage) 컬럼·enum 값은 남겨 둔다(화면에서만 제거, 되돌릴 수 있게).
-- 데이터만 바꾸므로 이전 배포 코드와도 호환된다.
-- =============================================================

update task
set work_status = 'waiting'
where work_status = 'on_hold';

-- 혼자 쓰는 워크스페이스에서 "미배정"이 위험으로 잡히지 않도록
-- 기업 주담당 컨설턴트를 담당자로 채운다. (새 Task는 작성자가 자동 배정됨)
update task t
set assignee_id = c.primary_consultant_id
from company c
where c.id = t.company_id
  and t.assignee_id is null
  and c.primary_consultant_id is not null;

comment on column task.work_status is
  '업무 상태: planned(할 일)/in_progress(진행중)/waiting(대기)/completed(완료). on_hold는 waiting에 통합되어 더 이상 쓰지 않는다.';
