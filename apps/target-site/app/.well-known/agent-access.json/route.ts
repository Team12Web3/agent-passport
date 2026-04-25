import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? process.env.NEXT_PUBLIC_TARGET_DOMAIN ?? "localhost:3001";
  const baseUrl = `http${host.startsWith("localhost") ? "" : "s"}://${host}`;

  return NextResponse.json({
    protocol: "agent-passport-demo",
    version: "1.0",
    name: "PopUpMart Agent Access Manifest",
    description:
      "Opt-in agent lane. Agents must sign an EIP-712 AgentRequest and include the required x-agent-* headers.",
    network: {
      name: "Avalanche Fuji C-Chain",
      chainId: 43113,
      passportContract: process.env.AGENT_PASSPORT_CONTRACT ?? null,
    },
    endpoints: [
      {
        path: "/api/agent/products",
        method: "GET",
        allowedIntents: ["compare_products", "read_products"],
        requiredHeaders: [
          "x-agent-address",
          "x-agent-passport-id",
          "x-agent-chain-id",
          "x-agent-domain",
          "x-agent-path",
          "x-agent-intent",
          "x-agent-nonce",
          "x-agent-deadline",
          "x-agent-signature",
        ],
        url: `${baseUrl}/api/agent/products`,
      },
    ],
    typedData: {
      domain: {
        name: "AgentPassport",
        version: "1",
        chainId: 43113,
        verifyingContract: process.env.AGENT_PASSPORT_CONTRACT ?? "0xYourContract",
      },
      primaryType: "AgentRequest",
      types: {
        AgentRequest: [
          { name: "agent", type: "address" },
          { name: "passportId", type: "uint256" },
          { name: "targetDomain", type: "string" },
          { name: "path", type: "string" },
          { name: "intent", type: "string" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
    },
  });
}
