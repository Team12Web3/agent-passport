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

Every outbound HTTP request from an agent carries three custom headers — passport ID, signature, timestamp. Any website that adopts our protocol can verify in 30 lines of middleware that:

- This agent is registered on-chain
- It's actively owned by a real user
- Its history is auditable

In return, the website opens a "green channel": no CAPTCHA, clean data, possibly a paid API tier.

We ship a **reference implementation** of a trusting site as part of the demo, so judges can see the whole loop work.

## Why this wins three prize tracks

| Track                           | What we deliver                                              |
|---------------------------------|--------------------------------------------------------------|
| Avalanche C-Chain ($1,000)      | Real Fuji transactions for every agent task. Live Snowtrace. |
| Lumin Digital Identity ($500)   | Portable, owner-bound identity for non-human actors.         |
| Payments & Invoicing ($500)     | Action log doubles as on-chain invoice trail with stablecoin transfers. |

One mechanism, three narratives. The same `ActionLogged` event powers all of them.

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
