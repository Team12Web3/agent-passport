// Compiles contracts/AgentPassport.sol -> lib/AgentPassport.artifact.json
// Run with: npm run compile:contract  (or: node scripts/compile-passport.mjs)
//
// The artifact file contains { abi, bytecode } and is checked into git so the
// browser deploy button does not need any toolchain at runtime.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const sourcePath = resolve(root, "contracts/AgentPassport.sol");
const outPath = resolve(root, "lib/AgentPassport.artifact.json");

const source = readFileSync(sourcePath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "AgentPassport.sol": { content: source }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

const raw = solc.compile(JSON.stringify(input));
const out = JSON.parse(raw);

if (out.errors) {
  const fatal = out.errors.filter((e) => e.severity === "error");
  for (const e of out.errors) {
    console[e.severity === "error" ? "error" : "warn"](e.formattedMessage || e.message);
  }
  if (fatal.length > 0) {
    console.error(`solc reported ${fatal.length} error(s)`);
    process.exit(1);
  }
}

const contract = out.contracts["AgentPassport.sol"]["AgentPassport"];
if (!contract) {
  console.error("AgentPassport contract not found in solc output");
  process.exit(1);
}

const artifact = {
  contractName: "AgentPassport",
  compiledAt: new Date().toISOString(),
  solcVersion: solc.version(),
  abi: contract.abi,
  bytecode: "0x" + contract.evm.bytecode.object
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n");

console.log(`Wrote ${outPath}`);
console.log(`  solc:     ${artifact.solcVersion}`);
console.log(`  abi:      ${artifact.abi.length} entries`);
console.log(`  bytecode: ${(artifact.bytecode.length - 2) / 2} bytes`);
