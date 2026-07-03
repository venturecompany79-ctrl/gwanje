-- DB-level guard against rows that point at a company from another tenant.
-- NOT VALID keeps the migration deployable if historical bad rows exist, while
-- PostgreSQL still enforces the constraint for new and updated rows.
create unique index if not exists company_tenant_id_id_uniq
  on company (tenant_id, id);

do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('credential', 'credential_tenant_company_fk'),
      ('task', 'task_tenant_company_fk'),
      ('schedule', 'schedule_tenant_company_fk'),
      ('document', 'document_tenant_company_fk'),
      ('campaign_recipient', 'campaign_recipient_tenant_company_fk'),
      ('notification', 'notification_tenant_company_fk'),
      ('ip_right', 'ip_right_tenant_company_fk'),
      ('ip_deadline', 'ip_deadline_tenant_company_fk')
    ) as constraints(table_name, constraint_name)
  loop
    if not exists (
      select 1
      from pg_constraint
      where conname = item.constraint_name
        and conrelid = item.table_name::regclass
    ) then
      execute format(
        'alter table %I add constraint %I foreign key (tenant_id, company_id) references company (tenant_id, id) on delete cascade not valid',
        item.table_name,
        item.constraint_name
      );
    end if;
  end loop;
end $$;
