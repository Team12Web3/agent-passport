# 00 — Vision

## The problem

The internet was built for humans. Now AI agents are doing more of our digital chores — researching, comparing, scheduling, buying — but they're tripping over CAPTCHAs, popup ads, and "click here to verify you're human" flows designed to keep them out.

The current internet's defense against AI is a losing war. Worse, it punishes legitimate agents the same as malicious crawlers.

## The insight

We shouldn't be asking *"is this a human or an AI?"*

We should be asking *"is this agent trustworthy?"*

A trustworthy agent has:
- A **verifiable identity** — not a stolen API key, but a cryptographic credential bound to a real owner
- A **traceable history** — every action it takes is auditable
- **Skin in the game** — its own wallet, its own reputation, its own consequences

Web3 gives us all three primitives.

## What we're building

**Agent Passport** is a platform with two layers:

### Layer 1 — The platform (what users see)

A web app where you log in (email or wallet), spin up an AI agent in a wizard, and give it tasks. The agent has its own crypto wallet on Avalanche, executes the task, and produces a tamper-proof on-chain audit log of everything it did.

### Layer 2 — The protocol (what websites see)

Every outbound HTTP request from an agent carries a trust-header bundle. Any website that adopts our protocol can verify in roughly 30 lines of middleware that:

- `X-Agent-Passport-ID` resolves to an EAS credential and tells the site which developer, model stack, and labels are attached to the agent
- `X-Agent-Signature` plus `X-Agent-Timestamp` proves identity, freshness, and agreement to the current Terms of Service
- `X-Agent-Session-Grant` plus `X-Agent-Session-Proof` act like an employee ID: the owner wallet delegates a time-limited, permission-restricted session key for the agent
- `X-Agent-Claims` plus `X-Agent-Claims-Signature` turn the agent from a black box into an open box by carrying a signed JSON-LD claims packet with developer, model stack, labels, and trust score
- `X-Agent-Intent-Hash` binds the request to the user's original command
- `X-Agent-Action-Hash` identifies the concrete action currently being approved
- `X-Agent-Intent-Proof` cryptographically binds the action back to the original intent; for the hackathon demo this proof is simulated with ECDSA rather than a full zkVM receipt
- `StakeVault` gives the protocol crypto-economic consequences: high-value access can require active stake, and obvious abuse can trigger a slash against that passport ID

In return, the website opens a "green channel": no CAPTCHA, clean data, possibly a paid API tier.

We ship a **reference implementation** of a trusting site as part of the demo, plus a `/trust-lab` visual explainer for staking, session keys, open-box attestation, and verifiable intents, so judges can see the whole loop work.

## Why this wins two prize tracks

| Track                           | What we deliver                                              |
|---------------------------------|--------------------------------------------------------------|
| Avalanche C-Chain ($1,000)      | Real Fuji transactions for every agent task. Live Snowtrace. |
| Lumin Digital Identity ($500)   | Portable, owner-bound identity for non-human actors — revocable on-chain by the owner. |

One mechanism, two narratives. The same `ActionLogged` event powers both: it's the receipt for the Avalanche track, and the auditable trail behind the Lumin identity.

## North star

**A judge clicks our Snowtrace link and sees a real on-chain audit trail of an AI agent doing real work.**

That moment — "wait, the agent itself signed this tx?" — is what we're optimizing the entire build for.

## What success looks like at the demo

- 90 seconds, no live failures
- Login → create agent → run task → on-chain proof → trust protocol kill-shot
- Judge can independently verify every claim by clicking a Snowtrace link
- Audience understands the pitch in one sentence: *"trust by signature, not by CAPTCHA"*

## What success does NOT require

- A perfectly polished UI everywhere
- Real-world site integrations
- Mainnet deployment
- Mobile responsiveness
- More than 3 tools per agent
- More than one demo URL

If a feature doesn't directly support the north star, it's a distraction. Cut it.
