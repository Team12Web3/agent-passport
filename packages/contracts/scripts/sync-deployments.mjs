// Stitches the latest forge broadcast + compiled ABIs into deployments.json
// so apps/web/lib/chain/contracts.ts gets real addresses + ABIs after a deploy.
//
// Run automatically by `pnpm contracts:deploy`, or manually:
//   node scripts/sync-deployments.mjs [chainId]
// Defaults to Fuji (43113) if chainId not provided.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const chainId   = Number(process.argv[2] ?? 43113);
const network   = chainId === 43113 ? "fuji" : chainId === 43114 ? "avalanche" : `chain-${chainId}`;

const broadcastPath = resolve(ROOT, `broadcast/Deploy.s.sol/${chainId}/run-latest.json`);
if (!existsSync(broadcastPath)) {
  console.error(`No broadcast file at ${broadcastPath}. Run \`pnpm contracts:deploy\` first.`);
  process.exit(1);
}
const broadcast = JSON.parse(readFileSync(broadcastPath, "utf8"));

function findAddress(contractName) {
  const tx = broadcast.transactions?.find(
    (t) => t.transactionType === "CREATE" && t.contractName === contractName,
  );
  if (!tx?.contractAddress) {
    throw new Error(`No CREATE tx for ${contractName} in ${broadcastPath}`);
  }
  return tx.contractAddress;
}

function loadAbi(contractName) {
  const artifact = JSON.parse(
    readFileSync(resolve(ROOT, `out/${contractName}.sol/${contractName}.json`), "utf8"),
  );
  return artifact.abi;
}

const passportAddress = findAddress("AgentPassport");
const actionLogAddress = findAddress("ActionLog");

const existing = JSON.parse(readFileSync(resolve(ROOT, "deployments.json"), "utf8"));

const next = {
  network,
  chainId,
  AgentPassport: { address: passportAddress, abi: loadAbi("AgentPassport") },
  ActionLog:     { address: actionLogAddress, abi: loadAbi("ActionLog") },
  USDC:          existing.USDC,
};

writeFileSync(resolve(ROOT, "deployments.json"), JSON.stringify(next, null, 2) + "\n");

console.log(`deployments.json updated for ${network} (chainId ${chainId})`);
console.log(`  AgentPassport: ${passportAddress}`);
console.log(`  ActionLog:     ${actionLogAddress}`);
