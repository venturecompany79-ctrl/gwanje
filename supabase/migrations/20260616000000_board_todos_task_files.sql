-- =============================================================
-- 관리포인트 보드 개선: To-dos 일일 체크노트 + 과제 파일 메타데이터
-- =============================================================

create table if not exists todo_note (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  user_id uuid not null references profile (id) on delete cascade,
  note_date date not null,
  content text not null,
  tag text check (tag in ('업무', '미팅', '기록')),
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_file (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  task_id uuid not null references task (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references profile (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_todo_note_tenant_date
  on todo_note (tenant_id, note_date desc, sort_order asc);
create index if not exists idx_todo_note_user_date
  on todo_note (user_id, note_date desc, sort_order asc);
create index if not exists idx_task_file_task
  on task_file (task_id, created_at desc);
create index if not exists idx_task_file_tenant
  on task_file (tenant_id, created_at desc);

alter table todo_note enable row level security;
alter table task_file enable row level security;

drop policy if exists "todo_note: tenant 조회" on todo_note;
drop policy if exists "todo_note: tenant 삽입" on todo_note;
drop policy if exists "todo_note: tenant 수정" on todo_note;
drop policy if exists "todo_note: tenant 삭제" on todo_note;

create policy "todo_note: tenant 조회" on todo_note
  for select using (tenant_id = auth_tenant_id());

create policy "todo_note: tenant 삽입" on todo_note
  for insert with check (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  );

create policy "todo_note: tenant 수정" on todo_note
  for update using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

create policy "todo_note: tenant 삭제" on todo_note
  for delete using (tenant_id = auth_tenant_id());

drop policy if exists "task_file: tenant task 조회" on task_file;
drop policy if exists "task_file: tenant task 삽입" on task_file;
drop policy if exists "task_file: tenant task 수정" on task_file;
drop policy if exists "task_file: tenant task 삭제" on task_file;

create policy "task_file: tenant task 조회" on task_file
  for select using (
    tenant_id = auth_tenant_id()
    and exists (
      select 1
      from task t
      where t.id = task_file.task_id
        and t.tenant_id = auth_tenant_id()
    )
  );

create policy "task_file: tenant task 삽입" on task_file
  for insert with check (
    tenant_id = auth_tenant_id()
    and exists (
      select 1
      from task t
      where t.id = task_file.task_id
        and t.tenant_id = auth_tenant_id()
    )
  );

create policy "task_file: tenant task 수정" on task_file
  for update using (
    tenant_id = auth_tenant_id()
    and exists (
      select 1
      from task t
      where t.id = task_file.task_id
        and t.tenant_id = auth_tenant_id()
    )
  )
  with check (
    tenant_id = auth_tenant_id()
    and exists (
      select 1
      from task t
      where t.id = task_file.task_id
        and t.tenant_id = auth_tenant_id()
    )
  );

create policy "task_file: tenant task 삭제" on task_file
  for delete using (
    tenant_id = auth_tenant_id()
    and exists (
      select 1
      from task t
      where t.id = task_file.task_id
        and t.tenant_id = auth_tenant_id()
    )
  );

grant select, insert, update, delete on todo_note to authenticated;
grant select, insert, update, delete on task_file to authenticated;

create or replace function touch_todo_note_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_todo_note_updated_at on todo_note;
create trigger trg_todo_note_updated_at
before update on todo_note
for each row execute function touch_todo_note_updated_at();

create or replace function cleanup_old_todo_notes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from todo_note
  where note_date < ((now() at time zone 'Asia/Seoul')::date - interval '30 days');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function cleanup_old_todo_notes() from public, anon, authenticated;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'cleanup-old-todo-notes',
    '10 15 * * *',
    $job$select cleanup_old_todo_notes();$job$
  );
  raise notice 'pg_cron To-dos 정리 잡 등록됨 (매일 15:10 UTC = 00:10 KST)';
exception
  when others then
    raise notice 'pg_cron To-dos 정리 잡 등록 건너뜀 — Dashboard에서 pg_cron 활성화 후 수동 등록 필요: %', sqlerrm;
end
$cron$;
