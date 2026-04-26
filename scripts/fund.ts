import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

type CliOptions = {
  topupAddress?: `0x${string}`;
  avaxAmount?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getEnvWithFallback(name: string, fallbackName: string): string {
  const value = process.env[name] ?? process.env[fallbackName];
  if (!value) throw new Error(`Missing ${name} (or ${fallbackName} fallback)`);
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--topup") {
      options.topupAddress = argv[index + 1] as `0x${string}` | undefined;
      index += 1;
      continue;
    }

    if (arg === "--avax") {
      options.avaxAmount = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--usdc") {
      index += 1;
    }
  }

  return options;
}

function assertHexAddress(
  label: string,
  value: string | undefined,
): asserts value is `0x${string}` {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value ?? "undefined"}`);
  }
}

async function printBalances() {
  const rpcUrl = getRequiredEnv("NEXT_PUBLIC_FUJI_RPC");
  const faucetPrivateKey = getEnvWithFallback("FAUCET_PRIVATE_KEY", "PLATFORM_PRIVATE_KEY");

  const faucetAccount = privateKeyToAccount(faucetPrivateKey as `0x${string}`);
  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });

  const avaxBalance = await publicClient.getBalance({
    address: faucetAccount.address,
  });

  console.log(`Faucet address: ${faucetAccount.address}`);
  console.log(`AVAX balance:   ${formatEther(avaxBalance)} AVAX`);
}

async function topUpWallet(options: Required<Pick<CliOptions, "topupAddress" | "avaxAmount">>) {
  const rpcUrl = getRequiredEnv("NEXT_PUBLIC_FUJI_RPC");
  const faucetPrivateKey = getEnvWithFallback("FAUCET_PRIVATE_KEY", "PLATFORM_PRIVATE_KEY");

  assertHexAddress("--topup", options.topupAddress);

  const faucetAccount = privateKeyToAccount(faucetPrivateKey as `0x${string}`);
  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account: faucetAccount,
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });

  console.log(`Funding target: ${options.topupAddress}`);
  console.log(`Sending AVAX:   ${options.avaxAmount}`);

  const avaxHash = await walletClient.sendTransaction({
    to: options.topupAddress,
    value: parseEther(options.avaxAmount),
  });
  await publicClient.waitForTransactionReceipt({
    hash: avaxHash,
    confirmations: 1,
  });
  console.log(`AVAX tx hash:   ${avaxHash}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.topupAddress) {
    await printBalances();
    return;
  }

  if (!options.avaxAmount) {
    throw new Error("Top-up mode requires --avax <amount>");
  }

  await topUpWallet({
    topupAddress: options.topupAddress,
    avaxAmount: options.avaxAmount,
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`fund.ts failed: ${message}`);
  process.exitCode = 1;
});
