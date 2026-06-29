-- =============================================================
-- 팀원 초대·권한 관리 + 업무일지 개인/owner 조회 권한
-- =============================================================

alter table profile
  add column if not exists role text not null default 'owner',
  add column if not exists permissions text[] not null default array[
    'companies.read',
    'companies.write',
    'tasks.read',
    'tasks.write',
    'campaigns.read',
    'campaigns.write',
    'notifications.read',
    'settings.categories.write',
    'settings.rules.write',
    'settings.drive.write',
    'billing.manage'
  ]::text[],
  add column if not exists status text not null default 'active',
  add column if not exists invited_by uuid references profile (id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists disabled_at timestamptz;

alter table profile
  drop constraint if exists profile_role_check,
  add constraint profile_role_check
    check (role in ('owner', 'manager', 'member', 'viewer'));

alter table profile
  drop constraint if exists profile_status_check,
  add constraint profile_status_check
    check (status in ('invited', 'active', 'disabled'));

alter table profile
  drop constraint if exists profile_permissions_check,
  add constraint profile_permissions_check
    check (permissions <@ array[
      'companies.read',
      'companies.write',
      'tasks.read',
      'tasks.write',
      'campaigns.read',
      'campaigns.write',
      'notifications.read',
      'settings.categories.write',
      'settings.rules.write',
      'settings.drive.write',
      'billing.manage'
    ]::text[]);

update profile
set
  role = coalesce(role, 'owner'),
  status = coalesce(status, 'active'),
  permissions = case
    when permissions is null or array_length(permissions, 1) is null then array[
      'companies.read',
      'companies.write',
      'tasks.read',
      'tasks.write',
      'campaigns.read',
      'campaigns.write',
      'notifications.read',
      'settings.categories.write',
      'settings.rules.write',
      'settings.drive.write',
      'billing.manage'
    ]::text[]
    else permissions
  end;

create index if not exists idx_profile_tenant_status
  on profile (tenant_id, status, role);
create index if not exists idx_profile_email_lower
  on profile (tenant_id, lower(email));

create or replace function app_permission_keys()
returns text[]
language sql immutable
as $$
  select array[
    'companies.read',
    'companies.write',
    'tasks.read',
    'tasks.write',
    'campaigns.read',
    'campaigns.write',
    'notifications.read',
    'settings.categories.write',
    'settings.rules.write',
    'settings.drive.write',
    'billing.manage'
  ]::text[];
$$;

-- 활성 사용자만 tenant 데이터에 접근한다. invited/disabled는 초대 수락 화면 외 접근 차단.
create or replace function auth_tenant_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id
  from profile
  where id = auth.uid()
    and status = 'active';
$$;

create or replace function auth_member_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role
  from profile
  where id = auth.uid()
    and status = 'active';
$$;

create or replace function auth_is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(auth_member_role() = 'owner', false);
$$;

create or replace function auth_has_permission(permission_key text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from profile
    where id = auth.uid()
      and status = 'active'
      and (
        role = 'owner'
        or permission_key = any (permissions)
      )
  );
$$;

-- profile: 본인은 항상 조회, 활성 팀원은 같은 tenant의 팀원 기본정보 조회,
-- owner는 disabled 포함 팀원 관리 조회 가능. 변경은 service_role 서버 액션 담당.
drop policy if exists "profile: 조회 본인만" on profile;
drop policy if exists "profile: 수정 본인만" on profile;
drop policy if exists "profile: 본인만" on profile;
drop policy if exists "profile: 팀 조회" on profile;
drop policy if exists "profile: 본인 수정" on profile;

create policy "profile: 팀 조회" on profile
  for select using (
    id = auth.uid()
    or (
      tenant_id = auth_tenant_id()
      and (
        status <> 'disabled'
        or auth_is_owner()
      )
    )
  );

create policy "profile: 본인 수정" on profile
  for update using (id = auth.uid() and status = 'active')
  with check (id = auth.uid() and status = 'active');

revoke insert, update, delete on profile from authenticated;
grant update (
  name, title, phone, email,
  notify_lead_days, notify_channels, notify_match, daily_summary_at,
  sender_name, sender_phone
) on profile to authenticated;

-- 권한 기반 RLS 재정의
drop policy if exists "category: tenant 격리" on category;
create policy "category: 조회" on category
  for select using (
    tenant_id = auth_tenant_id()
    and (
      auth_has_permission('companies.read')
      or auth_has_permission('tasks.read')
      or auth_has_permission('settings.categories.write')
    )
  );
create policy "category: 생성" on category
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('settings.categories.write')
  );
create policy "category: 수정" on category
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('settings.categories.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('settings.categories.write')
  );
create policy "category: 삭제" on category
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('settings.categories.write')
  );

drop policy if exists "company: tenant 격리" on company;
create policy "company: 조회" on company
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "company: 생성" on company
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "company: 수정" on company
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "company: 삭제" on company
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );

drop policy if exists "credential: tenant 격리" on credential;
create policy "credential: 조회" on credential
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "credential: 생성" on credential
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "credential: 수정" on credential
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "credential: 삭제" on credential
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );

drop policy if exists "task: tenant 격리" on task;
create policy "task: 조회" on task
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.read')
  );
create policy "task: 생성" on task
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  );
create policy "task: 수정" on task
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  );
create policy "task: 삭제" on task
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  );

drop policy if exists "schedule: tenant 격리" on schedule;
create policy "schedule: 조회" on schedule
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "schedule: 생성" on schedule
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "schedule: 수정" on schedule
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "schedule: 삭제" on schedule
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );

drop policy if exists "document: tenant 격리" on document;
create policy "document: 조회" on document
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "document: 생성" on document
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "document: 수정" on document
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );
create policy "document: 삭제" on document
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.write')
  );

drop policy if exists "campaign: tenant 격리" on campaign;
create policy "campaign: 조회" on campaign
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.read')
  );
create policy "campaign: 생성" on campaign
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  );
create policy "campaign: 수정" on campaign
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  );
create policy "campaign: 삭제" on campaign
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  );

drop policy if exists "campaign_recipient: tenant 격리" on campaign_recipient;
create policy "campaign_recipient: 조회" on campaign_recipient
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.read')
  );
create policy "campaign_recipient: 생성" on campaign_recipient
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  );
create policy "campaign_recipient: 수정" on campaign_recipient
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  );
create policy "campaign_recipient: 삭제" on campaign_recipient
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('campaigns.write')
  );

drop policy if exists "notification: tenant 격리" on notification;
create policy "notification: 조회" on notification
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('notifications.read')
  );
create policy "notification: 생성" on notification
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('notifications.read')
  );
create policy "notification: 수정" on notification
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('notifications.read')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('notifications.read')
  );
create policy "notification: 삭제" on notification
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('notifications.read')
  );

drop policy if exists "rule: tenant 격리" on rule;
create policy "rule: 조회" on rule
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('companies.read')
  );
create policy "rule: 생성" on rule
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_is_owner()
  );
create policy "rule: 수정" on rule
  for update using (
    tenant_id = auth_tenant_id()
    and auth_is_owner()
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_is_owner()
  );
create policy "rule: 삭제" on rule
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_is_owner()
  );

-- 업무일지: 본인 작성/수정/삭제, owner는 전체 조회만.
drop policy if exists "todo_note: tenant 조회" on todo_note;
drop policy if exists "todo_note: tenant 삽입" on todo_note;
drop policy if exists "todo_note: tenant 수정" on todo_note;
drop policy if exists "todo_note: tenant 삭제" on todo_note;
drop policy if exists "todo_note: 업무일지 조회" on todo_note;
drop policy if exists "todo_note: 본인 삽입" on todo_note;
drop policy if exists "todo_note: 본인 수정" on todo_note;
drop policy if exists "todo_note: 본인 삭제" on todo_note;

create policy "todo_note: 업무일지 조회" on todo_note
  for select using (
    tenant_id = auth_tenant_id()
    and (
      user_id = auth.uid()
      or auth_is_owner()
    )
  );

create policy "todo_note: 본인 삽입" on todo_note
  for insert with check (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  );

create policy "todo_note: 본인 수정" on todo_note
  for update using (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  )
  with check (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  );

create policy "todo_note: 본인 삭제" on todo_note
  for delete using (
    tenant_id = auth_tenant_id()
    and user_id = auth.uid()
  );

drop policy if exists "task_file: tenant task 조회" on task_file;
drop policy if exists "task_file: tenant task 삽입" on task_file;
drop policy if exists "task_file: tenant task 수정" on task_file;
drop policy if exists "task_file: tenant task 삭제" on task_file;
create policy "task_file: 조회" on task_file
  for select using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.read')
  );
create policy "task_file: 생성" on task_file
  for insert with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  );
create policy "task_file: 수정" on task_file
  for update using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  )
  with check (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  );
create policy "task_file: 삭제" on task_file
  for delete using (
    tenant_id = auth_tenant_id()
    and auth_has_permission('tasks.write')
  );
