import { ethers } from "ethers";

export type Passport = {
  owner: string;
  agentId: string;
  score: bigint;
  active: boolean;
};

const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

const AGENT_PASSPORT_ABI = [
  "function getPassport(string agentId) view returns (address owner, string storedAgentId, uint256 score, bool active)",
  "function verifyAgent(string agentId, uint256 minScore) view returns (bool)"
];

export function getProvider() {
  return new ethers.JsonRpcProvider(FUJI_RPC);
}

export function getContract(address: string) {
  const provider = getProvider();
  return new ethers.Contract(address, AGENT_PASSPORT_ABI, provider);
}

export async function fetchPassport(contractAddress: string, agentId: string): Promise<Passport> {
  const contract = getContract(contractAddress);
  const [owner, storedAgentId, score, active] = await contract.getPassport(agentId);
  return {
    owner: String(owner),
    agentId: String(storedAgentId),
    score: BigInt(score),
    active: Boolean(active)
  };
}

export async function fetchVerifyAgent(
  contractAddress: string,
  agentId: string,
  minScore: number
): Promise<boolean> {
  const contract = getContract(contractAddress);
  return Boolean(await contract.verifyAgent(agentId, minScore));
}

