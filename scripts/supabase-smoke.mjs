import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function fail(message, detail) {
  console.error(`Supabase smoke failed: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

async function countRows(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    fail(`${table} 조회 실패`, error.message);
  }

  return count ?? 0;
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_SMOKE_EMAIL;
const password = process.env.SUPABASE_SMOKE_PASSWORD;

if (!url || !anonKey) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다.",
    ".env.local 또는 현재 shell 환경변수에 값을 설정해 주세요.",
  );
}

let supabase;
try {
  supabase = createClient(url, anonKey);
} catch {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다.",
    "Project Settings > API의 Project URL을 사용해 주세요. 예: https://<project-ref>.supabase.co",
  );
}

const { error: sessionError } = await supabase.auth.getSession();
if (sessionError) {
  fail("Supabase Auth 세션 확인 실패", sessionError.message);
}

console.log("Supabase env 확인 완료");

if (!email || !password) {
  console.log(
    "SUPABASE_SMOKE_EMAIL / SUPABASE_SMOKE_PASSWORD가 없어 로그인/RLS 검증은 건너뜁니다.",
  );
  console.log("운영 사용자 생성 후 두 값을 로컬에만 설정하고 다시 실행해 주세요.");
  process.exit(0);
}

const { error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (signInError) {
  fail("운영 사용자 로그인 실패", signInError.message);
}

const { data: profile, error: profileError } = await supabase
  .from("profile")
  .select("id, tenant_id, name")
  .maybeSingle();

if (profileError) {
  fail("profile 조회 실패", profileError.message);
}

if (!profile) {
  fail(
    "로그인 사용자의 profile이 없습니다.",
    "Auth 사용자 생성 후 docs/seed.sql을 실행했는지 확인해 주세요.",
  );
}

const { data: tenant, error: tenantError } = await supabase
  .from("tenant")
  .select("id, name")
  .maybeSingle();

if (tenantError) {
  fail("tenant 조회 실패", tenantError.message);
}

if (!tenant) {
  fail("로그인 사용자의 tenant가 없습니다.", "docs/seed.sql 적용 여부를 확인해 주세요.");
}

const [companyCount, categoryCount, notificationCount] = await Promise.all([
  countRows(supabase, "company"),
  countRows(supabase, "category"),
  countRows(supabase, "notification"),
]);

const { count: deadlineCount, error: deadlineError } = await supabase
  .from("deadline_item")
  .select("id", { count: "exact", head: true });

if (deadlineError) {
  fail("deadline_item 조회 실패", deadlineError.message);
}

console.log("Supabase 로그인/RLS 스모크 테스트 통과");
console.log(`- profile: ${profile.name}`);
console.log(`- tenant: ${tenant.name}`);
console.log(`- companies: ${companyCount}`);
console.log(`- categories: ${categoryCount}`);
console.log(`- notifications: ${notificationCount}`);
console.log(`- deadline_items: ${deadlineCount ?? 0}`);

await supabase.auth.signOut();
