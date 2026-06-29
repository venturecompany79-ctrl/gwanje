-- =============================================================
-- 자료(document)에 자격(credential) 명시 연결 컬럼 추가
-- 자격·인증 탭에서 올린 첨부 파일을 해당 자격에 1:N으로 명시 연결한다.
-- (기존 doc_category 기반의 느슨한 분류 대신, FK로 정확히 연결)
-- 자격이 삭제되면 자료는 남기되 연결만 해제(set null) — 기업 '자료' 탭에는 계속 노출.
-- =============================================================

alter table document
  add column if not exists credential_id uuid references credential (id) on delete set null;

comment on column document.credential_id is
  '연결된 자격·인증(credential). 자격 첨부로 업로드된 자료에 설정된다. 일반 자료는 null.';

-- 자격별 첨부 조회용 인덱스
create index if not exists idx_document_credential on document (credential_id);

-- RLS: 기존 "document: tenant 격리" 정책이 tenant_id 기준으로 전체를 커버하므로 추가 정책 불필요.
