-- 기업 대량 가져오기: 최대 200개 기업과 자격을 한 번의 Data API 호출로 저장한다.
-- 기업 INSERT와 해당 기업의 자격 묶음 INSERT를 별도 예외 블록으로 격리해
-- 기존 서버 액션의 행별 부분 성공 및 자격 실패 warning 계약을 유지한다.

create or replace function bulk_import_companies(p_rows jsonb)
returns table (
  row_index int,
  row_id text,
  ok boolean,
  company_id uuid,
  error text,
  warning text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_row record;
  v_credentials jsonb;
begin
  -- security invoker의 RLS에 더해 RPC 진입점 자체에서도 세션, tenant, 권한을 검증한다.
  v_tenant_id := auth_tenant_id();
  if v_tenant_id is null then
    raise exception '활성 워크스페이스를 찾을 수 없습니다.' using errcode = '42501';
  end if;

  if not auth_has_permission('companies.write') then
    raise exception '기업을 등록할 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows는 JSON 배열이어야 합니다.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception '등록할 기업이 없습니다.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 200 then
    raise exception '한 번에 최대 200개 기업까지 등록할 수 있습니다.' using errcode = '22023';
  end if;

  for v_row in
    select value as data, ordinality::int as index
    from jsonb_array_elements(p_rows) with ordinality
  loop
    row_index := v_row.index;
    row_id := coalesce(v_row.data ->> 'row_id', '');
    ok := false;
    company_id := null;
    error := null;
    warning := null;

    -- 이 블록의 실패만 현재 기업 INSERT를 되돌리고 다음 행을 계속 처리한다.
    begin
      insert into company (
        tenant_id,
        name,
        biz_no,
        industry,
        business_condition,
        region,
        founded_date,
        revenue,
        headcount,
        ceo_name,
        contact_name,
        contact_phone,
        contact_email,
        condition_tags,
        memo
      ) values (
        v_tenant_id,
        v_row.data ->> 'name',
        nullif(v_row.data ->> 'biz_no', ''),
        nullif(v_row.data ->> 'industry', ''),
        nullif(v_row.data ->> 'business_condition', ''),
        nullif(v_row.data ->> 'region', ''),
        nullif(v_row.data ->> 'founded_date', '')::date,
        nullif(v_row.data ->> 'revenue', '')::bigint,
        nullif(v_row.data ->> 'headcount', '')::int,
        nullif(v_row.data ->> 'ceo_name', ''),
        nullif(v_row.data ->> 'contact_name', ''),
        nullif(v_row.data ->> 'contact_phone', ''),
        nullif(v_row.data ->> 'contact_email', ''),
        coalesce(
          array(
            select jsonb_array_elements_text(
              coalesce(v_row.data -> 'condition_tags', '[]'::jsonb)
            )
          ),
          '{}'::text[]
        ),
        nullif(v_row.data ->> 'memo', '')
      )
      returning id into company_id;
    exception when others then
      error := '저장에 실패했습니다: ' || sqlerrm;
      return next;
      continue;
    end;

    -- 기존 동작과 같이 한 자격이라도 실패하면 이 기업의 자격 묶음 전체를 되돌린다.
    begin
      v_credentials := coalesce(v_row.data -> 'credentials', '[]'::jsonb);
      if jsonb_typeof(v_credentials) <> 'array' then
        raise exception 'credentials는 JSON 배열이어야 합니다.' using errcode = '22023';
      end if;

      if jsonb_array_length(v_credentials) > 0 then
        -- security invoker RLS와 별개로 다른 tenant의 category 참조를 명시적으로 차단한다.
        if exists (
          select 1
          from jsonb_array_elements(v_credentials) as item(data)
          where nullif(item.data ->> 'category_id', '') is not null
            and not exists (
              select 1
              from category c
              where c.id = (item.data ->> 'category_id')::uuid
                and c.tenant_id = v_tenant_id
            )
        ) then
          raise exception '자격 분류가 현재 워크스페이스에 속하지 않습니다.'
            using errcode = '23503';
        end if;

        insert into credential (
          tenant_id,
          company_id,
          type,
          category_id,
          issued_date,
          expires_date,
          memo
        )
        select
          v_tenant_id,
          company_id,
          item.data ->> 'type',
          nullif(item.data ->> 'category_id', '')::uuid,
          nullif(item.data ->> 'issued_date', '')::date,
          nullif(item.data ->> 'expires_date', '')::date,
          nullif(item.data ->> 'memo', '')
        from jsonb_array_elements(v_credentials) as item(data);
      end if;
    exception when others then
      warning := '기업은 저장됐지만 자격·인증 생성에 실패했습니다: ' || sqlerrm;
    end;

    ok := true;
    return next;
  end loop;
end;
$$;

revoke all on function bulk_import_companies(jsonb) from public, anon;
grant execute on function bulk_import_companies(jsonb) to authenticated;

comment on function bulk_import_companies(jsonb) is
  '검증된 기업 최대 200개를 행별 부분 성공 방식으로 등록하고 자격 묶음 실패는 warning으로 반환';

-- 입력된 최대 200개 행과 관련된 기존 기업만 조회한다. 전체 company 목록을
-- Data API로 가져오지 않아 max_rows 이후 기업도 중복 검사에 포함된다.
create index if not exists idx_company_tenant_import_name
  on company (
    tenant_id,
    (regexp_replace(lower(name), '[[:space:]]+', '', 'g'))
  );

create index if not exists idx_company_tenant_import_biz_no
  on company (
    tenant_id,
    (regexp_replace(coalesce(biz_no, ''), '[^0-9]', '', 'g'))
  )
  where biz_no is not null;

create or replace function get_company_import_duplicate_candidates(
  p_normalized_names text[],
  p_biz_no_digits text[]
)
returns table (
  name text,
  biz_no text
)
language sql
stable
security invoker
set search_path = public
as $$
  with name_matches as (
    select distinct on (
      regexp_replace(lower(c.name), '[[:space:]]+', '', 'g')
    )
      c.name,
      c.biz_no,
      regexp_replace(lower(c.name), '[[:space:]]+', '', 'g') as match_key,
      c.created_at,
      c.id
    from company c
    where regexp_replace(lower(c.name), '[[:space:]]+', '', 'g')
      = any(coalesce(p_normalized_names, '{}'::text[]))
    order by match_key, c.created_at, c.id
  ),
  biz_no_matches as (
    select distinct on (
      regexp_replace(coalesce(c.biz_no, ''), '[^0-9]', '', 'g')
    )
      c.name,
      c.biz_no,
      regexp_replace(coalesce(c.biz_no, ''), '[^0-9]', '', 'g') as match_key,
      c.created_at,
      c.id
    from company c
    where c.biz_no is not null
      and regexp_replace(c.biz_no, '[^0-9]', '', 'g')
        = any(coalesce(p_biz_no_digits, '{}'::text[]))
    order by match_key, c.created_at, c.id
  )
  select matched.name, matched.biz_no
  from name_matches matched
  union
  select matched.name, matched.biz_no
  from biz_no_matches matched;
$$;

revoke all on function get_company_import_duplicate_candidates(text[], text[])
  from public, anon, authenticated;
grant execute on function get_company_import_duplicate_candidates(text[], text[])
  to authenticated;

comment on function get_company_import_duplicate_candidates(text[], text[]) is
  '기업 가져오기 입력과 이름 또는 사업자번호가 일치하는 tenant 내 기존 기업 후보 조회';
