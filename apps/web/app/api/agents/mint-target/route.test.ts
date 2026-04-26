import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const { getSessionUserMock, getPlatformWalletClientMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getPlatformWalletClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/chain/client", () => ({
  FUJI_CHAIN_ID: 43113,
  getPlatformWalletClient: getPlatformWalletClientMock,
}));

describe("GET /api/agents/mint-target", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns platform address and chain id for authenticated users", async () => {
    getSessionUserMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlatformWalletClientMock.mockReturnValue({
      account: { address: "0x1111111111111111111111111111111111111111" },
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      chainId: 43113,
      platformAddress: "0x1111111111111111111111111111111111111111",
    });
  });

  it("returns unauthorized for anonymous users", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("returns 500 when platform wallet is missing", async () => {
    getSessionUserMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlatformWalletClientMock.mockReturnValue({ account: null });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "platform_wallet_not_configured",
    });
  });
});
