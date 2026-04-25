import { createPublicClient, http, type Abi } from "viem";
import { avalancheFuji } from "viem/chains";

export type Passport = {
  owner: string;
  agentId: string;
  score: bigint;
  active: boolean;
};

const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ??
  "https://api.avax-test.network/ext/bc/C/rpc";

// Legacy ABI from the hackathon contract. The new on-chain `AgentPassport`
// (packages/contracts) exposes `getPassport(uint256)` instead — those reads
// happen server-side via `lib/chain/contracts.ts`. This ABI is preserved so
// the dashboard can still talk to a legacy deployment when the user pins
// `NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS` to one. If it doesn't match, the
// dashboard gracefully falls back to mock data.
const AGENT_PASSPORT_ABI: Abi = [
  {
    type: "function",
    name: "getPassport",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "string" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "storedAgentId", type: "string" },
      { name: "score", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "verifyAgent",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "string" },
      { name: "minScore", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

let publicClient: ReturnType<typeof createPublicClient> | null = null;
function getClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(FUJI_RPC),
    });
  }
  return publicClient;
}

export async function fetchPassport(
  contractAddress: string,
  agentId: string,
): Promise<Passport> {
  const result = (await getClient().readContract({
    address: contractAddress as `0x${string}`,
    abi: AGENT_PASSPORT_ABI,
    functionName: "getPassport",
    args: [agentId],
  })) as readonly [string, string, bigint, boolean];

  const [owner, storedAgentId, score, active] = result;
  return {
    owner: String(owner),
    agentId: String(storedAgentId),
    score: BigInt(score),
    active: Boolean(active),
  };
}

export async function fetchVerifyAgent(
  contractAddress: string,
  agentId: string,
  minScore: number,
): Promise<boolean> {
  const result = (await getClient().readContract({
    address: contractAddress as `0x${string}`,
    abi: AGENT_PASSPORT_ABI,
    functionName: "verifyAgent",
    args: [agentId, BigInt(minScore)],
  })) as boolean;
  return Boolean(result);
}
