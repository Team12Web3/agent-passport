# Agent Passport — Documentation

Everything you need to build, integrate, and demo this project in 26 hours.

## Read these in order

1. [**00 — Vision**](./00-vision.md) — what we're building and why
2. [**01 — Architecture**](./01-architecture.md) — system design, stack, repo layout
3. [**02 — User Flow**](./02-user-flow.md) — step-by-step user journey
4. [**03 — API Contracts**](./03-api-contracts.md) — every HTTP route, request/response shapes
5. [**04 — On-chain Contracts**](./04-onchain-contracts.md) — Solidity contract specs
6. [**05 — Environment Setup**](./05-environment-setup.md) — accounts to create, env vars
7. [**06 — Integration Plan**](./06-integration-plan.md) — hour-by-hour, checkpoints, fallback plans
8. [**07 — Demo Script**](./07-demo-script.md) — exact words and clicks for the pitch

## Per-person task cards

Pick the one that matches your role. Each card has deliverables, files you own, acceptance criteria you can check off, hour-by-hour plan, and copy-paste prompts for your coding agent.

| Person | Role                                | Card |
|--------|-------------------------------------|------|
| 1      | Backend & Contracts (senior)        | [→ task card](./tasks/person-1-backend-contracts.md) |
| 2      | Auth & Agent Wallets                | [→ task card](./tasks/person-2-auth-wallets.md) |
| 3      | Agent Execution UI                  | [→ task card](./tasks/person-3-execution-ui.md) |
| 4      | Dashboard & Agent Management        | [→ task card](./tasks/person-4-dashboard.md) |
| 5      | Frontend Shell, Polish, Demo Prep   | [→ task card](./tasks/person-5-shell-demo-prep.md) |

## Reference

- [Avalanche Fuji](./reference/avalanche-fuji.md) — RPC, faucets, Snowtrace, USDC
- [Thirdweb cheatsheet](./reference/thirdweb-cheatsheet.md) — auth + wallet snippets
- [Vibe-coding prompts](./reference/vibe-coding-prompts.md) — patterns that work, patterns that fail

---

## Cardinal rules (read at hours 0, 6, 12, 18, 24)

1. **Don't add features that aren't in the demo script.** If you can't justify it with "judges will see this," cut it.
2. **API contracts are frozen at hour 1.** Person 1 owns the file. Anyone can request a change in Discord/Slack; Person 1 approves and updates the doc.
3. **No ERC-4337. No ZK proofs. No staking.** These are out of scope. If someone suggests adding them at 2am, point them at this line.
4. **Use the safe demo URL.** Pick a static page (Wikipedia, books.toscrape.com). Do not pick Air NZ, Amazon, or anything with anti-bot protection.
5. **The demo flow is sacred.** Every PR that touches the run page or the trust protocol must be tested end-to-end before merging.
