import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const TARGETS = ["production", "preview"];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function runVercelEnvAdd(key, target, value) {
  if (target === "preview") {
    console.log(
      `Syncing ${key} to Vercel preview. If prompted for a Git branch, press Enter for all Preview branches.`,
    );
  }

  const result = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      key,
      target,
      "--value",
      value,
      "--yes",
      "--force",
      "--no-sensitive",
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    console.error(`Vercel env sync failed: ${key} (${target})`);
    process.exit(result.status ?? 1);
  }

  console.log(`Synced ${key} to Vercel ${target}`);
}

const localEnv = loadEnvFile(path.join(process.cwd(), ".env.local"));
const missing = REQUIRED_KEYS.filter((key) => !localEnv[key]);

if (missing.length > 0) {
  console.error(`Missing required local env: ${missing.join(", ")}`);
  console.error(".env.local에 Supabase Project URL과 anon key를 먼저 설정해 주세요.");
  process.exit(1);
}

for (const target of TARGETS) {
  for (const key of REQUIRED_KEYS) {
    runVercelEnvAdd(key, target, localEnv[key]);
  }
}

console.log("Vercel Preview/Production Supabase env sync complete.");
