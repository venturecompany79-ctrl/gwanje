-- Document version race hardening.
-- If past concurrent uploads created duplicate versions for the same
-- company/name pair, normalize only those affected groups before enforcing
-- uniqueness going forward.
with duplicate_groups as (
  select distinct company_id, name
  from document
  group by company_id, name, version
  having count(*) > 1
),
ranked as (
  select
    d.id,
    row_number() over (
      partition by d.company_id, d.name
      order by d.version, d.created_at, d.id
    ) as next_version
  from document d
  join duplicate_groups g
    on g.company_id = d.company_id
   and g.name = d.name
)
update document d
set version = ranked.next_version::int
from ranked
where d.id = ranked.id
  and d.version <> ranked.next_version;

create unique index if not exists document_company_name_version_uniq
  on document (company_id, name, version);
