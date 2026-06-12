import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

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

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error(
    "SUPABASE_DB_PASSWORD가 필요합니다. .env.local에 로컬 전용으로 추가해 주세요.",
  );
  process.exit(1);
}

const args = [
  "supabase",
  "db",
  "push",
  "--linked",
  "--password",
  password,
  ...process.argv.slice(2),
];

const result = spawnSync("npx", args, {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
