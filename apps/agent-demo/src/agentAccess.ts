import type { Address } from "viem";

export const AGENT_ACCESS_TYPES = {
  AgentRequest: [
    { name: "agent", type: "address" },
    { name: "passportId", type: "uint256" },
    { name: "targetDomain", type: "string" },
    { name: "path", type: "string" },
    { name: "intent", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function getAgentAccessDomain(contractAddress: Address) {
  return {
    name: "AgentPassport",
    version: "1",
    chainId: 43113,
    verifyingContract: contractAddress,
  } as const;
}
