// 마이그레이션 실 실행 검증 — PGlite(WASM Postgres)로 Docker 없이 SQL을 실제 실행한다.
// Supabase 고유 객체(auth 스키마·역할·auth.uid())와 pg_cron은 스텁으로 대체.
// 검증 범위: 초기 스키마 + 신규 마이그레이션 + 시드 적용, deadline_item(KST) 뷰,
//           generate_due_notifications() 멱등 동작, task 갱신과제 유니크, profile 컬럼 권한,
//           자료 Storage 정책, RLS 멀티테넌트 격리(핵심 보안 속성).
// 실행: npm run verify:migrations   (@electric-sql/pglite는 devDependency)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const USER_C = "33333333-3333-3333-3333-333333333333";
const db = new PGlite();
let failures = 0;

function read(f) {
  return readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8");
}

async function step(label, sql) {
  try {
    await db.exec(sql);
    console.log(`✓ ${label}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${label}\n   ${e.message}`);
  }
}

async function q(label, sql) {
  try {
    const r = await db.query(sql);
    console.log(`→ ${label}: ${JSON.stringify(r.rows)}`);
    return r.rows;
  } catch (e) {
    failures++;
    console.error(`✗ ${label} (query)\n   ${e.message}`);
    return [];
  }
}

function assert(cond, label) {
  if (cond) {
    console.log(`✓ assert: ${label}`);
  } else {
    failures++;
    console.error(`✗ assert FAILED: ${label}`);
  }
}

async function assertSqlBlocked(label, sql) {
  try {
    await db.exec(sql);
    failures++;
    console.error(`✗ assert FAILED: ${label}`);
  } catch (e) {
    const blocked = /foreign key|violates|constraint|참조|키/i.test(e.message);
    assert(blocked, label);
    if (!blocked) {
      console.error(`   unexpected error: ${e.message}`);
    }
  }
}

// ── 1. Supabase 환경 스텁 ────────────────────────────────────────────────
await step(
  "stub: roles",
  `create role anon; create role authenticated; create role service_role;`,
);
await step(
  "stub: auth 스키마/함수/테이블",
  `create schema auth;
   create table auth.users (
     id uuid primary key default gen_random_uuid(),
     email text,
     created_at timestamptz not null default now()
   );
   create function auth.uid() returns uuid language sql stable as $$
     select nullif(current_setting('test.uid', true), '')::uuid
   $$;`,
);
await step(
  "stub: storage 스키마/테이블",
  `create schema storage;
   create table storage.buckets (
     id text primary key,
     name text not null,
     public boolean not null default false,
     file_size_limit bigint,
     allowed_mime_types text[]
   );
   create table storage.objects (
     id uuid primary key default gen_random_uuid(),
     bucket_id text not null references storage.buckets (id),
     name text not null,
     owner uuid,
     created_at timestamptz not null default now()
   );
   alter table storage.objects enable row level security;`,
);
// ── 2. 초기 스키마 + 신규 마이그레이션 ───────────────────────────────────
// 0004는 가드(do/exception) 블록 덕분에 pg_cron이 없어도 실패하지 않아야 한다 —
// PGlite에는 pg_cron이 없으므로, 이 실행이 곧 "확장 미설치 환경 복원력" 검증이다.
await step("migration: 20260612000000_initial_schema", read("migrations/20260612000000_initial_schema.sql"));
await step("migration: 20260613000001_deadline_item_kst", read("migrations/20260613000001_deadline_item_kst.sql"));
await step("migration: 20260613000002_profile_rls_hardening", read("migrations/20260613000002_profile_rls_hardening.sql"));
await step("migration: 20260613000003_task_renewal_unique", read("migrations/20260613000003_task_renewal_unique.sql"));
await step("migration: 20260613000004_due_notifications_cron (pg_cron 미설치 환경 — 가드로 성공해야 함)", read("migrations/20260613000004_due_notifications_cron.sql"));
await step("migration: 20260615000000_company_document_storage", read("migrations/20260615000000_company_document_storage.sql"));
await step("migration: 20260615000001_company_document_mime_types", read("migrations/20260615000001_company_document_mime_types.sql"));
await step("migration: 20260616000000_board_todos_task_files", read("migrations/20260616000000_board_todos_task_files.sql"));
await step("migration: 20260617000000_todo_note_30_day_window", read("migrations/20260617000000_todo_note_30_day_window.sql"));
await step("migration: 20260619000000_deadline_item_renewal_merge", read("migrations/20260619000000_deadline_item_renewal_merge.sql"));
await step("migration: 20260619010000_normalize_growth_stage_tags", read("migrations/20260619010000_normalize_growth_stage_tags.sql"));
await step("migration: 20260628000000_google_drive_sync", read("migrations/20260628000000_google_drive_sync.sql"));
await step("migration: 20260629000000_billing_subscription", read("migrations/20260629000000_billing_subscription.sql"));
await step("migration: 20260630000000_team_permissions", read("migrations/20260630000000_team_permissions.sql"));
await step("migration: 20260701000000_gov_program_matching", read("migrations/20260701000000_gov_program_matching.sql"));
await step("migration: 20260702000000_company_region_business_condition", read("migrations/20260702000000_company_region_business_condition.sql"));
await step("migration: 20260703000000_document_credential_link", read("migrations/20260703000000_document_credential_link.sql"));
await step("migration: 20260704000000_ip_rights", read("migrations/20260704000000_ip_rights.sql"));
await step("migration: 20260705000000_company_lifecycle", read("migrations/20260705000000_company_lifecycle.sql"));
await step("migration: 20260706000000_mobile_app_push", read("migrations/20260706000000_mobile_app_push.sql"));
await step("migration: 20260707000000_security_mobile_review_fixes", read("migrations/20260707000000_security_mobile_review_fixes.sql"));
await step("migration: 20260708000000_document_mime_hardening", read("migrations/20260708000000_document_mime_hardening.sql"));
await step("migration: 20260709000000_deadline_item_task_due_guard", read("migrations/20260709000000_deadline_item_task_due_guard.sql"));
await step("migration: 20260710000000_document_version_unique", read("migrations/20260710000000_document_version_unique.sql"));
await step("migration: 20260711000000_company_tenant_consistency", read("migrations/20260711000000_company_tenant_consistency.sql"));
await step("migration: 20260712000000_fk_indexes", read("migrations/20260712000000_fk_indexes.sql"));
await step("migration: 20260713000000_todo_note_tag_unify", read("migrations/20260713000000_todo_note_tag_unify.sql"));
await step("migration: 20260714000000_tag_backfill_perf_indexes", read("migrations/20260714000000_tag_backfill_perf_indexes.sql"));
await step("migration: 20260716000000_meeting_reports", read("migrations/20260716000000_meeting_reports.sql"));

const companyDocumentMime = await q(
  "company-documents octet-stream 허용 여부",
  `select coalesce('application/octet-stream' = any(allowed_mime_types), false) as has_octet
   from storage.buckets
   where id = 'company-documents'`,
);
assert(
  companyDocumentMime[0]?.has_octet === false,
  "company-documents bucket은 application/octet-stream을 허용하지 않음",
);

// ── 3. 시드 (auth 사용자 1명 선행) ───────────────────────────────────────
await step("seed: auth.users 1명", `insert into auth.users (id, email) values ('${USER_A}','owner@test.dev');`);
await step("seed: seed.sql", read("seed.sql"));

// ── 3-0. 자료 버전 유니크 — 동시 업로드 version race 방어 ───────────────
await step(
  "document: version 유니크 기준 행 삽입",
  `with c as (select id, tenant_id from company order by created_at limit 1)
   insert into document (tenant_id, company_id, name, version, uploaded_by)
   select tenant_id, id, '버전경합테스트.pdf', 1, 'consultant'::document_uploader from c;`,
);
let duplicateDocumentVersionBlocked = false;
try {
  await db.exec(
    `with c as (select id, tenant_id from company order by created_at limit 1)
     insert into document (tenant_id, company_id, name, version, uploaded_by)
     select tenant_id, id, '버전경합테스트.pdf', 1, 'consultant'::document_uploader from c;`,
  );
} catch (e) {
  duplicateDocumentVersionBlocked = /unique|duplicate|중복/i.test(e.message);
}
assert(
  duplicateDocumentVersionBlocked,
  "동일 기업·자료명·version 중복 document는 유니크 인덱스로 차단",
);

// ── 3-1. 정부지원사업 공개 풀 + 후보 조회 ────────────────────────────────
await step(
  "gov_program: 샘플 공고 삽입",
  `insert into gov_program
     (source, external_id, content_key, title, support_field, org_name, target_text, hashtags, apply_end, detail_url)
   values
     ('bizinfo', 'demo-1', 'smart-factory|중소벤처기업부|2099-12-31',
      '스마트공장 제조혁신 지원사업', '기술', '중소벤처기업부',
      '제조업 중소기업 스마트공장 구축 및 R&D 지원', array['제조업','R&D','스마트공장'], '2099-12-31',
      'https://example.test/demo-1'),
     ('kstartup', 'demo-2', 'startup|창업진흥원|2099-12-31',
      '초기창업 패키지', '창업', '창업진흥원',
      '창업 3년 이내 초기기업 사업화 자금', array['창업','초기기업'], '2099-12-31',
      'https://example.test/demo-2');`,
);
const govProgramCount = await q(
  "gov_program 행 수",
  `select count(*)::int as n from gov_program`,
);
assert((govProgramCount[0]?.n ?? 0) === 2, "gov_program 샘플 2건 삽입");

let govCandidates = [];
try {
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec(`set local "test.uid" = '${USER_A}'`);
  const r = await db.query(
    `select source, title
     from match_gov_program_candidates(
       '제조업 R&D',
       array['제조업','R&D']::text[],
       array['기술']::text[],
       '2026-06-29'::date,
       10
     )`,
  );
  govCandidates = r.rows;
  console.log(`→ gov_program 후보 조회: ${JSON.stringify(govCandidates)}`);
  await db.exec("rollback");
} catch (e) {
  failures++;
  console.error(`✗ gov_program 후보 조회 실행 오류\n   ${e.message}`);
  try { await db.exec("rollback"); } catch {}
}
assert(
  govCandidates.some((r) => r.title === "스마트공장 제조혁신 지원사업"),
  "authenticated가 RPC로 매칭 후보를 조회할 수 있음",
);
const syncLogGrants = await q(
  "gov_program_sync_log authenticated grant",
  `select count(*)::int as n
   from information_schema.table_privileges
   where table_name='gov_program_sync_log'
     and grantee='authenticated'
     and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')`,
);
assert((syncLogGrants[0]?.n ?? 1) === 0, "authenticated는 gov_program_sync_log 권한 없음");

// ── 4. deadline_item 뷰 (KST) ────────────────────────────────────────────
const dlCount = await q("deadline_item 행 수", `select count(*)::int as n from deadline_item`);
assert((dlCount[0]?.n ?? 0) > 0, "deadline_item이 행을 반환");
await q("deadline_item 샘플", `select source, title, days_left, status from deadline_item order by due_date limit 6`);

// ── 5. 알림 생성 함수 멱등성 ─────────────────────────────────────────────
const fnExists = await q(
  "generate_due_notifications 함수 존재(가드 블록으로 마이그레이션 성공 확인)",
  `select count(*)::int as n from pg_proc where proname='generate_due_notifications'`,
);
assert((fnExists[0]?.n ?? 0) === 1, "pg_cron 미설치 환경에서도 함수는 생성됨(가드 복원력)");
const run1 = await q("generate_due_notifications() 1차", `select generate_due_notifications() as inserted`);
const run2 = await q("generate_due_notifications() 2차(멱등)", `select generate_due_notifications() as inserted`);
assert((run1[0]?.inserted ?? 0) >= 0, "1차 실행 성공");
assert((run2[0]?.inserted ?? -1) === 0, "2차 실행은 0건(멱등) — 같은 날 중복 생성 안 함");

// ── 5-1. To-dos 30일 창 정리 ───────────────────────────────────────────
await step(
  "todo_note: 30일 창 밖/안 노트 삽입",
  `with p as (select id as user_id, tenant_id from profile limit 1)
   insert into todo_note (tenant_id, user_id, note_date, content, tag, sort_order)
   select tenant_id, user_id, (now() at time zone 'Asia/Seoul')::date - 30, '삭제 대상', '상담', 0 from p
   union all
   select tenant_id, user_id, (now() at time zone 'Asia/Seoul')::date - 29, '경계 유지 대상', '미팅', 1 from p
   union all
   select tenant_id, user_id, (now() at time zone 'Asia/Seoul')::date, '유지 대상', '서류', 2 from p;`,
);
const cleanup = await q("cleanup_old_todo_notes()", `select cleanup_old_todo_notes() as deleted`);
assert((cleanup[0]?.deleted ?? 0) >= 1, "30일 창 밖 todo_note 삭제 함수 실행");
const todoRemaining = await q(
  "todo_note 정리 후 잔여",
  `select content from todo_note order by content`,
);
assert(
  todoRemaining.some((r) => r.content === "유지 대상") &&
    todoRemaining.some((r) => r.content === "경계 유지 대상") &&
    !todoRemaining.some((r) => r.content === "삭제 대상"),
  "오늘 포함 30일 창의 To-do만 남고 창 밖 그룹은 삭제됨",
);

// ── 6. task 갱신과제 유니크 인덱스 ───────────────────────────────────────
await q(
  "갱신과제 유니크 준비(자격 1건 → 과제 연결)",
  `with c as (select id, tenant_id, company_id from credential limit 1)
   insert into task (tenant_id, company_id, title, source_credential_id)
   select tenant_id, company_id, '유니크테스트 갱신', id from c returning id`,
);
const credentialVisibleWithUndatedTask = await q(
  "deadline_item: due_date 없는 갱신 과제는 자격 D-day를 숨기지 않음",
  `with c as (select id from credential limit 1)
   select count(*)::int as n
   from deadline_item d
   join c on d.source = 'credential' and d.id = c.id`,
);
assert(
  (credentialVisibleWithUndatedTask[0]?.n ?? 0) === 1,
  "source_credential_id가 있어도 task.due_date가 null이면 credential deadline_item 유지",
);
let dupBlocked = false;
try {
  await db.exec(
    `with c as (select id, tenant_id, company_id from credential limit 1)
     insert into task (tenant_id, company_id, title, source_credential_id)
     select tenant_id, company_id, '유니크테스트 갱신 중복', id from c`,
  );
} catch (e) {
  dupBlocked = /unique|중복|duplicate/i.test(e.message);
}
assert(dupBlocked, "동일 source_credential_id 두 번째 과제는 유니크 인덱스로 차단(23505)");

// ── 7. profile 컬럼 권한 (tenant_id·id 잠금) ─────────────────────────────
const cols = await q(
  "profile UPDATE 허용 컬럼(authenticated)",
  `select column_name from information_schema.column_privileges
    where table_name='profile' and privilege_type='UPDATE' and grantee='authenticated' order by 1`,
);
const colNames = cols.map((r) => r.column_name);
assert(!colNames.includes("tenant_id"), "authenticated는 profile.tenant_id를 UPDATE할 수 없음");
assert(!colNames.includes("id"), "authenticated는 profile.id를 UPDATE할 수 없음");
assert(colNames.includes("name") && colNames.includes("notify_lead_days"), "안전 컬럼(name·notify_lead_days)은 UPDATE 허용");

// ── 8. RLS 멀티테넌트 격리 (핵심 보안 속성) ──────────────────────────────
await step(
  "테스트: tenant B + 사용자 B + company B 추가(superuser, RLS 우회)",
  `insert into auth.users (id, email) values ('${USER_B}','b@test.dev');
   do $$
   declare v_tb uuid;
   begin
     insert into tenant (name) values ('Tenant B') returning id into v_tb;
     insert into profile (id, tenant_id, name) values ('${USER_B}', v_tb, 'B컨설턴트');
     insert into company (tenant_id, name) values (v_tb, 'B사 전용기업');
   end $$;`,
);

const tenantCompanyFkRows = await q(
  "company tenant 복합 FK 제약",
  `select conname
   from pg_constraint
   where conname in (
     'credential_tenant_company_fk',
     'task_tenant_company_fk',
     'schedule_tenant_company_fk',
     'document_tenant_company_fk',
     'campaign_recipient_tenant_company_fk',
     'notification_tenant_company_fk',
     'ip_right_tenant_company_fk',
     'ip_deadline_tenant_company_fk',
     'meeting_report_tenant_company_fk',
     'meeting_report_source_tenant_company_fk'
   )
   order by conname`,
);
assert(tenantCompanyFkRows.length === 10, "tenant 복합 FK 필수 테이블 10곳에 제약이 존재");

await assertSqlBlocked(
  "credential는 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into credential (tenant_id, company_id, type)
   select a.tenant_id, b.company_id, 'tenant mismatch' from a, b;`,
);
await assertSqlBlocked(
  "task는 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into task (tenant_id, company_id, title)
   select a.tenant_id, b.company_id, 'tenant mismatch' from a, b;`,
);
await assertSqlBlocked(
  "schedule은 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into schedule (tenant_id, company_id, title, date)
   select a.tenant_id, b.company_id, 'tenant mismatch', current_date from a, b;`,
);
await assertSqlBlocked(
  "document는 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into document (tenant_id, company_id, name, uploaded_by)
   select a.tenant_id, b.company_id, 'tenant-mismatch.pdf', 'consultant'::document_uploader from a, b;`,
);
await assertSqlBlocked(
  "meeting_report는 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into meeting_report (tenant_id, company_id, title)
   select a.tenant_id, b.company_id, 'tenant mismatch report' from a, b;`,
);
await step(
  "meeting_report: source FK 테스트 행 준비",
  `with a_company as (
       select c.tenant_id, c.id as company_id
       from company c
       join profile p on p.tenant_id = c.tenant_id
       where p.id = '${USER_A}'
       order by c.created_at
       limit 1
     ),
     b_company as (
       select tenant_id, id as company_id
       from company
       where name='B사 전용기업'
       limit 1
     ),
     a_doc as (
       insert into document (tenant_id, company_id, name, uploaded_by)
       select tenant_id, company_id, 'A사 보고서소스.pdf', 'consultant'::document_uploader from a_company
       returning id
     ),
     a_report as (
       insert into meeting_report (tenant_id, company_id, title)
       select tenant_id, company_id, 'A사 source FK guard' from a_company
       returning id
     ),
     b_doc as (
       insert into document (tenant_id, company_id, name, uploaded_by)
       select tenant_id, company_id, 'B사 보고서소스.pdf', 'consultant'::document_uploader from b_company
       returning id
     )
     insert into meeting_report (tenant_id, company_id, title)
     select b_company.tenant_id, b_company.company_id, 'B사 source FK guard'
     from b_company, a_doc, a_report, b_doc;`,
);
await assertSqlBlocked(
  "meeting_report_source는 다른 tenant/company의 report_id 참조를 차단",
  `with a_company as (
       select c.tenant_id, c.id as company_id
       from company c
       join profile p on p.tenant_id = c.tenant_id
       where p.id = '${USER_A}'
       order by c.created_at
       limit 1
     ),
     a_doc as (
       select d.id
       from document d
       join a_company a on a.tenant_id = d.tenant_id and a.company_id = d.company_id
       where d.name = 'A사 보고서소스.pdf'
       limit 1
     ),
     b_report as (
       select id from meeting_report where title = 'B사 source FK guard' limit 1
     )
   insert into meeting_report_source (tenant_id, company_id, report_id, document_id, role)
   select a_company.tenant_id, a_company.company_id, b_report.id, a_doc.id, 'company_info'::meeting_report_source_role
   from a_company, a_doc, b_report;`,
);
await assertSqlBlocked(
  "meeting_report_source는 다른 tenant/company의 document_id 참조를 차단",
  `with a_company as (
       select c.tenant_id, c.id as company_id
       from company c
       join profile p on p.tenant_id = c.tenant_id
       where p.id = '${USER_A}'
       order by c.created_at
       limit 1
     ),
     a_report as (
       select r.id
       from meeting_report r
       join a_company a on a.tenant_id = r.tenant_id and a.company_id = r.company_id
       where r.title = 'A사 source FK guard'
       limit 1
     ),
     b_doc as (
       select d.id
       from document d
       join company c on c.id = d.company_id
       where c.name = 'B사 전용기업'
         and d.name = 'B사 보고서소스.pdf'
       limit 1
     )
   insert into meeting_report_source (tenant_id, company_id, report_id, document_id, role)
   select a_company.tenant_id, a_company.company_id, a_report.id, b_doc.id, 'meeting_note'::meeting_report_source_role
   from a_company, a_report, b_doc;`,
);
await assertSqlBlocked(
  "campaign_recipient는 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        campaign_a as (
          insert into campaign (tenant_id, title)
          select tenant_id, 'tenant mismatch campaign' from a
          returning id, tenant_id
        ),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into campaign_recipient (tenant_id, campaign_id, company_id)
   select campaign_a.tenant_id, campaign_a.id, b.company_id from campaign_a, b;`,
);
await assertSqlBlocked(
  "notification은 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into notification (tenant_id, type, title, company_id)
   select a.tenant_id, 'deadline'::notification_type, 'tenant mismatch', b.company_id from a, b;`,
);
await assertSqlBlocked(
  "ip_right는 다른 tenant 회사 참조를 차단",
  `with a as (select tenant_id from profile where id='${USER_A}'),
        b as (select id as company_id from company where name='B사 전용기업')
   insert into ip_right (tenant_id, company_id, kind, title)
   select a.tenant_id, b.company_id, 'patent'::ip_right_kind, 'tenant mismatch' from a, b;`,
);
await assertSqlBlocked(
  "ip_deadline은 다른 tenant 회사 참조를 차단",
  `with b_company as (select id, tenant_id from company where name='B사 전용기업'),
        b_right as (
          insert into ip_right (tenant_id, company_id, kind, title)
          select tenant_id, id, 'patent'::ip_right_kind, 'B right' from b_company
          returning id, company_id
        ),
        a as (select tenant_id from profile where id='${USER_A}')
   insert into ip_deadline (tenant_id, company_id, ip_right_id, type, title, due_date)
   select a.tenant_id, b_right.company_id, b_right.id, 'etc'::ip_deadline_type, 'tenant mismatch', current_date
   from a, b_right;`,
);
// 사용자 A로 RLS 적용 조회 → B사 기업이 보이면 안 됨.
// set local + role 전환은 트랜잭션으로 격리(끝나면 rollback으로 원복).
let isolation = [];
try {
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec(`set local "test.uid" = '${USER_A}'`);
  const r = await db.query(
    `select
       (select count(*)::int from company) as visible,
       (select count(*)::int from company where name='B사 전용기업') as leaked`,
  );
  isolation = r.rows;
  console.log(`→ RLS(사용자 A 세션): ${JSON.stringify(isolation)}`);
  await db.exec("rollback");
} catch (e) {
  failures++;
  console.error(`✗ RLS 격리 테스트 실행 오류\n   ${e.message}`);
  try { await db.exec("rollback"); } catch {}
}
assert((isolation[0]?.leaked ?? 1) === 0, "사용자 A 세션에서 tenant B의 기업이 보이지 않음(RLS 격리)");
assert((isolation[0]?.visible ?? 0) >= 6, "사용자 A는 자기 tenant 기업은 정상 조회");

// ── 9. 팀 권한 + 업무일지 개인/owner 조회 ───────────────────────────────
await step(
  "테스트: tenant A 팀원 C + owner/팀원 업무일지 추가",
  `insert into auth.users (id, email) values ('${USER_C}','member@test.dev');
   insert into profile (id, tenant_id, name, email, role, permissions, status)
   select '${USER_C}', tenant_id, 'C팀원', 'member@test.dev', 'member',
          array['companies.read','tasks.read','tasks.write','notifications.read']::text[],
          'active'
   from profile where id='${USER_A}';
   insert into todo_note (tenant_id, user_id, note_date, content, tag, sort_order)
   select tenant_id, '${USER_A}', (now() at time zone 'Asia/Seoul')::date, 'owner private note', '상담', 10
   from profile where id='${USER_A}';
   insert into todo_note (tenant_id, user_id, note_date, content, tag, sort_order)
   select tenant_id, '${USER_C}', (now() at time zone 'Asia/Seoul')::date, 'member private note', '서류', 11
   from profile where id='${USER_A}';`,
);

let memberTodo = [];
try {
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec(`set local "test.uid" = '${USER_C}'`);
  const r = await db.query(
    `select
       (select count(*)::int from todo_note where user_id='${USER_C}') as own_notes,
       (select count(*)::int from todo_note where user_id='${USER_A}') as owner_notes`,
  );
  memberTodo = r.rows;
  console.log(`→ RLS(팀원 C 업무일지): ${JSON.stringify(memberTodo)}`);
  await db.exec("rollback");
} catch (e) {
  failures++;
  console.error(`✗ 팀원 업무일지 RLS 테스트 실행 오류\n   ${e.message}`);
  try { await db.exec("rollback"); } catch {}
}
assert((memberTodo[0]?.own_notes ?? 0) >= 1, "팀원은 본인 업무일지를 조회할 수 있음");
assert((memberTodo[0]?.owner_notes ?? 1) === 0, "팀원은 owner 업무일지를 조회할 수 없음");

let ownerTodo = [];
try {
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec(`set local "test.uid" = '${USER_A}'`);
  const r = await db.query(
    `select count(*)::int as member_notes from todo_note where user_id='${USER_C}'`,
  );
  ownerTodo = r.rows;
  console.log(`→ RLS(owner 업무일지): ${JSON.stringify(ownerTodo)}`);
  await db.exec("rollback");
} catch (e) {
  failures++;
  console.error(`✗ owner 업무일지 RLS 테스트 실행 오류\n   ${e.message}`);
  try { await db.exec("rollback"); } catch {}
}
assert((ownerTodo[0]?.member_notes ?? 0) >= 1, "owner는 팀원 업무일지를 조회할 수 있음");

await step(
  "테스트: 팀원 C 비활성화",
  `update profile set status='disabled', disabled_at=now() where id='${USER_C}';`,
);
let disabledAccess = [];
try {
  await db.exec("begin");
  await db.exec("set local role authenticated");
  await db.exec(`set local "test.uid" = '${USER_C}'`);
  const r = await db.query(
    `select
       (select count(*)::int from company) as companies,
       (select count(*)::int from todo_note) as notes`,
  );
  disabledAccess = r.rows;
  console.log(`→ RLS(비활성 팀원 C): ${JSON.stringify(disabledAccess)}`);
  await db.exec("rollback");
} catch (e) {
  failures++;
  console.error(`✗ 비활성 팀원 RLS 테스트 실행 오류\n   ${e.message}`);
  try { await db.exec("rollback"); } catch {}
}
assert((disabledAccess[0]?.companies ?? 1) === 0, "비활성 팀원은 tenant 기업을 조회할 수 없음");
assert((disabledAccess[0]?.notes ?? 1) === 0, "비활성 팀원은 업무일지도 조회할 수 없음");

// ── 결과 ─────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(56)}`);
if (failures === 0) {
  console.log("✅ 모든 마이그레이션·시드·검증 통과 (PGlite 실 실행)");
} else {
  console.log(`❌ 실패 ${failures}건 — 위 ✗ 항목 확인 필요`);
}
await db.close();
process.exit(failures === 0 ? 0 : 1);
