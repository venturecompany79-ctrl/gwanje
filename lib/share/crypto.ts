// 공유 대시보드 토큰·비밀번호 암호화 유틸 — 서버 전용.
// 토큰은 crypto.randomBytes만 사용(Math.random 금지 — 추측 가능).
// 비밀번호는 대표가 재사용할 수 있는 비밀이므로 반드시 scrypt 해시로 저장한다.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// scrypt 파라미터 — Node 기본값(N=16384, r=8, p=1)과 동일.
// 직렬화에 기록하고 검증 시 다시 파싱하므로, 이 값을 올려도 기존 해시 검증이 깨지지 않는다.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export const SHARE_PASSWORD_MIN = 6;
export const SHARE_PASSWORD_MAX = 72;

/** 공유 링크용 토큰 — 256bit base64url(~43자). URL 열거 불가. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

function scryptOptions(N: number, r: number, p: number): ScryptOptions {
  // maxmem 기본 32MB는 N=16384·r=8(≈16MB)에 딱 맞아, 파라미터 상향 시 터진다 — 여유 있게 산정
  return { N, r, p, maxmem: Math.max(64 * 1024 * 1024, 256 * N * r) };
}

/** scrypt 해시 직렬화: scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url> */
export async function hashSharePassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(
    password,
    salt,
    SCRYPT_KEYLEN,
    scryptOptions(SCRYPT_N, SCRYPT_R, SCRYPT_P),
  );
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

/** 저장된 직렬화 문자열과 대조 — 기록된 파라미터로 재계산 후 상수시간 비교. */
export async function verifySharePassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(N) || N < 2 ||
    !Number.isInteger(r) || r < 1 ||
    !Number.isInteger(p) || p < 1
  ) {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scryptAsync(
    password,
    salt,
    expected.length,
    scryptOptions(N, r, p),
  );
  return timingSafeEqual(actual, expected);
}
