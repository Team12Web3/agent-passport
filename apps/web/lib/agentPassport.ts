import { ethers } from "ethers";
import artifact from "./AgentPassport.artifact.json";

/// Display-shaped passport used by the dashboard and `AgentCard`.
/// `agentId` is a free-form display string:
///   - mock rows: "agent-alpha" etc
///   - on-chain rows: the stringified uint256 passport id ("1", "2", ...)
export type Passport = {
  owner: string;
  agentId: string;
  score: bigint;
  active: boolean;
  agentWallet?: string;
  metadataURI?: string;
  createdAt?: bigint;
};

/// Raw struct returned by `getPassport(uint256)`.
export type RawPassport = {
  id: bigint;
  owner: string;
  agentWallet: string;
  metadataURI: string;
  trustScore: number;
  active: boolean;
  createdAt: bigint;
};

export const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC ??
  "https://api.avax-test.network/ext/bc/C/rpc";
export const FUJI_CHAIN_ID = 43113;

export const AGENT_PASSPORT_ABI = artifact.abi as ethers.InterfaceAbi;
export const AGENT_PASSPORT_BYTECODE = artifact.bytecode;

function isValidAddress(address: string | undefined | null): address is string {
  return !!address && address.startsWith("0x") && address.length === 42;
}

function readContract(address: string) {
  return new ethers.Contract(address, AGENT_PASSPORT_ABI, new ethers.JsonRpcProvider(FUJI_RPC));
}

export type PlatformAddressErrorCode =
  | "invalid_contract_address"
  | "platform_read_failed"
  | "invalid_platform_address";

export type PlatformAddressResult =
  | { ok: true; platformAddress: string }
  | { ok: false; code: PlatformAddressErrorCode; message: string };

/// Read a passport by its uint256 id.
export async function fetchPassportById(
  contractAddress: string,
  id: bigint
): Promise<RawPassport | null> {
  if (!isValidAddress(contractAddress)) return null;
  try {
    const p = await readContract(contractAddress).getPassport(id);
    return {
      id: BigInt(p.id),
      owner: String(p.owner),
      agentWallet: String(p.agentWallet),
      metadataURI: String(p.metadataURI),
      trustScore: Number(p.trustScore),
      active: Boolean(p.active),
      createdAt: BigInt(p.createdAt)
    };
  } catch {
    return null;
  }
}

/// List passport ids owned by `owner`.
export async function fetchPassportsOf(contractAddress: string, owner: string): Promise<bigint[]> {
  if (!isValidAddress(contractAddress) || !isValidAddress(owner)) return [];
  try {
    const ids: bigint[] = await readContract(contractAddress).passportsOf(owner);
    return ids.map((x) => BigInt(x));
  } catch {
    return [];
  }
}

export async function fetchPlatformAddress(contractAddress: string): Promise<PlatformAddressResult> {
  if (!isValidAddress(contractAddress)) {
    return {
      ok: false,
      code: "invalid_contract_address",
      message:
        "Passport contract is not configured. Set NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS or sync packages/contracts/deployments.json.",
    };
  }
  try {
    const platformAddress = String(await readContract(contractAddress).platform());
    if (!isValidAddress(platformAddress)) {
      return {
        ok: false,
        code: "invalid_platform_address",
        message:
          "The configured passport contract returned an invalid platform address. Re-deploy or sync deployments.",
      };
    }
    return { ok: true, platformAddress };
  } catch {
    return {
      ok: false,
      code: "platform_read_failed",
      message:
        "Couldn't read the passport platform address from Avalanche Fuji RPC. Check NEXT_PUBLIC_FUJI_RPC and contract deployment.",
    };
  }
}

/// Convert a raw struct into the display-shaped `Passport` consumed by AgentCard.
export function toDisplayPassport(raw: RawPassport): Passport {
  return {
    owner: raw.owner,
    agentId: raw.id.toString(),
    score: BigInt(raw.trustScore),
    active: raw.active,
    agentWallet: raw.agentWallet,
    metadataURI: raw.metadataURI,
    createdAt: raw.createdAt
  };
}

/// Parse the `PassportMinted` event from a transaction receipt log array.
/// Works with thirdweb-shaped logs (objects with topics + data) and ethers logs.
export function parsePassportMintedFromLogs(
  logs: ReadonlyArray<{ topics: ReadonlyArray<string>; data: string; address?: string }>,
  contractAddress?: string
): { id: bigint; owner: string; agentWallet: string; metadataURI: string } | null {
  const iface = new ethers.Interface(AGENT_PASSPORT_ABI);
  const wantedAddr = contractAddress?.toLowerCase();
  for (const log of logs) {
    if (wantedAddr && log.address && log.address.toLowerCase() !== wantedAddr) continue;
    try {
      const parsed = iface.parseLog({ topics: Array.from(log.topics), data: log.data });
      if (parsed?.name === "PassportMinted") {
        return {
          id: BigInt(parsed.args.id),
          owner: String(parsed.args.owner),
          agentWallet: String(parsed.args.agentWallet),
          metadataURI: String(parsed.args.metadataURI)
        };
      }
    } catch {
      // not our log, keep looking
    }
  }
  return null;
}
