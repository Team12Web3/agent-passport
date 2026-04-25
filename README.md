# Agent Passport Dashboard

Minimal hackathon MVP for **Agent Passport**:

- Solidity smart contract: `AgentPassport.sol`
- Next.js dashboard: monitor agents, trust status, and task progress
- thirdweb connect (email in-app wallet + MetaMask) for a single clean auth + signing layer
- Create Agent tab to create passports on-chain (or local demo fallback)

## Tech Stack

- Next.js (App Router)
- React
- TailwindCSS
- ethers.js
- thirdweb (wallet connect + tx signing)
- Avalanche Fuji RPC

## Features

- `/auth` connect screen (thirdweb `ConnectEmbed`)
- `/dashboard` page with dark admin-style UI
- Agent cards showing:
  - Agent ID
  - Owner wallet (shortened)
  - Reputation score
  - Status (`Active` / `Revoked`)
  - Trust state (`Trusted` / `Untrusted`)
  - Task progress bar (mocked for demo)
- Expandable card details per agent
- **Create Agent** tab:
  - Calls `createPassport(agentId)` on Fuji via thirdweb (`prepareContractCall` + `useSendTransaction`)
  - If contract address is not configured, adds local demo agent
- On-chain reads via `ethers`:
  - `getPassport(agentId)`
  - `verifyAgent(agentId, minScore)`
- Automatic mock fallback when RPC/contract calls fail

## Smart Contract

`AgentPassport.sol` includes:

- `createPassport(string agentId)`
- `verifyAgent(string agentId, uint256 minScore)`
- `updateScore(string agentId, uint256 newScore)` (owner only)
- `getPassport(string agentId)`

## Getting Started

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/auth` (connect)
- `http://localhost:3000/dashboard` (after connecting)

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=YourThirdwebClientId
```

- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` is required for `/auth` + wallet-backed actions
- If `NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS` is set, dashboard reads from Avalanche Fuji + contract
- If `NEXT_PUBLIC_AGENT_PASSPORT_ADDRESS` is not set, dashboard uses mock/demo mode for passport cards (wallet connect still works)

## Network

- Avalanche Fuji RPC:
  - `https://api.avax-test.network/ext/bc/C/rpc`

## Notes for Demo

- Trust threshold is currently `500`
- Agent list is mock-seeded plus any newly created local/on-chain agents
- Progress values are deterministic mock percentages for demo reliability

