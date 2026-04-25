import "dotenv/config";
import {
  createWalletClient,
  defineChain,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AGENT_ACCESS_TYPES, getAgentAccessDomain } from "./agentAccess.js";

const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji C-Chain",
  nativeCurrency: {
    decimals: 18,
    name: "Avalanche",
    symbol: "AVAX",
  },
  rpcUrls: {
    default: {
      http: ["https://api.avax-test.network/ext/bc/C/rpc"],
    },
  },
  testnet: true,
});

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  const passportContract = process.env.AGENT_PASSPORT_CONTRACT as Address | undefined;
  const passportId = BigInt(process.env.AGENT_PASSPORT_ID ?? "1");
  const targetBaseUrl = process.env.TARGET_BASE_URL ?? "http://localhost:3001";
  const targetDomain = process.env.TARGET_DOMAIN ?? "localhost:3001";
  const path = "/api/agent/products";
  const intent = process.env.AGENT_INTENT ?? "compare_products";

  if (!privateKey || !privateKey.startsWith("0x")) {
    throw new Error("Missing AGENT_PRIVATE_KEY in apps/agent-demo/.env");
  }

  if (!passportContract || !isAddress(passportContract)) {
    throw new Error("Missing valid AGENT_PASSPORT_CONTRACT in apps/agent-demo/.env");
  }

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(),
  });

  const nonce = BigInt(Date.now());
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

  const message = {
    agent: account.address,
    passportId,
    targetDomain,
    path,
    intent,
    nonce,
    deadline,
  } as const;

  const signature = await walletClient.signTypedData({
    account,
    domain: getAgentAccessDomain(passportContract),
    types: AGENT_ACCESS_TYPES,
    primaryType: "AgentRequest",
    message,
  });

  console.log("Agent address:", account.address);
  console.log("Passport ID:", passportId.toString());
  console.log("Target:", `${targetBaseUrl}${path}`);
  console.log("Intent:", intent);

  const response = await fetch(`${targetBaseUrl}${path}`, {
    method: "GET",
    headers: {
      "x-agent-address": account.address,
      "x-agent-passport-id": passportId.toString(),
      "x-agent-chain-id": "43113",
      "x-agent-domain": targetDomain,
      "x-agent-path": path,
      "x-agent-intent": intent,
      "x-agent-nonce": nonce.toString(),
      "x-agent-deadline": deadline.toString(),
      "x-agent-signature": signature,
    },
  });

  console.log("HTTP status:", response.status);
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
