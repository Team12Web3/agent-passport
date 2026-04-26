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
const OWNER_PRIVATE_KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const DEVELOPER_PRIVATE_KEY =
  "0x4444444444444444444444444444444444444444444444444444444444444444";

async function createPassportRecord(
  agentWallet: `0x${string}`,
  ownerWallet: `0x${string}` = "0x0000000000000000000000000000000000000002",
) {
  const developer = privateKeyToAccount(DEVELOPER_PRIVATE_KEY);
  const { createUnsignedAgentClaims, getClaimsDigest } = await import("./claims");
  const unsignedClaims = createUnsignedAgentClaims({
    passportId: "42",
    developer: "Vicky",
    developerWallet: developer.address,
    modelPlatform: "Claude 3.5",
    labels: ["non-crawler"],
    complianceClaims: ["developer-signed"],
    trustScore: 80,
    easUid: "0xeas-demo-v1",
    issuedAt: Math.floor(FIXED_NOW_MS / 1000),
    sessionKey: agentWallet,
  });
  const developerSignature = await developer.signMessage({
    message: { raw: getClaimsDigest(unsignedClaims) },
  });

  return {
    owner: ownerWallet,
    agentWallet,
    metadataURI: `data:application/json,${encodeURIComponent(
      JSON.stringify({
        ...unsignedClaims,
        developerSignature,
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

    readContract.mockResolvedValue(await createPassportRecord(account.address));

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
      expect(result.attributes.claimsVerified).toBe(true);
    }
    expect(signedHeaders["X-Agent-Intent-Hash"]).toMatch(/^0x[0-9a-f]{64}$/);
    expect(signedHeaders["X-Agent-Action-Hash"]).toMatch(/^0x[0-9a-f]{64}$/);
    expect(signedHeaders["X-Agent-Intent-Proof"]).toMatch(/^0x[0-9a-f]+$/);
  });

  it("rejects a stale timestamp", async () => {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { buildTrustHeaders } = await import("./sign");
    const { verifyAgentHeaders } = await import("./verify");

    readContract.mockResolvedValue(await createPassportRecord(account.address));

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

    readContract.mockResolvedValue(await createPassportRecord(account.address));

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

    readContract.mockResolvedValue(await createPassportRecord(agentAccount.address));

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

  it("rejects a tampered action hash", async () => {
    const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { verifyAgentHeaders } = await import("./verify");
    const { buildActionHash, buildTrustHeaders } = await import("./sign");

    readContract.mockResolvedValue(await createPassportRecord(agentAccount.address));

    const headers = await buildTrustHeaders({
      passportId: "123",
      url: "https://demo.example/pay",
      encryptedKey: encrypt(AGENT_PRIVATE_KEY),
      intent: "buy the cheapest ticket",
      action: "CLICK|pay-button|flight-nz123",
    });

    const tamperedActionHeaders = new Headers(headers);
    tamperedActionHeaders.set(
      "X-Agent-Action-Hash",
      buildActionHash("CLICK|pay-button|flight-nz999"),
    );

    const result = await verifyAgentHeaders({
      headers: tamperedActionHeaders,
      url: "https://demo.example/pay",
      expectedAction: "CLICK|pay-button|flight-nz123",
    });

    expect(result).toEqual({
      ok: false,
      reason: "invalid_intent_proof",
      code: "invalid_intent_proof",
      message: expect.any(String),
    });
  });

  it("accepts an owner-authorized delegated session key", async () => {
    const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);
    const session = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const developer = privateKeyToAccount(DEVELOPER_PRIVATE_KEY);
    const { verifyAgentHeaders } = await import("./verify");
    const {
      buildActionHash,
      buildIntentHash,
      buildIntentProofDigest,
      buildTrustDigest,
      encodeHeaderJson,
    } = await import("./protocol");
    const {
      createSessionGrant,
      getSessionGrantDigest,
    } = await import("./session");
    const { createUnsignedAgentClaims, getClaimsDigest } = await import("./claims");

    readContract.mockResolvedValue(
      await createPassportRecord(session.address, owner.address),
    );

    const timestamp = String(Math.floor(FIXED_NOW_MS / 1000));
    const intent = "buy the cheapest ticket";
    const action = "CLICK|pay-button|flight-nz123";
    const intentHash = buildIntentHash(intent);
    const actionHash = buildActionHash(action);
    const grant = createSessionGrant({
      passportId: "42",
      ownerWallet: owner.address,
      sessionKey: session.address,
      issuedAt: Number(timestamp),
      expiresAt: Number(timestamp) + 600,
      allowedOrigins: ["https://demo.example"],
      allowedActions: [action],
      maxAmountUsd: "500",
    });
    const ownerProof = await owner.signMessage({
      message: { raw: getSessionGrantDigest(grant) },
    });
    const unsignedClaims = createUnsignedAgentClaims({
      passportId: "42",
      developer: "Vicky",
      developerWallet: developer.address,
      modelPlatform: "Claude 3.5",
      labels: ["non-crawler"],
      complianceClaims: ["developer-signed"],
      trustScore: 80,
      easUid: "0xeas-demo-v1",
      issuedAt: Number(timestamp),
      sessionKey: session.address,
    });
    const developerSignature = await developer.signMessage({
      message: { raw: getClaimsDigest(unsignedClaims) },
    });
    const headers = new Headers({
      "X-Agent-Passport-ID": "42",
      "X-Agent-Signature": await session.signMessage({
        message: {
          raw: buildTrustDigest({
            passportId: "42",
            url: "https://demo.example/pay",
            timestamp,
            intentHash,
          }),
        },
      }),
      "X-Agent-Timestamp": timestamp,
      "X-Agent-Session-Proof": ownerProof,
      "X-Agent-Session-Grant": encodeHeaderJson(grant),
      "X-Agent-Intent-Hash": intentHash,
      "X-Agent-Action-Hash": actionHash,
      "X-Agent-Intent-Proof": await session.signMessage({
        message: {
          raw: buildIntentProofDigest({
            passportId: "42",
            timestamp,
            intentHash,
            actionHash,
            ownerWallet: owner.address,
          }),
        },
      }),
      "X-Agent-Claims": encodeHeaderJson({
        ...unsignedClaims,
        developerSignature,
      }),
      "X-Agent-Claims-Signature": developerSignature,
    });

    const result = await verifyAgentHeaders({
      headers,
      url: "https://demo.example/pay",
      expectedAction: action,
      expectedAmountUsd: 68,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a forged claims packet", async () => {
    const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);
    const session = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const other = privateKeyToAccount(OTHER_PRIVATE_KEY);
    const developer = privateKeyToAccount(DEVELOPER_PRIVATE_KEY);
    const { verifyAgentHeaders } = await import("./verify");
    const {
      buildActionHash,
      buildIntentHash,
      buildIntentProofDigest,
      buildTrustDigest,
      encodeHeaderJson,
    } = await import("./protocol");
    const {
      createSessionGrant,
      getSessionGrantDigest,
    } = await import("./session");
    const { createUnsignedAgentClaims, getClaimsDigest } = await import("./claims");

    readContract.mockResolvedValue(
      await createPassportRecord(session.address, owner.address),
    );

    const timestamp = String(Math.floor(FIXED_NOW_MS / 1000));
    const intent = "buy the cheapest ticket";
    const action = "CLICK|pay-button|flight-nz123";
    const intentHash = buildIntentHash(intent);
    const actionHash = buildActionHash(action);
    const grant = createSessionGrant({
      passportId: "42",
      ownerWallet: owner.address,
      sessionKey: session.address,
      issuedAt: Number(timestamp),
      expiresAt: Number(timestamp) + 600,
      allowedOrigins: ["https://demo.example"],
      allowedActions: [action],
      maxAmountUsd: "500",
    });
    const ownerProof = await owner.signMessage({
      message: { raw: getSessionGrantDigest(grant) },
    });
    const unsignedClaims = createUnsignedAgentClaims({
      passportId: "42",
      developer: "Vicky",
      developerWallet: developer.address,
      modelPlatform: "Claude 3.5",
      labels: ["non-crawler"],
      complianceClaims: ["developer-signed"],
      trustScore: 80,
      easUid: "0xeas-demo-v1",
      issuedAt: Number(timestamp),
      sessionKey: session.address,
    });
    const forgedSignature = await other.signMessage({
      message: { raw: getClaimsDigest(unsignedClaims) },
    });
    const headers = new Headers({
      "X-Agent-Passport-ID": "42",
      "X-Agent-Signature": await session.signMessage({
        message: {
          raw: buildTrustDigest({
            passportId: "42",
            url: "https://demo.example/pay",
            timestamp,
            intentHash,
          }),
        },
      }),
      "X-Agent-Timestamp": timestamp,
      "X-Agent-Session-Proof": ownerProof,
      "X-Agent-Session-Grant": encodeHeaderJson(grant),
      "X-Agent-Intent-Hash": intentHash,
      "X-Agent-Action-Hash": actionHash,
      "X-Agent-Intent-Proof": await session.signMessage({
        message: {
          raw: buildIntentProofDigest({
            passportId: "42",
            timestamp,
            intentHash,
            actionHash,
            ownerWallet: owner.address,
          }),
        },
      }),
      "X-Agent-Claims": encodeHeaderJson({
        ...unsignedClaims,
        developerSignature: forgedSignature,
      }),
      "X-Agent-Claims-Signature": forgedSignature,
    });

    const result = await verifyAgentHeaders({
      headers,
      url: "https://demo.example/pay",
      expectedAction: action,
      expectedAmountUsd: 68,
    });

    expect(result).toEqual({
      ok: false,
      reason: "invalid_attestation",
      code: "invalid_attestation",
      message: expect.any(String),
    });
  });
});
