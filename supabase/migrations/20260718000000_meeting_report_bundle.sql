-- 미팅 보고서 전체본/요약본 묶음 및 복수 기업자료 지원
--
-- output_document_id는 기존 전체본(legacy) 참조로 유지하고, 요약본은 별도
-- document/json 참조를 둔다. 소스는 동일 문서를 중복 사용할 수 없으며
-- 회의록은 보고서당 최대 1개, 기업자료는 최대 5개로 제한한다.

alter table meeting_report
  add column if not exists summary_output_document_id uuid,
  add column if not exists summary_report_json jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_report_summary_output_document_id_fkey'
      and conrelid = 'meeting_report'::regclass
  ) then
    alter table meeting_report
      add constraint meeting_report_summary_output_document_id_fkey
      foreign key (summary_output_document_id)
      references document (id)
      on delete set null;
  end if;
end $$;

-- 기존 제약은 role별 1개만 허용해 company_info 복수 선택을 막았다.
alter table meeting_report_source
  drop constraint if exists meeting_report_source_report_role_uniq;
-- docs/schema.sql을 직접 적용한 기존 환경에서 생성될 수 있는 기본 이름도 정리한다.
alter table meeting_report_source
  drop constraint if exists meeting_report_source_report_id_role_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_report_source_report_document_uniq'
      and conrelid = 'meeting_report_source'::regclass
  ) then
    alter table meeting_report_source
      add constraint meeting_report_source_report_document_uniq
      unique (report_id, document_id);
  end if;
end $$;

create unique index if not exists meeting_report_source_one_meeting_note_idx
  on meeting_report_source (report_id)
  where role = 'meeting_note'::meeting_report_source_role;

-- 부모 보고서 행을 잠가 동시 INSERT에서도 company_info 5개 상한을 보장한다.
-- 최소 1개 company_info와 정확히 1개 meeting_note는 pending 보고서를 먼저 만든 뒤
-- 소스를 적재하는 생성 흐름 때문에 트랜잭션 간 제약으로 강제할 수 없으며, 생성 액션이
-- 필수 입력을 검증한다. DB는 가능한 상한/유일성/중복 제약을 담당한다.
create or replace function enforce_meeting_report_company_info_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_info_count int;
begin
  if new.role <> 'company_info'::meeting_report_source_role then
    return new;
  end if;

  perform 1
  from meeting_report
  where id = new.report_id
  for update;

  select count(*)::int
  into v_company_info_count
  from meeting_report_source
  where report_id = new.report_id
    and role = 'company_info'::meeting_report_source_role
    and id <> new.id;

  if v_company_info_count >= 5 then
    raise exception '미팅 보고서의 기업자료는 최대 5개까지 연결할 수 있습니다.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function enforce_meeting_report_company_info_limit()
  from public, anon, authenticated;

drop trigger if exists meeting_report_source_company_info_limit
  on meeting_report_source;
create trigger meeting_report_source_company_info_limit
  before insert or update of report_id, role
  on meeting_report_source
  for each row execute function enforce_meeting_report_company_info_limit();

-- authenticated 사용자가 직접 REST를 호출하더라도 Drive 백업 대상을 다른
-- 팀원으로 지정하거나 생성 후 바꿀 수 없게 요청자를 서버의 auth.uid()로 고정한다.
create or replace function enforce_meeting_report_requester()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  -- service_role 워커는 auth.uid()가 null이며 RLS도 우회하므로 기존 값을 보존한다.
  if v_user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.requested_by := v_user_id;
  elsif new.requested_by is distinct from old.requested_by then
    raise exception '보고서 요청자는 변경할 수 없습니다.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_report_enforce_requester on meeting_report;
create trigger meeting_report_enforce_requester
  before insert or update of requested_by
  on meeting_report
  for each row execute function enforce_meeting_report_requester();

drop policy if exists "meeting_report: 생성" on meeting_report;
create policy "meeting_report: 생성" on meeting_report
  for insert with check (
    tenant_id = (select auth_tenant_id())
    and (select auth_has_permission('companies.write'))
    and requested_by = (select auth.uid())
  );

comment on column meeting_report.output_document_id is
  '전체본 DOCX document 참조(기존 보고서와의 호환 필드)';
comment on column meeting_report.summary_output_document_id is
  '요약본 DOCX document 참조';
comment on column meeting_report.summary_report_json is
  '요약본 DOCX 렌더링에 사용한 구조화 JSON';

-- 보고서 생성 화면에서 직접 업로드할 수 있는 텍스트 기반 소스 형식을
-- 애플리케이션 허용목록뿐 아니라 Storage 버킷에도 동일하게 반영한다.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx'
]
where id = 'company-documents';
