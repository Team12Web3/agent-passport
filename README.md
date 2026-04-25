# Agent Passport Demo

Hackathon scaffold for a Web3 Agent Passport on Avalanche Fuji C-Chain.

This repo includes:

- `contracts`: a minimal non-transferable Agent Passport contract.
- `apps/target-site`: a mock human-only website plus a verified agent API route.
- `apps/agent-demo`: a script that signs an EIP-712 AgentRequest and calls the target API.

## Demo story

1. Human-only site shows popups, confusing buttons, and a manual human check.
2. Agent signs a structured EIP-712 request with its wallet.
3. Target site verifies the signature.
4. Target site reads the AgentPassport contract on Avalanche Fuji.
5. If valid, target site returns clean machine-readable JSON.
6. If the passport is revoked, the same request fails.

## Prereqs

- Node.js 20+
- pnpm
- Avalanche Fuji AVAX for the deployer wallet and agent wallet

## Setup

```bash
pnpm install
cp .env.example .env
cp .env.example contracts/.env
cp .env.example apps/target-site/.env.local
cp .env.example apps/agent-demo/.env
```

Update the copied env files with your private keys and deployed contract address.

## Deploy contract to Fuji

```bash
pnpm contracts:compile
pnpm contracts:deploy:fuji
```

Copy the deployed `AgentPassport` address into:

```txt
apps/target-site/.env.local
apps/agent-demo/.env
```

## Mint an Agent Passport

The deploy script only deploys. For speed, use Hardhat console or add a small script.
The function you need is:

```solidity
mintPassport(address agentWallet, string metadataURI, bytes32 capabilitiesHash)
```

Example capability hash input can be the keccak256 hash of:

```txt
read_products,compare_prices
```

## Run target site

```bash
pnpm dev:target
```

Open:

```txt
http://localhost:3001
```

## Run agent request

```bash
pnpm agent:request
```

Expected success:

```json
{
  "ok": true,
  "status": "verified_agent",
  "agentMode": true
}
```

Expected failure after revocation:

```json
{
  "ok": false,
  "error": "Agent passport is not valid or has been revoked."
}
```

## Important safety framing

This project is not about bypassing CAPTCHA or sneaking around website security.
It demonstrates an opt-in agent access lane where websites intentionally support verified agents.
