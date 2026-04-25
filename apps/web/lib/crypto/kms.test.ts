import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("kms", () => {
  beforeEach(() => {
    process.env.AGENT_KEY_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("round-trips encrypted private key payloads", async () => {
    const { decrypt, encrypt } = await import("./kms");
    const plaintext =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("throws when the ciphertext is tampered with", async () => {
    const { decrypt, encrypt } = await import("./kms");
    const encrypted = encrypt("0xabcdef");
    const buffer = Buffer.from(encrypted, "base64");

    buffer[buffer.length - 1] ^= 0x01;

    expect(() => decrypt(buffer.toString("base64"))).toThrow();
  });
});
