import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";

vi.mock("server-only", () => ({}));

const { createWalletClientMock, getPublicClientMock, getSupabaseMock } =
  vi.hoisted(() => ({
    createWalletClientMock: vi.fn(),
    getPublicClientMock: vi.fn(),
    getSupabaseMock: vi.fn(),
  }));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createWalletClient: createWalletClientMock,
  };
});

vi.mock("../chain/client", () => ({
  getPublicClient: getPublicClientMock,
}));

vi.mock("../db/supabase", () => ({
  getSupabase: getSupabaseMock,
}));

vi.mock("../chain/contracts", () => ({
  ActionLog: {
    address: "0x00000000000000000000000000000000000000aa",
  },
  USDC: {
    address: "0x00000000000000000000000000000000000000bb",
    abi: [],
  },
}));

describe("agent wallet helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_KEY_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.NEXT_PUBLIC_FUJI_RPC = "https://rpc.example.test";
    process.env.FAUCET_PRIVATE_KEY =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.NEXT_PUBLIC_USDC_ADDRESS =
      "0x00000000000000000000000000000000000000bb";
  });

  it("creates a wallet with an encrypted private key that can be decrypted", async () => {
    const { createAgentWallet, decryptAgentKey } = await import("./wallet");

    const result = await createAgentWallet("user-1");

    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.encryptedKey).not.toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(decryptAgentKey(result.encryptedKey)).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("loads an agent signer from the encrypted key stored in supabase", async () => {
    const { encrypt } = await import("../crypto/kms");
    const encryptedKey = encrypt(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
    const walletClient = {
      account: {
        address: "0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A",
      },
      chain: { id: 43113 },
    };

    getSupabaseMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { encrypted_private_key: encryptedKey },
              error: null,
            }),
          }),
        }),
      }),
    });
    createWalletClientMock.mockReturnValue(walletClient);

    const { getAgentSigner } = await import("./wallet");
    const signer = await getAgentSigner("agent-1");

    expect(signer).toBe(walletClient);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
  });

  it("funds the agent wallet with AVAX only", async () => {
    const faucetWallet = {
      account: {
        address: "0x8fd379246834eac74b8419ffda202cf8051f7a03",
      },
      chain: { id: 43113 },
      sendTransaction: vi
        .fn()
        .mockResolvedValue("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      writeContract: vi.fn(),
    };

    createWalletClientMock.mockReturnValue(faucetWallet);

    getPublicClientMock.mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(parseEther("1")),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
    });

    const { fundAgentWallet } = await import("./wallet");
    const result = await fundAgentWallet(
      "0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A",
    );

    expect(faucetWallet.sendTransaction).toHaveBeenCalledOnce();
    expect(faucetWallet.writeContract).not.toHaveBeenCalled();
    expect(result).toEqual({
      address: "0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A",
      avaxAmount: "0.05",
      fundingTxHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      avaxTxHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("throws a clear error when the faucet AVAX balance is too low", async () => {
    const faucetWallet = {
      account: {
        address: "0x8fd379246834eac74b8419ffda202cf8051f7a03",
      },
      chain: { id: 43113 },
      sendTransaction: vi.fn(),
      writeContract: vi.fn(),
    };

    createWalletClientMock.mockReturnValue(faucetWallet);
    getPublicClientMock.mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(parseEther("0.01")),
      waitForTransactionReceipt: vi.fn(),
    });

    const { fundAgentWallet } = await import("./wallet");

    await expect(
      fundAgentWallet("0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A"),
    ).rejects.toThrow(/insufficient AVAX/i);
  });
});
