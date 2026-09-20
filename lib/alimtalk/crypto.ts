import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getCredKey } from "@/lib/alimtalk/config";

// 테넌트 Solapi 자격증명 암호화 — AES-256-GCM.
// 저장 형식: base64(iv) : base64(authTag) : base64(ciphertext)
// 키: ALIMTALK_CRED_KEY (base64 인코딩된 32바이트). 서버 전용.
// (lib/billing/crypto.ts와 동일 방식 — 키만 분리.)

const IV_LENGTH = 12; // GCM 권장 nonce 길이

function getKey(): Buffer {
  const key = Buffer.from(getCredKey(), "base64");
  if (key.length !== 32) {
    throw new Error(
      "ALIMTALK_CRED_KEY는 base64로 인코딩한 32바이트여야 합니다. 예: openssl rand -base64 32",
    );
  }
  return key;
}

export function encryptCred(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptCred(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("암호화된 알림톡 자격증명 형식이 올바르지 않습니다.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
