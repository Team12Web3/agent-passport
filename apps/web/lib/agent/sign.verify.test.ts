import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

vi.mock("server-only", () => ({}));

const readContract = vi.fn();

vi.mock("../chain/client", () => ({
  getPublicClient: () => ({
    readContract,
  }),
}));

vi.mock("../chain/contracts", () => ({
  AgentPassport: {
    address: "0x0000000000000000000000000000000000000001",
    abi: [],
  },
  assertContractsDeployed: vi.fn(),
}));

const FIXED_NOW_MS = 1_710_000_000_000;
const AGENT_PRIVATE_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const OTHER_PRIVATE_KEY =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

function createPassportRecord(agentWallet: `0x${string}`) {
  return {
    owner: "0x0000000000000000000000000000000000000002",
    agentWallet,
    metadataURI: `data:application/json,${encodeURIComponent(
      JSON.stringify({
        developer: "Vicky",
        modelPlatform: "Claude 3.5",
        labels: ["non-crawler"],
      }),
    )}`,
    active: true,
    createdAt: 1n,
    trustScore: 80n,
  };
}

describe("trust header round-trip", () => {
  beforeEach(() => {
    process.env.AGENT_KEY_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.AGENT_TERMS_TEXT = "agent-passport-demo-terms-v1";
    readContract.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);
  });

  it("accepts a valid trust-header bundle", async () => {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { buildTrustHeaders } = await import("./sign");
    const { verifyAgentHeaders } = await import("./verify");

    readContract.mockResolvedValue(createPassportRecord(account.address));

    const signedHeaders = await buildTrustHeaders({
      passportId: "42",
      url: "https://demo.example/item/1",
      encryptedKey: encrypt(AGENT_PRIVATE_KEY),
      intent: "buy the cheapest ticket",
    });

    const result = await verifyAgentHeaders({
      headers: new Headers(signedHeaders),
      url: "https://demo.example/item/1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trustScore).toBe(80);
      expect(result.attributes.developer).toBe("Vicky");
      expect(result.attributes.labels).toContain("non-crawler");
    }
    expect(signedHeaders["X-Agent-Intent-Hash"]).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("rejects a stale timestamp", async () => {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { buildTrustHeaders } = await import("./sign");
    const { verifyAgentHeaders } = await import("./verify");

    readContract.mockResolvedValue(createPassportRecord(account.address));

    const headers = await buildTrustHeaders({
      passportId: "7",
      url: "https://demo.example/list",
      encryptedKey: encrypt(AGENT_PRIVATE_KEY),
      intent: "summarize this page",
    });

    const staleHeaders = new Headers(headers);
    staleHeaders.set(
      "X-Agent-Timestamp",
      String(Math.floor(Date.now() / 1000) - 120),
    );

    const staleResult = await verifyAgentHeaders({
      headers: staleHeaders,
      url: "https://demo.example/list",
    });
    expect(staleResult).toEqual({
      ok: false,
      reason: "stale_timestamp",
      code: "stale_timestamp",
      message: expect.any(String),
    });
  });

  it("rejects a bad signature", async () => {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { buildTrustHeaders } = await import("./sign");
    const { verifyAgentHeaders } = await import("./verify");

    readContract.mockResolvedValue(createPassportRecord(account.address));

    const headers = await buildTrustHeaders({
      passportId: "7",
      url: "https://demo.example/list",
      encryptedKey: encrypt(AGENT_PRIVATE_KEY),
      intent: "summarize this page",
    });

    const badSignatureHeaders = new Headers(headers);
    badSignatureHeaders.set("X-Agent-Signature", "0xdeadbeef");

    const badSignatureResult = await verifyAgentHeaders({
      headers: badSignatureHeaders,
      url: "https://demo.example/list",
    });
    expect(badSignatureResult).toEqual({
      ok: false,
      reason: "bad_signature",
      code: "bad_signature",
      message: expect.any(String),
    });
  });

  it("rejects an invalid session proof", async () => {
    const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const otherAccount = privateKeyToAccount(OTHER_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { buildIntentHash, buildSessionProofDigest, buildTrustHeaders } =
      await import("./sign");
    const { verifyAgentHeaders } = await import("./verify");

    readContract.mockResolvedValue(createPassportRecord(agentAccount.address));

    const headers = await buildTrustHeaders({
      passportId: "99",
      url: "https://demo.example/pay",
      encryptedKey: encrypt(AGENT_PRIVATE_KEY),
      intent: "buy the cheapest ticket",
    });

    const forgedSessionProof = await otherAccount.signMessage({
      message: {
        raw: buildSessionProofDigest({
          passportId: "99",
          timestamp: headers["X-Agent-Timestamp"],
          intentHash: buildIntentHash("buy the cheapest ticket"),
        }),
      },
    });

    const invalidSessionHeaders = new Headers(headers);
    invalidSessionHeaders.set("X-Agent-Session-Proof", forgedSessionProof);

    const invalidSessionResult = await verifyAgentHeaders({
      headers: invalidSessionHeaders,
      url: "https://demo.example/pay",
    });

    expect(invalidSessionResult).toEqual({
      ok: false,
      reason: "invalid_session_key",
      code: "invalid_session_key",
      message: expect.any(String),
    });
  });
});
