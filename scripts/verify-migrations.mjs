// 마이그레이션 실 실행 검증 — PGlite(WASM Postgres)로 Docker 없이 SQL을 실제 실행한다.
// Supabase 고유 객체(auth 스키마·역할·auth.uid())와 pg_cron은 스텁으로 대체.
// 검증 범위: 초기 스키마 + 신규 마이그레이션 4개 + 시드 적용, deadline_item(KST) 뷰,
//           generate_due_notifications() 멱등 동작, task 갱신과제 유니크, profile 컬럼 권한,
//           RLS 멀티테넌트 격리(핵심 보안 속성).
// 실행: npm run verify:migrations   (@electric-sql/pglite는 devDependency)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
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
// ── 2. 초기 스키마 + 신규 마이그레이션 ───────────────────────────────────
// 0004는 가드(do/exception) 블록 덕분에 pg_cron이 없어도 실패하지 않아야 한다 —
// PGlite에는 pg_cron이 없으므로, 이 실행이 곧 "확장 미설치 환경 복원력" 검증이다.
await step("migration: 20260612000000_initial_schema", read("migrations/20260612000000_initial_schema.sql"));
await step("migration: 20260613000001_deadline_item_kst", read("migrations/20260613000001_deadline_item_kst.sql"));
await step("migration: 20260613000002_profile_rls_hardening", read("migrations/20260613000002_profile_rls_hardening.sql"));
await step("migration: 20260613000003_task_renewal_unique", read("migrations/20260613000003_task_renewal_unique.sql"));
await step("migration: 20260613000004_due_notifications_cron (pg_cron 미설치 환경 — 가드로 성공해야 함)", read("migrations/20260613000004_due_notifications_cron.sql"));

// ── 3. 시드 (auth 사용자 1명 선행) ───────────────────────────────────────
await step("seed: auth.users 1명", `insert into auth.users (id, email) values ('${USER_A}','owner@test.dev');`);
await step("seed: seed.sql", read("seed.sql"));

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

// ── 6. task 갱신과제 유니크 인덱스 ───────────────────────────────────────
await q(
  "갱신과제 유니크 준비(자격 1건 → 과제 연결)",
  `with c as (select id, tenant_id, company_id from credential limit 1)
   insert into task (tenant_id, company_id, title, source_credential_id)
   select tenant_id, company_id, '유니크테스트 갱신', id from c returning id`,
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

// ── 결과 ─────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(56)}`);
if (failures === 0) {
  console.log("✅ 모든 마이그레이션·시드·검증 통과 (PGlite 실 실행)");
} else {
  console.log(`❌ 실패 ${failures}건 — 위 ✗ 항목 확인 필요`);
}
await db.close();
process.exit(failures === 0 ? 0 : 1);
