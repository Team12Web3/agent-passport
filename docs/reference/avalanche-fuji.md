# Reference — Avalanche Fuji

Quick reference for everything chain-related.

## Network

| Field            | Value                                                      |
|------------------|------------------------------------------------------------|
| Name             | Avalanche Fuji C-Chain                                     |
| RPC              | `https://api.avax-test.network/ext/bc/C/rpc`               |
| Backup RPC       | `https://avalanche-fuji-c-chain.publicnode.com`            |
| Chain ID         | `43113`                                                    |
| Currency         | AVAX                                                       |
| Block explorer   | `https://testnet.snowtrace.io`                             |
| Block time       | ~2 seconds                                                 |

## Faucets

| Faucet | Gives | URL |
|--------|-------|-----|
| Core (official) | 2 AVAX/24h | https://core.app/tools/testnet-faucet/?subnet=c&token=c |
| Core (USDC)     | Test USDC | https://core.app/tools/testnet-faucet/?subnet=c&token=usdc |

You'll likely need to drip the faucet wallet a few times during the hackathon. Top up at hour 0 and hour 22.

## Test USDC

```
Address:  0x5425890298aed601595a70AB815c96711a31Bc65
Decimals: 6
Symbol:   USDC
```

## Useful commands

```bash
# Check balance
cast balance <address> --rpc-url https://api.avax-test.network/ext/bc/C/rpc

# Read a contract
cast call <contract-address> "nextId()(uint256)" \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc

# Send AVAX
cast send <to> --value 0.05ether \
  --private-key $FAUCET_PRIVATE_KEY \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc

# Verify a contract on Snowtrace (optional, nice for the demo)
forge verify-contract <address> AgentPassport \
  --chain 43113 --etherscan-api-key $SNOWTRACE_API_KEY
```

## Snowtrace links

The links you'll be sharing with judges:

```
Contract: https://testnet.snowtrace.io/address/<address>
Tx:       https://testnet.snowtrace.io/tx/<txHash>
Address:  https://testnet.snowtrace.io/address/<address>
Token:    https://testnet.snowtrace.io/token/<address>
```

## Common issues

**"insufficient funds for gas"** — your wallet ran out of AVAX. Drip from the faucet.

**"nonce too low" / "replacement transaction underpriced"** — you're sending txs too fast from the same wallet. Add `await tx.wait()` (or `waitForTransactionReceipt`) between sends, or use a queue.

**RPC returns 502 / hangs** — switch to the backup RPC. Have it ready in `.env.local` as a fallback.

**"execution reverted" without a reason** — turn on tx tracing on Snowtrace, or run the call locally with `cast call` to see the revert reason.

**Block explorer shows "pending" forever** — Fuji had a hiccup. Wait 30s or resubmit with a higher gas price.

## Recommended viem setup

```ts
// lib/chain/client.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

export const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
});

// On the server only
export function makeWalletClient(privateKey: `0x${string}`) {
  const { privateKeyToAccount } = require("viem/accounts");
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: avalancheFuji,
    transport: http(process.env.NEXT_PUBLIC_FUJI_RPC),
  });
}
```

## Reading deployed contracts

Always pull addresses + ABIs from `packages/contracts/deployments.json`:

```ts
import deployments from "@/../packages/contracts/deployments.json";

const passportAddress = deployments.AgentPassport.address as `0x${string}`;
const passportAbi     = deployments.AgentPassport.abi;

const passport = await publicClient.readContract({
  address: passportAddress,
  abi: passportAbi,
  functionName: "getPassport",
  args: [42n],
});
```

## Confirmation strategy

Wait for **1 confirmation** for everything in this app. On Fuji, that's ~2 seconds. More confirmations = slower demo with no security benefit (it's testnet anyway).

```ts
const hash = await walletClient.writeContract({...});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
// receipt.status === "success"
```
