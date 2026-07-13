-- Cache request-scoped auth helpers as initPlans instead of evaluating them per row.
-- ALTER POLICY preserves each policy's command and permissive/restrictive mode.

-- Core tenant and member policies
alter policy "tenant: 본인 워크스페이스만" on public.tenant
  to authenticated
  using (id = (select public.auth_tenant_id()))
  with check (id = (select public.auth_tenant_id()));

alter policy "profile: 팀 조회" on public.profile
  to authenticated
  using (
    id = (select auth.uid())
    or (
      tenant_id = (select public.auth_tenant_id())
      and (
        status <> 'disabled'
        or (select public.auth_is_owner())
      )
    )
  );

alter policy "profile: 본인 수정" on public.profile
  to authenticated
  using (
    id = (select auth.uid())
    and status = 'active'
  )
  with check (
    id = (select auth.uid())
    and status = 'active'
  );

-- Categories
alter policy "category: 조회" on public.category
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (
      (select public.auth_has_permission('companies.read'))
      or (select public.auth_has_permission('tasks.read'))
      or (select public.auth_has_permission('settings.categories.write'))
    )
  );

alter policy "category: 생성" on public.category
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('settings.categories.write'))
  );

alter policy "category: 수정" on public.category
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('settings.categories.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('settings.categories.write'))
  );

alter policy "category: 삭제" on public.category
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('settings.categories.write'))
  );

-- Companies and company-owned records
alter policy "company: 조회" on public.company
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "company: 생성" on public.company
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "company: 수정" on public.company
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "company: 삭제" on public.company
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "credential: 조회" on public.credential
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "credential: 생성" on public.credential
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "credential: 수정" on public.credential
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "credential: 삭제" on public.credential
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "schedule: 조회" on public.schedule
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "schedule: 생성" on public.schedule
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "schedule: 수정" on public.schedule
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "schedule: 삭제" on public.schedule
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "document: 조회" on public.document
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "document: 생성" on public.document
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "document: 수정" on public.document
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "document: 삭제" on public.document
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

-- Tasks, notes, and task files
alter policy "task: 조회" on public.task
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.read'))
  );

alter policy "task: 생성" on public.task
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  );

alter policy "task: 수정" on public.task
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  );

alter policy "task: 삭제" on public.task
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  );

alter policy "todo_note: 업무일지 조회" on public.todo_note
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (
      user_id = (select auth.uid())
      or (select public.auth_is_owner())
    )
  );

alter policy "todo_note: 본인 삽입" on public.todo_note
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

alter policy "todo_note: 본인 수정" on public.todo_note
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

alter policy "todo_note: 본인 삭제" on public.todo_note
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

alter policy "task_file: 조회" on public.task_file
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.read'))
  );

alter policy "task_file: 생성" on public.task_file
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  );

alter policy "task_file: 수정" on public.task_file
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  );

alter policy "task_file: 삭제" on public.task_file
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('tasks.write'))
  );

-- Campaigns and notifications
alter policy "campaign: 조회" on public.campaign
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.read'))
  );

alter policy "campaign: 생성" on public.campaign
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  );

alter policy "campaign: 수정" on public.campaign
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  );

alter policy "campaign: 삭제" on public.campaign
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  );

alter policy "campaign_recipient: 조회" on public.campaign_recipient
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.read'))
  );

alter policy "campaign_recipient: 생성" on public.campaign_recipient
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  );

alter policy "campaign_recipient: 수정" on public.campaign_recipient
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  );

alter policy "campaign_recipient: 삭제" on public.campaign_recipient
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('campaigns.write'))
  );

alter policy "notification: 조회" on public.notification
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('notifications.read'))
  );

alter policy "notification: 수정" on public.notification
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('notifications.read'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('notifications.read'))
  );

-- Rules
alter policy "rule: 조회" on public.rule
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "rule: 생성" on public.rule
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_is_owner())
  );

alter policy "rule: 수정" on public.rule
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_is_owner())
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_is_owner())
  );

alter policy "rule: 삭제" on public.rule
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_is_owner())
  );

-- Google Drive sync
alter policy "google_drive_connections: 본인만" on public.google_drive_connections
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

alter policy "google_drive_sync_jobs: 본인 조회" on public.google_drive_sync_jobs
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

alter policy "google_drive_sync_jobs: 본인 생성" on public.google_drive_sync_jobs
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

-- Billing reads
alter policy "billing_customer: tenant 조회" on public.billing_customer
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()));

alter policy "payment_method: tenant 조회" on public.payment_method
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()));

alter policy "tenant_subscription: tenant 조회" on public.tenant_subscription
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()));

alter policy "payment_transaction: tenant 조회" on public.payment_transaction
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()));

-- Intellectual property records
alter policy "ip_right: tenant 격리" on public.ip_right
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()))
  with check (tenant_id = (select public.auth_tenant_id()));

alter policy "ip_deadline: tenant 격리" on public.ip_deadline
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()))
  with check (tenant_id = (select public.auth_tenant_id()));

-- Mobile devices and deliveries
alter policy "mobile_device: 본인 기기" on public.mobile_device
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and user_id = (select auth.uid())
  );

alter policy "mobile_push_delivery: 본인 기기 조회" on public.mobile_push_delivery
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and exists (
      select 1
      from public.mobile_device d
      where d.id = mobile_push_delivery.device_id
        and d.user_id = (select auth.uid())
    )
  );

-- Company share administration
alter policy "company_share: 테넌트 격리" on public.company_share
  to authenticated
  using (tenant_id = (select public.auth_tenant_id()))
  with check (tenant_id = (select public.auth_tenant_id()));

-- Meeting reports
alter policy "meeting_report: 조회" on public.meeting_report
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "meeting_report: 생성" on public.meeting_report
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "meeting_report: 수정" on public.meeting_report
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  )
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "meeting_report: 삭제" on public.meeting_report
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "meeting_report_source: 조회" on public.meeting_report_source
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.read'))
  );

alter policy "meeting_report_source: 생성" on public.meeting_report_source
  to authenticated
  with check (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

alter policy "meeting_report_source: 삭제" on public.meeting_report_source
  to authenticated
  using (
    tenant_id = (select public.auth_tenant_id())
    and (select public.auth_has_permission('companies.write'))
  );

-- Supabase Storage object access
alter policy "company-documents: tenant select" on storage.objects
  to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      where p.id = (select auth.uid())
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

alter policy "company-documents: tenant insert" on storage.objects
  to authenticated
  with check (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      join public.company c
        on c.tenant_id = p.tenant_id
      where p.id = (select auth.uid())
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
        and c.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

alter policy "company-documents: tenant update" on storage.objects
  to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      where p.id = (select auth.uid())
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  with check (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      join public.company c
        on c.tenant_id = p.tenant_id
      where p.id = (select auth.uid())
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
        and c.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

alter policy "company-documents: tenant delete" on storage.objects
  to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      where p.id = (select auth.uid())
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
