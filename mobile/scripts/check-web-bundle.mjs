import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const bundleRoot = join(process.cwd(), "dist", "_expo", "static", "js", "web");
const MAX_RAW_BYTES = 3_300_000;
const MAX_GZIP_BYTES = 700 * 1024;
const WEB_ONLY_EXCLUSIONS = [
  "lucide-react-native",
  "expo-notifications",
  "expo-device",
  "openAuthSessionAsync",
];

function collectJavaScriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectJavaScriptFiles(path)
      : path.endsWith(".js")
        ? [path]
        : [];
  });
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

if (!existsSync(bundleRoot)) {
  throw new Error(`웹 번들을 찾을 수 없습니다: ${bundleRoot}`);
}

const bundleFiles = collectJavaScriptFiles(bundleRoot);
if (bundleFiles.length === 0) {
  throw new Error(`검사할 JavaScript 번들이 없습니다: ${bundleRoot}`);
}

let rawBytes = 0;
let gzipBytes = 0;
const leakedModules = new Set();

for (const file of bundleFiles) {
  const source = readFileSync(file);
  rawBytes += source.byteLength;
  gzipBytes += gzipSync(source, { level: 9 }).byteLength;

  const text = source.toString("utf8");
  for (const marker of WEB_ONLY_EXCLUSIONS) {
    if (text.includes(marker)) leakedModules.add(marker);
  }
}

console.log(
  `웹 JS ${bundleFiles.length}개: raw ${formatBytes(rawBytes)}, gzip ${formatBytes(gzipBytes)}`,
);

const failures = [];
if (rawBytes > MAX_RAW_BYTES) {
  failures.push(`raw ${formatBytes(rawBytes)} > ${formatBytes(MAX_RAW_BYTES)}`);
}
if (gzipBytes > MAX_GZIP_BYTES) {
  failures.push(`gzip ${formatBytes(gzipBytes)} > ${formatBytes(MAX_GZIP_BYTES)}`);
}
if (leakedModules.size > 0) {
  failures.push(`웹 번들에 제외 대상 포함: ${[...leakedModules].join(", ")}`);
}

if (failures.length > 0) {
  const files = bundleFiles.map((file) => relative(process.cwd(), file)).join(", ");
  throw new Error(`웹 번들 예산 검사 실패 (${files})\n- ${failures.join("\n- ")}`);
}
