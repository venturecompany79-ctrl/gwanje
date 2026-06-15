-- Company document uploads use Supabase Storage.
-- Object path convention: {tenant_id}/{company_id}/{uuid}-{filename}

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-documents',
  'company-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company-documents: tenant select" on storage.objects;
drop policy if exists "company-documents: tenant insert" on storage.objects;
drop policy if exists "company-documents: tenant update" on storage.objects;
drop policy if exists "company-documents: tenant delete" on storage.objects;

create policy "company-documents: tenant select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      where p.id = auth.uid()
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

create policy "company-documents: tenant insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      join public.company c
        on c.tenant_id = p.tenant_id
      where p.id = auth.uid()
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
        and c.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

create policy "company-documents: tenant update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      where p.id = auth.uid()
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
      where p.id = auth.uid()
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
        and c.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

create policy "company-documents: tenant delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1
      from public.profile p
      where p.id = auth.uid()
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
