-- =============================================================
-- 1) todo_note 구 태그 백필 — 웹은 구 태그를 숨기고(null 처리) 모바일은
--    원문을 그대로 보여줘 같은 노트가 화면마다 다르게 보인다.
--    신 어휘로 백필해 표시 불일치를 없앤다:
--      업무 → 기타 (일반 업무 메모)
--      기록 → 서류 (문서·기록성 메모)
--    CHECK 축소(contract)는 구 코드가 완전히 내려간 뒤 별도 마이그레이션으로.
--
-- 2) 성능 인덱스 — 대시보드 최근자료·캠페인 목록이 tenant 내
--    created_at desc 정렬을 쓰지만 커버링 인덱스가 없었다.
-- =============================================================

update todo_note set tag = '기타' where tag = '업무';
update todo_note set tag = '서류' where tag = '기록';

create index if not exists idx_document_tenant_created
  on document (tenant_id, created_at desc);

create index if not exists idx_campaign_tenant_created
  on campaign (tenant_id, created_at desc);
