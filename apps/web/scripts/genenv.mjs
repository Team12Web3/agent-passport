// One-shot bootstrap for Person 1's local env.
// Generates: platform wallet keypair + AGENT_KEY_SECRET.
// Writes:    apps/web/.env.local (mode 600), packages/contracts/.env (mode 600).
// Refuses to clobber if either file already exists.
//
// Run once: `node scripts/genenv.mjs`
// Safe to delete after.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, chmodSync } from "node:fs";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const WEB_ENV      = `${REPO_ROOT}apps/web/.env.local`;
const CONTRACT_ENV = `${REPO_ROOT}packages/contracts/.env`;

if (existsSync(WEB_ENV) || existsSync(CONTRACT_ENV)) {
  console.error("Refusing to overwrite existing env files. Bailing.");
  process.exit(1);
}

const platformPk = generatePrivateKey();
const platform   = privateKeyToAccount(platformPk);
const agentSecret = randomBytes(32).toString("hex");

const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const USDC     = "0x5425890298aed601595a70AB815c96711a31Bc65";

const webEnv = `# --- Public ---------------------------------------------------------------
NEXT_PUBLIC_FUJI_RPC=${FUJI_RPC}
NEXT_PUBLIC_TW_CLIENT_ID=

# --- Server-only ----------------------------------------------------------
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=
FIRECRAWL_API_KEY=

PLATFORM_PRIVATE_KEY=${platformPk}
PLATFORM_ADDRESS=${platform.address}

AGENT_KEY_SECRET=${agentSecret}

USDC_ADDRESS=${USDC}

SNOWTRACE_API_KEY=
`;

const contractEnv = `# Used by: forge script script/Deploy.s.sol --rpc-url $NEXT_PUBLIC_FUJI_RPC --broadcast
PLATFORM_PRIVATE_KEY=${platformPk}
USDC_ADDRESS=${USDC}
NEXT_PUBLIC_FUJI_RPC=${FUJI_RPC}
`;

writeFileSync(WEB_ENV, webEnv, { flag: "wx" });
chmodSync(WEB_ENV, 0o600);
writeFileSync(CONTRACT_ENV, contractEnv, { flag: "wx" });
chmodSync(CONTRACT_ENV, 0o600);

console.log("ok");
console.log("PLATFORM_ADDRESS=" + platform.address);
