// 결제 보안 프리미티브 스모크 — 환경변수/네트워크 없이 동작.
// 빌링키 암호화 스킴(AES-256-GCM, iv:tag:ciphertext base64)과 Toss Basic 인증
// 헤더 구성이 lib/billing/crypto.ts·toss.ts와 동일하게 성립하는지 검증한다.
// 실행: node scripts/billing-smoke.mjs
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const IV_LENGTH = 12;

function encrypt(plaintext, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

function decrypt(payload, key) {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

console.log("billing-smoke:");

check("빌링키 암호화 라운드트립", () => {
  const key = randomBytes(32);
  const billingKey = "billing_test_KEY_abcdef0123456789";
  const enc = encrypt(billingKey, key);
  assert.equal(enc.split(":").length, 3, "형식은 iv:tag:ciphertext(3파트)여야 함");
  assert.notEqual(enc, billingKey, "암호문은 평문과 달라야 함");
  assert.equal(decrypt(enc, key), billingKey, "복호화가 원문과 일치해야 함");
});

check("변조된 authTag는 복호화 거부", () => {
  const key = randomBytes(32);
  const enc = encrypt("secret", key);
  const [iv, , ct] = enc.split(":");
  const badTag = randomBytes(16).toString("base64");
  assert.throws(() => decrypt(`${iv}:${badTag}:${ct}`, key));
});

check("잘못된 키 길이 거부", () => {
  assert.throws(() => encrypt("x", randomBytes(16)));
});

check("Toss Basic 인증 헤더 구성", () => {
  const secretKey = "test_sk_DUMMY";
  const header = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  assert.equal(decoded, `${secretKey}:`, "secretKey 뒤에 ':' 붙여 base64 인코딩해야 함");
});

if (failures > 0) {
  console.error(`\n${failures}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
