import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getPassportStakeSummaryMock, slashPassportStakeMock } = vi.hoisted(
  () => ({
    getPassportStakeSummaryMock: vi.fn(),
    slashPassportStakeMock: vi.fn(),
  }),
);

vi.mock("@/lib/agent/staking", () => ({
  getPassportStakeSummary: getPassportStakeSummaryMock,
  slashPassportStake: slashPassportStakeMock,
}));

describe("POST /api/trust/report-abuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("slashes stake when evidence is accepted", async () => {
    getPassportStakeSummaryMock.mockResolvedValue({
      stakeVaultEnabled: true,
      activeStakeWei: 100000000000000000n,
    });
    slashPassportStakeMock.mockResolvedValue({
      txHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evidenceHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      slashAmountEth: "0.1",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/trust/report-abuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportId: "42",
          signature:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          timestamp: "1710000000",
          intentHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          evidenceUri: "ipfs://demo-proof",
          reason: "ddos",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      slashAmountEth: "0.1",
    });
    expect(slashPassportStakeMock).toHaveBeenCalledOnce();
  });

  it("returns accepted=false when staking is not configured", async () => {
    getPassportStakeSummaryMock.mockResolvedValue({
      stakeVaultEnabled: false,
      activeStakeWei: 0n,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/trust/report-abuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportId: "42",
          signature:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          timestamp: "1710000000",
          intentHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          evidenceUri: "ipfs://demo-proof",
          reason: "ddos",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: false,
    });
    expect(slashPassportStakeMock).not.toHaveBeenCalled();
  });
});
