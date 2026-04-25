#!/usr/bin/env bash
# Deploy AgentPassport + ActionLog to Fuji, then sync deployments.json.
# Sources packages/contracts/.env so forge sees PLATFORM_PRIVATE_KEY etc.
# Run via `pnpm contracts:deploy`.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo ".env missing in packages/contracts. Run \`pnpm setup:env\` first." >&2
  exit 1
fi

set -a
. ./.env
set +a

: "${PLATFORM_PRIVATE_KEY:?must be set in packages/contracts/.env}"
: "${USDC_ADDRESS:?must be set in packages/contracts/.env}"
: "${NEXT_PUBLIC_FUJI_RPC:?must be set in packages/contracts/.env}"

forge script script/Deploy.s.sol \
  --rpc-url "$NEXT_PUBLIC_FUJI_RPC" \
  --broadcast \
  -vvv

node scripts/sync-deployments.mjs 43113
