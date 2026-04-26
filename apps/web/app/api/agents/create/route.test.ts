import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const {
  getSessionUserMock,
  getPublicClientMock,
  getPlatformWalletClientMock,
  assertContractsDeployedMock,
  createAgentWalletMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getPublicClientMock: vi.fn(),
  getPlatformWalletClientMock: vi.fn(),
  assertContractsDeployedMock: vi.fn(),
  createAgentWalletMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/lib/chain/client", () => ({
  getPublicClient: getPublicClientMock,
  getPlatformWalletClient: getPlatformWalletClientMock,
}));

vi.mock("@/lib/chain/contracts", () => ({
  AgentPassport: {
    address: "0x00000000000000000000000000000000000000aa",
    abi: [],
  },
  assertContractsDeployed: assertContractsDeployedMock,
}));

vi.mock("@/lib/agent/wallet", () => ({
  AgentFundingError: class AgentFundingError extends Error {},
  createAgentWallet: createAgentWalletMock,
  fundAgentWallet: vi.fn(),
}));

vi.mock("@/lib/agent/claims", () => ({
  createUnsignedAgentClaims: vi.fn(),
  getClaimsDigest: vi.fn(),
}));

vi.mock("@/lib/mintApproval", () => ({
  mintApprovalData: vi.fn(() => "0x1234"),
}));

describe("POST /api/agents/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      user: {
        id: "user-1",
        wallet_address: "0x1111111111111111111111111111111111111111",
      },
    });
    getPlatformWalletClientMock.mockReturnValue({
      account: { address: "0x2222222222222222222222222222222222222222" },
    });
    getPublicClientMock.mockReturnValue({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      getTransaction: vi.fn().mockResolvedValue({
        chainId: 43113,
        from: "0x1111111111111111111111111111111111111111",
        to: "0x3333333333333333333333333333333333333333",
        value: 0n,
        input: "0xdeadbeef",
      }),
    });
  });

  it("rejects invalid mint approvals before provisioning", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "agent-one",
          purpose: "General-purpose agent",
          tools: ["scraper"],
          mintApprovalTxHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_mint_approval" });
    expect(createAgentWalletMock).not.toHaveBeenCalled();
  });
});
