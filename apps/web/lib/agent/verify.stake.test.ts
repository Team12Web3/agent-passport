import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

vi.mock("server-only", () => ({}));

const readContract = vi.fn();
const getPassportStakeSummaryMock = vi.fn();

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

vi.mock("./staking", () => ({
  getPassportStakeSummary: getPassportStakeSummaryMock,
}));

const FIXED_NOW_MS = 1_710_000_000_000;
const AGENT_PRIVATE_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const DEVELOPER_PRIVATE_KEY =
  "0x4444444444444444444444444444444444444444444444444444444444444444";

async function createPassportRecord(agentWallet: `0x${string}`) {
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
    owner: "0x0000000000000000000000000000000000000002",
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

describe("verifyAgentHeaders stake gate", () => {
  beforeEach(() => {
    process.env.AGENT_KEY_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.AGENT_TERMS_TEXT = "agent-passport-demo-terms-v1";
    readContract.mockReset();
    getPassportStakeSummaryMock.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);
  });

  it("returns insufficient_stake when a high-value route requires stake", async () => {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const { encrypt } = await import("../crypto/kms");
    const { buildTrustHeaders } = await import("./sign");
    const { verifyAgentHeaders } = await import("./verify");

    readContract.mockResolvedValue(await createPassportRecord(account.address));
    getPassportStakeSummaryMock.mockResolvedValue({
      passportId: "42",
      stakeVaultEnabled: true,
      activeStakeWei: 0n,
      activeStakeEth: "0",
      totalSlashedWei: 100000000000000000n,
      totalSlashedEth: "0.1",
      lastStakeAt: 1710000000,
      requiredStakeEth: "0.1",
      hasMinimumStake: false,
    });

    const headers = await buildTrustHeaders({
      passportId: "42",
      url: "https://demo.example/item/1",
      encryptedKey: encrypt(AGENT_PRIVATE_KEY),
      intent: "buy the cheapest ticket",
    });

    const result = await verifyAgentHeaders({
      headers: new Headers(headers),
      url: "https://demo.example/item/1",
      requireStake: true,
    });

    expect(result).toEqual({
      ok: false,
      reason: "insufficient_stake",
      code: "insufficient_stake",
      message: expect.any(String),
    });
  });
});
