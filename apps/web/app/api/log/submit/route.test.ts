import { beforeEach, describe, expect, it, vi } from "vitest";
import { maxUint256 } from "viem";

vi.mock("server-only", () => ({}));

const {
  getSessionUserMock,
  getSupabaseMock,
  getPublicClientMock,
  getSignerFromEncryptedKeyMock,
  assertContractsDeployedMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getSupabaseMock: vi.fn(),
  getPublicClientMock: vi.fn(),
  getSignerFromEncryptedKeyMock: vi.fn(),
  assertContractsDeployedMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabase: getSupabaseMock,
}));

vi.mock("@/lib/chain/client", () => ({
  getPublicClient: getPublicClientMock,
}));

vi.mock("@/lib/agent/wallet", () => ({
  getSignerFromEncryptedKey: getSignerFromEncryptedKeyMock,
}));

vi.mock("@/lib/chain/contracts", () => ({
  ActionLog: {
    address: "0x00000000000000000000000000000000000000aa",
    abi: [],
  },
  USDC: {
    address: "0x00000000000000000000000000000000000000bb",
    abi: [],
  },
  assertContractsDeployed: assertContractsDeployedMock,
}));

describe("POST /api/log/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-approves and submits an ActionLog payment without user re-signing", async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: "user-1" },
    });

    const agentRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      user_id: "user-1",
      passport_id: "42",
      encrypted_private_key: "encrypted-key",
    };

    const updateEqMock = vi.fn().mockResolvedValue({});
    const updateMock = vi.fn(() => ({
      eq: updateEqMock,
    }));
    const selectSingleMock = vi.fn().mockResolvedValue({
      data: agentRow,
      error: null,
    });

    getSupabaseMock.mockReturnValue({
      from: (table: string) => {
        if (table === "agents") {
          return {
            select: () => ({
              eq: () => ({
                single: selectSingleMock,
              }),
            }),
          };
        }

        if (table === "action_runs") {
          return {
            update: updateMock,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const writeContractMock = vi
      .fn()
      .mockResolvedValueOnce(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      )
      .mockResolvedValueOnce(
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      );

    getSignerFromEncryptedKeyMock.mockReturnValue({
      account: {
        address: "0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A",
      },
      wallet: {
        chain: { id: 43113 },
        writeContract: writeContractMock,
      },
    });

    getPublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi
        .fn()
        .mockResolvedValue({ blockNumber: 123n }),
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/log/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          runId: "11111111-1111-1111-1111-111111111111",
          taskHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          actionsRoot:
            "0x2222222222222222222222222222222222222222222222222222222222222222",
          feeAmount: "100000",
          beneficiary: "0x3333333333333333333333333333333333333333",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      txHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 123,
    });

    expect(writeContractMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: "approve",
        args: [
          "0x00000000000000000000000000000000000000aa",
          maxUint256,
        ],
      }),
    );
    expect(writeContractMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: "logAction",
        args: [
          42n,
          "0x1111111111111111111111111111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222222222222222222222222222",
          100000n,
          "0x3333333333333333333333333333333333333333",
        ],
      }),
    );
    expect(updateMock).toHaveBeenCalledOnce();
    expect(updateEqMock).toHaveBeenCalledWith(
      "id",
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
