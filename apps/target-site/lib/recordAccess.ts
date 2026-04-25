import {
  createWalletClient,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "./chains";
import { agentPassportAbi } from "./agentPassportAbi";

export async function maybeRecordAccess(params: {
  contractAddress: Address;
  passportId: bigint;
  agentAddress: Address;
  targetDomain: string;
  intent: string;
}) {
  const privateKey = process.env.TARGET_SITE_PRIVATE_KEY as Hex | undefined;

  if (!privateKey || !privateKey.startsWith("0x")) {
    return {
      attempted: false,
      reason: "TARGET_SITE_PRIVATE_KEY not configured",
    } as const;
  }

  if (!isAddress(params.contractAddress)) {
    return {
      attempted: false,
      reason: "Invalid contract address",
    } as const;
  }

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(),
  });

  const hash = await walletClient.writeContract({
    address: params.contractAddress,
    abi: agentPassportAbi,
    functionName: "recordAccess",
    args: [
      params.passportId,
      params.agentAddress,
      keccak256(toHex(params.targetDomain)),
      keccak256(toHex(params.intent)),
    ],
  });

  return {
    attempted: true,
    txHash: hash,
  } as const;
}
