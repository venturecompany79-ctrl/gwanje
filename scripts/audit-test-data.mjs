// GWJ-027 테스트/데모 데이터 후보 감사 — READ ONLY.
// 운영 DB를 절대 수정하지 않는다(select만 사용). 후보 목록 + 연결 데이터 영향 범위를
// 콘솔/CSV로 출력해 운영자가 승인표를 작성하도록 돕는다.
//
// 사용: SUPABASE_SMOKE_EMAIL / SUPABASE_SMOKE_PASSWORD 를 .env.local에 설정 후
//   node scripts/audit-test-data.mjs
// RLS로 로그인 사용자의 tenant 범위만 조회된다(단일 컨설턴트 MVP 기준).

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

const TEST_PATTERNS = ["테스트", "test", "샘플", "demo", "fixture"];
const ILIKE_OR = (cols) =>
  cols
    .flatMap((c) => TEST_PATTERNS.map((p) => `${c}.ilike.%${p}%`))
    .join(",");

function normalizeName(name) {
  return (name ?? "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}
function normalizeBizNo(biz) {
  return (biz ?? "").replace(/\D/g, "");
}
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_SMOKE_EMAIL;
const password = process.env.SUPABASE_SMOKE_PASSWORD;

if (!url || !anonKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY가 필요합니다.");
  process.exit(1);
}
if (!email || !password) {
  console.error(
    "SUPABASE_SMOKE_EMAIL / SUPABASE_SMOKE_PASSWORD가 필요합니다(.env.local, 로컬 전용).",
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey);
const { error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (signInError) {
  console.error("로그인 실패:", signInError.message);
  process.exit(1);
}

async function countFor(table, companyId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (error) return null; // 컬럼 없음 등은 조용히 건너뜀
  return count ?? 0;
}

// 1) 테스트성 과제
const { data: testTasks } = await supabase
  .from("task")
  .select("id, company_id, title, stage, due_date, created_at")
  .or(ILIKE_OR(["title", "memo"]))
  .order("created_at", { ascending: false });

// 2) 테스트성 알림
const { data: testNotis } = await supabase
  .from("notification")
  .select("id, company_id, title, created_at")
  .or(ILIKE_OR(["title"]))
  .order("created_at", { ascending: false });

// 3) 전체 기업 — 정규화 후 유사중복/동일 사업자번호/테스트명 탐지
const { data: companies } = await supabase
  .from("company")
  .select("id, name, biz_no, created_at");

const byName = new Map();
const byBiz = new Map();
const testCompanies = [];
function pushTo(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
for (const c of companies ?? []) {
  const nk = normalizeName(c.name);
  const bk = normalizeBizNo(c.biz_no);
  if (nk) pushTo(byName, nk, c);
  if (bk) pushTo(byBiz, bk, c);
  const hay = `${c.name ?? ""}`.toLowerCase();
  if (TEST_PATTERNS.some((p) => hay.includes(p.toLowerCase())))
    testCompanies.push(c);
}
const dupByName = [...byName.values()].filter((g) => g.length > 1);
const dupByBiz = [...byBiz.values()].filter((g) => g.length > 1);

// 후보 company 집합 — 연결 데이터 영향 범위 집계
const candidateCompanyIds = new Set([
  ...testCompanies.map((c) => c.id),
  ...dupByName.flat().map((c) => c.id),
  ...dupByBiz.flat().map((c) => c.id),
]);
const LINKED = ["credential", "task", "schedule", "document", "notification"];
const linkedCounts = new Map();
for (const id of candidateCompanyIds) {
  const counts = {};
  for (const t of LINKED) counts[t] = await countFor(t, id);
  linkedCounts.set(id, counts);
}

// ---- 출력 ----
const nameOf = new Map((companies ?? []).map((c) => [c.id, c.name]));
console.log("\n========== GWJ-027 테스트/데모 데이터 감사 (READ ONLY) ==========\n");

console.log(`[1] 테스트성 과제 후보: ${testTasks?.length ?? 0}건`);
for (const t of testTasks ?? [])
  console.log(`  - ${t.title} (id=${t.id}, stage=${t.stage}, due=${t.due_date ?? "-"})`);

console.log(`\n[2] 테스트성 알림 후보: ${testNotis?.length ?? 0}건`);
for (const n of testNotis ?? [])
  console.log(`  - ${n.title} (id=${n.id})`);

console.log(`\n[3] 테스트명 기업 후보: ${testCompanies.length}건`);
for (const c of testCompanies) console.log(`  - ${c.name} (id=${c.id})`);

console.log(`\n[4] 유사 중복 기업(이름 정규화): ${dupByName.length}그룹`);
for (const g of dupByName)
  console.log(`  - ${g.map((c) => `${c.name}(${c.id})`).join(" / ")}`);

console.log(`\n[5] 동일 사업자번호 기업: ${dupByBiz.length}그룹`);
for (const g of dupByBiz)
  console.log(
    `  - ${normalizeBizNo(g[0].biz_no)}: ${g.map((c) => `${c.name}(${c.id})`).join(" / ")}`,
  );

console.log(`\n[6] 후보 기업 연결 데이터 영향 범위:`);
for (const [id, counts] of linkedCounts)
  console.log(
    `  - ${nameOf.get(id) ?? id}: ` +
      LINKED.map((t) => `${t}=${counts[t] ?? "-"}`).join(", "),
  );

// 승인표 CSV (콘솔) — 운영자가 recommended/approved 채워 승인
console.log(`\n========== 승인표 CSV (복사해서 검토) ==========`);
const header = [
  "candidate_type",
  "record_type",
  "record_id",
  "display_name",
  "linked_counts",
  "recommended_action",
  "approved_action",
  "approved_by",
  "approved_at",
];
const rows = [header.join(",")];
const lc = (id) =>
  LINKED.map((t) => `${t}:${linkedCounts.get(id)?.[t] ?? "-"}`).join(" ");
for (const t of testTasks ?? [])
  rows.push([
    "test_task",
    "task",
    t.id,
    t.title,
    "",
    "rename_or_complete",
    "",
    "",
    "",
  ].map(csvCell).join(","));
for (const c of testCompanies)
  rows.push(["test_company", "company", c.id, c.name, lc(c.id), "review", "", "", ""].map(csvCell).join(","));
for (const g of dupByName)
  for (const c of g)
    rows.push(["duplicate_company", "company", c.id, c.name, lc(c.id), "merge", "", "", ""].map(csvCell).join(","));
for (const g of dupByBiz)
  for (const c of g)
    rows.push(["same_biz_no", "company", c.id, c.name, lc(c.id), "merge", "", "", ""].map(csvCell).join(","));
console.log(rows.join("\n"));

console.log(
  "\n⚠️ 이 스크립트는 READ ONLY입니다. 삭제/수정은 승인표 확정 후 별도 승인 단계에서만 실행하세요.\n",
);

await supabase.auth.signOut();
