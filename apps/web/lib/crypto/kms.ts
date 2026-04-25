import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const secret = process.env.AGENT_KEY_SECRET;
  if (!secret) throw new Error("Missing AGENT_KEY_SECRET");

  const normalizedSecret = secret.startsWith("0x") ? secret.slice(2) : secret;
  if (normalizedSecret.length !== KEY_LENGTH * 2) {
    throw new Error("AGENT_KEY_SECRET must be a 32-byte hex string");
  }

  const key = Buffer.from(normalizedSecret, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error("AGENT_KEY_SECRET must decode to exactly 32 bytes");
  }

  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(encoded: string): string {
  const payload = Buffer.from(encoded, "base64");
  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
