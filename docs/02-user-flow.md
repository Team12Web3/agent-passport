# 02 — User Flow

The frictionless end-to-end journey, click-by-click.

## Stage 1 — Discovery

**User lands on `/` (marketing page)**

1. Sees hero: *"The Internet was built for humans. We're onboarding the agents."*
2. Sees a 3-step "How it works" explainer.
3. Clicks **Continue with email** in the hero.

→ Routes to `/login`.

## Stage 2 — Sign in

**User on `/login`**

1. Enters email → Thirdweb sends OTP → user enters code.
2. Thirdweb provisions an embedded wallet for the user silently.
3. We `upsert` a row in `users` table (Supabase) on first login.
4. If user has 0 agents → redirect to `/dashboard?onboard=1` (triggers wizard auto-open).
5. If user has ≥1 agent → redirect to `/dashboard`.

**Failure cases**
- OTP wrong → toast, retry.
- Network/Thirdweb down → toast with "try again", offer wallet sign-in fallback.

## Stage 3 — Onboarding (first-time only)

**User lands on `/dashboard?onboard=1`**

1. Empty-state card center-screen: *"Create your first agent."* with primary button.
2. *(If `?onboard=1` is set)* the **Create Agent** dialog auto-opens.

→ Stage 4.

## Stage 4 — Create Agent

**User in the Create Agent dialog**

1. **Name** — short text (placeholder: *"Researcher"*).
2. **Purpose** — one-line description (placeholder: *"Summarizes web pages"*).
3. **Tools** — three checkboxes, all checked by default:
   - Web Scraper (Firecrawl + Jina)
   - Summarizer (Claude)
   - On-chain Logger (Avalanche)
4. Clicks **Create**.

**Server-side, in order, with progress visible to user:**

| Step | UI text                          | What's happening                                      | Time   |
|------|----------------------------------|-------------------------------------------------------|--------|
| 1    | "Generating wallet..."           | Generate fresh EOA, encrypt private key, save to DB   | <500ms |
| 2    | "Funding wallet..."              | Faucet sends 0.05 AVAX + 5 USDC to agent              | ~3s    |
| 3    | "Minting passport on Avalanche..." | `AgentPassport.mintPassport(...)` from platform key | ~3s    |
| 4    | "Done!"                          | Close dialog, toast, refresh agent list               | —      |

5. Dialog closes; toast: *"Researcher is ready · view it →"*.
6. New agent card appears in the dashboard.

## Stage 5 — Dashboard

**User on `/dashboard`**

Sees a grid of their agents. Each card:

- **Name** + emoji avatar
- **Purpose** (one line)
- **Wallet address** truncated, click-to-copy + Snowtrace external link
- **AVAX balance** + **USDC balance** (live, refreshed every 10s)
- **Actions: N** pill
- **Run task →** button (primary)

User clicks **Run task →** on the agent.

→ Routes to `/agents/[id]/run`.

## Stage 6 — Run a task (the demo screen)

**User on `/agents/[id]/run`**

Layout:
- Top bar: agent name, wallet address pill, Snowtrace link, "← back to dashboard"
- Card with **URL** input + **Prompt** textarea + two buttons:
  - **Run with Passport** (primary)
  - **Run without Passport** (ghost — for the trust-protocol demo)
- Below: split-screen
  - Left (60%) — `iframe` of the URL inside browser-chrome wrapper
  - Right (40%) — terminal panel, hacker style, ready to stream

User pastes URL (`https://en.wikipedia.org/wiki/Internet_bot` or similar safe page), enters prompt (*"Summarize this page"*), clicks **Run with Passport**.

**Streaming sequence on the right panel:**

```
> [00:00] Starting agent · passport #42
> [00:01] Scraping https://en.wikipedia.org/wiki/Internet_bot
> [00:02] Got 24,317 chars · cleaning…
> [00:02] Cleaned · 18,940 chars after filter
> [00:03] ▸ thinking… "Summarizing the page about internet bots…"
> [00:05] ▸ tool: summarize { focus: "main themes" }
> [00:08] Action complete · 3 actions logged
> [00:09] Submitting on-chain log…
> [00:11] ✓ Logged · 0xab12…cd34
> [00:11] DONE
```

Bottom status bar pulses green.

Result card appears below split-screen:
- Summary text
- Actions: 3
- Fee: none
- **View on Snowtrace →** (clickable)
- Copy tx hash

## Stage 7 — Trust Protocol demo (the kill shot)

Below the result, a section: **Trust Protocol**.

User clicks **Run without Passport**.

- Same input.
- Right panel streams: `> Sending request without passport headers…`
- Iframe overlays with a red panel: *"403 — captcha_required · This site only accepts verified agents."*
- Terminal: `> BLOCKED. Verify your agent or solve the captcha.`
- Bottom status bar: red, shaking once.

User clicks **Run with Passport**.

- Right panel: `> Signing request with passport credentials…`
- 1.5s pause, then iframe content morphs into a clean JSON list of items.
- Status bar: green pulse, *"Passport valid · trust score 87"*.
- Terminal: `> ✓ Passport verified · clean data returned.`

This animation is the moment the audience gets it.

## Stage 8 — Inspect history

**User clicks back to agent or `/agents/[id]`**

Sees:
- Agent profile (name, purpose, wallet)
- Tabs: **Tasks**, **On-chain log**
- **Tasks** tab: list of runs with prompt, URL, status, result preview, Snowtrace link
- **On-chain log** tab: list of `ActionLogged` events read directly from Fuji

Each row links to Snowtrace for the relevant tx.

---

## Frictionless principles enforced throughout

- **Email is the front door.** Wallet sign-in is offered but never required.
- **No seed phrases.** Thirdweb embedded wallet handles user keys; we handle agent keys.
- **No manual funding.** Faucet pre-funds agent wallets at creation time.
- **No gas prompts.** Platform pays gas to mint passports; agent pays its own gas to log actions (out of its pre-funded AVAX).
- **No "advanced" tabs.** Three tools, one configurable agent, one clear flow.
- **No empty pages.** Every screen has a primary action, even when empty.
- **No silent failures.** Every error → toast with a recovery suggestion.

## What the user does NOT have to do

- Install MetaMask
- Buy crypto
- Understand gas
- Manage keys
- Read documentation
- Configure anything beyond a name + a sentence + 3 checkboxes
