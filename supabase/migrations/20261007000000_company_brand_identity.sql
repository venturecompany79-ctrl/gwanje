-- 기업 브랜드 아이덴티티 — 기업별 로고 이미지 + 기업명 컬러로 전 화면에서 기업을 구분한다.
-- 컬러는 lib/companyBrand.ts 의 다크 화면용 팔레트에서만 고르며(서버 액션이 검증),
-- 여기서는 형식만 막는다. 로고는 공개 버킷의 객체 경로만 저장하고 URL은 렌더 시 조립.

alter table public.company
  add column if not exists brand_color text,
  add column if not exists logo_path text;

alter table public.company
  drop constraint if exists company_brand_color_hex;
alter table public.company
  add constraint company_brand_color_hex
  check (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$');

-- Object path convention: {tenant_id}/{company_id}/{uuid}.{png|jpg|webp}
-- 공개 버킷: 로고는 앱 셸·공유 대시보드 어디서나 <img>/CSS 로 바로 쓰여야 한다.
-- 경로가 무작위 uuid라 열거되지 않으며, 쓰기는 같은 tenant 의 기업 경로로만 허용한다.
-- SVG는 스크립트를 품을 수 있어 받지 않는다.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-logos',
  'company-logos',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company-logos: tenant insert" on storage.objects;
drop policy if exists "company-logos: tenant update" on storage.objects;
drop policy if exists "company-logos: tenant delete" on storage.objects;

create policy "company-logos: tenant insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-logos'
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

create policy "company-logos: tenant update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-logos'
    and exists (
      select 1
      from public.profile p
      where p.id = auth.uid()
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  with check (
    bucket_id = 'company-logos'
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

create policy "company-logos: tenant delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and exists (
      select 1
      from public.profile p
      where p.id = auth.uid()
        and p.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
