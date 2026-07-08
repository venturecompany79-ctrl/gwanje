-- =============================================================
-- Meeting report generation
-- 기업 자료 2종(회사정보 + 회의록)을 바탕으로 AI 보고서를 비동기로 생성한다.
-- 원본 자료는 document/Supabase Storage를 그대로 사용하고, 생성된 DOCX도
-- document에 "보고서" 분류로 보관한다.
-- =============================================================

do $$
begin
  create type meeting_report_status as enum (
    'pending',
    'processing',
    'succeeded',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type meeting_report_source_role as enum (
    'company_info',
    'meeting_note'
  );
exception when duplicate_object then null;
end $$;

create table if not exists meeting_report (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant (id) on delete cascade,
  company_id         uuid not null references company (id) on delete cascade,
  requested_by       uuid references profile (id) on delete set null,
  title              text not null,
  status             meeting_report_status not null default 'pending',
  attempts           int not null default 0 check (attempts >= 0),
  model              text,
  report_json        jsonb,
  summary            text,
  output_document_id uuid references document (id) on delete set null,
  last_error         text,
  next_run_at        timestamptz not null default now(),
  generated_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint meeting_report_tenant_company_fk
    foreign key (tenant_id, company_id)
    references company (tenant_id, id)
    on delete cascade
);

create table if not exists meeting_report_source (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  company_id  uuid not null references company (id) on delete cascade,
  report_id   uuid not null references meeting_report (id) on delete cascade,
  document_id uuid not null references document (id) on delete cascade,
  role        meeting_report_source_role not null,
  created_at  timestamptz not null default now(),
  constraint meeting_report_source_report_role_uniq unique (report_id, role),
  constraint meeting_report_source_tenant_company_fk
    foreign key (tenant_id, company_id)
    references company (tenant_id, id)
    on delete cascade
);

create index if not exists idx_meeting_report_company_created
  on meeting_report (tenant_id, company_id, created_at desc);
create index if not exists idx_meeting_report_due
  on meeting_report (status, next_run_at);
create index if not exists idx_meeting_report_source_report
  on meeting_report_source (report_id);
create index if not exists idx_meeting_report_source_document
  on meeting_report_source (document_id);
create unique index if not exists document_tenant_company_id_uniq
  on document (tenant_id, company_id, id);
create unique index if not exists meeting_report_tenant_company_id_uniq
  on meeting_report (tenant_id, company_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_report_source_report_tenant_company_fk'
      and conrelid = 'meeting_report_source'::regclass
  ) then
    alter table meeting_report_source
      add constraint meeting_report_source_report_tenant_company_fk
      foreign key (tenant_id, company_id, report_id)
      references meeting_report (tenant_id, company_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'meeting_report_source_document_tenant_company_fk'
      and conrelid = 'meeting_report_source'::regclass
  ) then
    alter table meeting_report_source
      add constraint meeting_report_source_document_tenant_company_fk
      foreign key (tenant_id, company_id, document_id)
      references document (tenant_id, company_id, id)
      on delete cascade;
  end if;
end $$;

drop trigger if exists meeting_report_set_updated_at on meeting_report;
create trigger meeting_report_set_updated_at
  before update on meeting_report
  for each row execute function set_updated_at();

alter table meeting_report enable row level security;
alter table meeting_report_source enable row level security;

drop policy if exists "meeting_report: 조회" on meeting_report;
drop policy if exists "meeting_report: 생성" on meeting_report;
drop policy if exists "meeting_report: 수정" on meeting_report;
drop policy if exists "meeting_report: 삭제" on meeting_report;

create policy "meeting_report: 조회" on meeting_report
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "meeting_report: 생성" on meeting_report
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "meeting_report: 수정" on meeting_report
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "meeting_report: 삭제" on meeting_report
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );

drop policy if exists "meeting_report_source: 조회" on meeting_report_source;
drop policy if exists "meeting_report_source: 생성" on meeting_report_source;
drop policy if exists "meeting_report_source: 삭제" on meeting_report_source;

create policy "meeting_report_source: 조회" on meeting_report_source
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "meeting_report_source: 생성" on meeting_report_source
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "meeting_report_source: 삭제" on meeting_report_source
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
