import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

type CliOptions = {
  topupAddress?: `0x${string}`;
  avaxAmount?: string;
  usdcAmount?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
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
      options.usdcAmount = argv[index + 1];
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
  const usdcAddress = getRequiredEnv("NEXT_PUBLIC_USDC_ADDRESS");
  const faucetPrivateKey = getRequiredEnv("FAUCET_PRIVATE_KEY");

  assertHexAddress("NEXT_PUBLIC_USDC_ADDRESS", usdcAddress);

  const faucetAccount = privateKeyToAccount(faucetPrivateKey as `0x${string}`);
  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl),
  });

  const [avaxBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: faucetAccount.address }),
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [faucetAccount.address],
    }),
  ]);

  console.log(`Faucet address: ${faucetAccount.address}`);
  console.log(`AVAX balance:   ${formatEther(avaxBalance)} AVAX`);
  console.log(`USDC balance:   ${formatUnits(usdcBalance, 6)} USDC`);
}

async function topUpWallet(options: Required<CliOptions>) {
  const rpcUrl = getRequiredEnv("NEXT_PUBLIC_FUJI_RPC");
  const usdcAddress = getRequiredEnv("NEXT_PUBLIC_USDC_ADDRESS");
  const faucetPrivateKey = getRequiredEnv("FAUCET_PRIVATE_KEY");

  assertHexAddress("NEXT_PUBLIC_USDC_ADDRESS", usdcAddress);
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

  console.log(`Sending USDC:   ${options.usdcAmount}`);

  const usdcHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [options.topupAddress, parseUnits(options.usdcAmount, 6)],
  });
  await publicClient.waitForTransactionReceipt({
    hash: usdcHash,
    confirmations: 1,
  });
  console.log(`USDC tx hash:   ${usdcHash}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.topupAddress) {
    await printBalances();
    return;
  }

  if (!options.avaxAmount || !options.usdcAmount) {
    throw new Error("Top-up mode requires --avax <amount> and --usdc <amount>");
  }

  await topUpWallet({
    topupAddress: options.topupAddress,
    avaxAmount: options.avaxAmount,
    usdcAmount: options.usdcAmount,
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`fund.ts failed: ${message}`);
  process.exitCode = 1;
});
