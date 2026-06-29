-- =============================================================
-- 정부지원사업 공개 공고 공유 풀 + 기업별 추천 후보 조회
--
-- 모든 공고는 테넌트와 무관한 공개 데이터다. 크론/service_role이 공유 풀에
-- 동기화하고, authenticated 사용자는 읽기 전용으로 추천 후보만 조회한다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. gov_program — 공개 공고 공유 풀
-- -------------------------------------------------------------
create or replace function gov_program_to_search_vector(
  title text,
  support_field text,
  org_name text,
  target_text text,
  hashtags text[]
)
returns tsvector
language sql
immutable
as $$
  select to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    coalesce(support_field, '') || ' ' ||
    coalesce(org_name, '') || ' ' ||
    coalesce(target_text, '') || ' ' ||
    array_to_string(coalesce(hashtags, '{}'), ' ')
  );
$$;

create table gov_program (
  id            uuid primary key default gen_random_uuid(),
  source        text not null
    check (source in ('bizinfo', 'kstartup', 'smes', 'msit')),
  external_id   text not null,
  content_key   text not null,
  title         text not null,
  support_field text
    check (
      support_field is null or
      support_field in ('금융', '기술', '인력', '수출', '내수', '창업', '경영', '기타')
    ),
  org_name      text,
  target_text   text,
  hashtags      text[] not null default '{}',
  region        text,
  apply_start   date,
  apply_end     date,
  detail_url    text,
  raw           jsonb,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  search_vector tsvector generated always as (
    gov_program_to_search_vector(title, support_field, org_name, target_text, hashtags)
  ) stored,
  unique (source, external_id)
);

create index gov_program_apply_end_idx on gov_program (apply_end);
create index gov_program_content_key_idx on gov_program (content_key);
create index gov_program_hashtags_idx on gov_program using gin (hashtags);
create index gov_program_search_vector_idx on gov_program using gin (search_vector);
create index gov_program_support_field_idx on gov_program (support_field);

alter table gov_program enable row level security;

create policy "gov_program: 읽기 전용 공개" on gov_program
  for select to authenticated using (true);

-- 초기 스키마의 default privileges가 신규 테이블에 쓰기 권한을 줄 수 있어 명시 회수.
revoke insert, update, delete on gov_program from authenticated;
grant select on gov_program to authenticated;

-- -------------------------------------------------------------
-- 2. gov_program_sync_log — service_role 전용 동기화 로그
-- -------------------------------------------------------------
create table gov_program_sync_log (
  id        uuid primary key default gen_random_uuid(),
  source    text not null
    check (source in ('bizinfo', 'kstartup', 'smes', 'msit')),
  status    text not null check (status in ('success', 'failed')),
  fetched   int not null default 0,
  upserted  int not null default 0,
  error     text,
  ran_at    timestamptz not null default now()
);

alter table gov_program_sync_log enable row level security;
revoke all on gov_program_sync_log from authenticated;

-- -------------------------------------------------------------
-- 3. 빠른 후보 조회 RPC
-- -------------------------------------------------------------
create or replace function match_gov_program_candidates(
  q text default '',
  tags text[] default '{}',
  fields text[] default '{}',
  today date default current_date,
  max_rows int default 80
)
returns setof gov_program
language sql
stable
security invoker
set search_path = public
as $$
  with args as (
    select
      nullif(btrim(coalesce(q, '')), '') as query_text,
      coalesce(tags, '{}') as tag_list,
      coalesce(fields, '{}') as field_list,
      greatest(1, least(coalesce(max_rows, 80), 200)) as row_limit
  )
  select gp.*
  from gov_program gp
  cross join args a
  where (gp.apply_end is null or gp.apply_end >= today)
    and (
      a.query_text is null
      or gp.hashtags && a.tag_list
      or gp.support_field = any(a.field_list)
      or gp.search_vector @@ plainto_tsquery('simple', a.query_text)
      or gp.title ilike '%' || a.query_text || '%'
      or coalesce(gp.target_text, '') ilike '%' || a.query_text || '%'
      or coalesce(gp.org_name, '') ilike '%' || a.query_text || '%'
    )
  order by
    case when gp.hashtags && a.tag_list then 0 else 1 end,
    case when gp.support_field = any(a.field_list) then 0 else 1 end,
    case when gp.apply_end is null then 1 else 0 end,
    gp.apply_end asc,
    gp.synced_at desc
  limit (select row_limit from args);
$$;

revoke all on function match_gov_program_candidates(text, text[], text[], date, int)
  from public, anon;
grant execute on function match_gov_program_candidates(text, text[], text[], date, int)
  to authenticated;
