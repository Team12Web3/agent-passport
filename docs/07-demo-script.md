# 07 - Demo Script

90 seconds. One person at the keyboard, one person narrating. Rehearse 5+ times.

---

## Setup before the demo

1. Demo laptop on the lectern, on ethernet.
2. Browser open on the preview URL, marketing page loaded.
3. Second tab: Snowtrace (`testnet.snowtrace.io`) at our `AgentPassport` contract address so judges can verify this is real if they ask.
4. Third tab: backup video as YouTube unlisted, ready to play if anything breaks.
5. Fourth tab: `/trust-lab`, ready for the visual verifiable-intents fallback or Q&A.
6. Fifth tab: `/trusted-browser`, ready for the proxy-cleaning demo against the hostile target page.
7. Phone hotspot ready.

---

## The script (with timing)

### 0:00-0:10 - Hook

**On screen:** marketing page hero.

**Narrator:**

> "The internet is in a war with AI agents. CAPTCHAs, popups, click-to-verify. It is a war the internet is going to lose, and meanwhile legitimate agents get blocked the same as malicious crawlers."

> "We think there is a better question to ask. Not 'is this AI', but 'is this AI trustworthy'."

> "Meet Agent Passport."

### 0:10-0:25 - Sign in

**Action:** Click **Continue with email**. Use a pre-set test email; OTP comes to a phone the team controls. Enter code.

**Narrator:**

> "I sign in with email. No MetaMask, no seed phrase, no crypto knowledge. Behind the scenes, Thirdweb provisions an embedded wallet for me automatically."

### 0:25-0:50 - Create an agent

**Action:** Empty dashboard appears. Create Agent dialog auto-opens.

- Name: **Researcher**
- Purpose: **Summarizes web pages**
- Tools: leave all 3 checked
- Click **Create**

Watch the progress: *Generating wallet... Funding wallet... Minting passport on Avalanche... Done.*

**Narrator:**

> "I name my agent. Tell it what to do. Pick its tools. Three checkboxes."

> "When I click Create, three things happen on Avalanche Fuji: the agent gets its own crypto wallet with its own private key. The platform funds it with test AVAX and USDC. And we mint an on-chain passport binding this agent to me, on Avalanche."

> "Three transactions, eight seconds, zero crypto knowledge required from the user."

### 0:50-1:00 - Show the dashboard

**Action:** Dashboard now shows the new agent card.

- Point at wallet address.
- Point at AVAX / USDC balance.
- Click **wallet address** to open Snowtrace in new tab.
- Optional: only if confident, show the funding tx is real.
- Close tab, back to dashboard.

**Narrator:**

> "Here is my agent. Real wallet, real balance, real on-chain passport. You can verify all of this independently on Snowtrace."

### 1:00-1:30 - Run a task

**Action:** Click **Run task** on the agent card.

URL: `https://en.wikipedia.org/wiki/Internet_bot` (or your tested-safe URL)

Prompt: `Summarize the main themes of this page.`

Click **Run with Passport**.

Right panel streams events in real-time. Do not read every line; let the audience see it scroll.

When the `done` event fires and the result card appears:

**Narrator:**

> "I give it a URL and a prompt. The agent goes off, scrapes the page, reasons about it with Claude, and produces a summary."

> "But more importantly, every action it took is bundled into a single on-chain transaction. One tamper-proof receipt of the agent's work."

**Action:** Click **View on Snowtrace** in the result card. New tab opens to a real `ActionLogged` event.

> "That is the agent's signature on Avalanche. Anyone in the world can audit what this agent just did, even if our company disappears tomorrow."

### 1:30-2:10 - Trust Protocol kill-shot

**Action:** Close Snowtrace tab. Scroll down to the **Trust Protocol** section.

Click **Run without Passport**.

The iframe overlays red: **403 - captcha_required**. Terminal logs `BLOCKED`.

**Narrator:**

> "Now here is the protocol. Imagine a website that wants to welcome trusted agents but block bad ones."

> "Without our passport, the request gets blocked. CAPTCHA. 403."

**Action:** Click **Run with Passport**.

Animation: red -> "Verifying passport..." -> green pulse. Iframe morphs into clean JSON.

> "With the passport, the website reads the agent's on-chain identity, checks the signed Terms of Service commitment, verifies the authorized session key, and checks that the current action is still bound to the user's original intent."

> "Trust by signature, not by CAPTCHA."

### 2:10-2:25 - Verifiable Intents visual

**Action:** If time permits or during Q&A, switch to `/trust-lab`.

Show the trust states quickly:

- `No Passport`
- `All Trust Layers`
- `No Stake`
- `Slash Stake`
- `Expired Session Key`
- `Over Budget`
- `Tamper Action`
- `Forge Intent Proof`
- `Forge Attestation`

**Narrator:**

> "For the hackathon, we simulate proof of execution with ECDSA signatures instead of hand-writing ZK circuits. The point is the logic flow: the website can see the passport, the active stake, the open-box claims packet, the delegated session key, the action hash, and a cryptographic proof that this action is still tied to the original command."

> "That is the trust premium. Untrusted agents get friction. Trusted agents get the green channel."

### 2:25-2:40 - Trusted browser proxy (optional)

**Action:** Switch to `/trusted-browser`.

Show:

- the raw hostile page in the main preview window
- click one scenario button so the same preview window swaps to the relay response
- the right-side panel with the trust bundle and verification steps

**Narrator:**

> "Here is the same hostile site in the main preview window. When I click a protocol scenario, that exact preview switches from the raw page to the relay response."

> "On the right, the trust panel shows the wallet header bundle and every verification step. If the bundle passes, our trusted relay fetches the page, strips popup ads, human-check prompts, and misleading click traps, and renders a clean operator-safe view."

> "This is the fallback path for sites that have not adopted the protocol natively yet."

### 2:40-2:55 - Close

**Action:** Stay on the green pulse animation or the trust-lab success state. Do not navigate away.

**Narrator:**

> "Built in 26 hours, on Avalanche."

> "Every agent action is a real transaction on Fuji. That is our submission for the Avalanche track."

> "Each agent has a portable, owner-bound digital identity. That is Lumin's track."

> "And the same on-chain log doubles as an invoice ledger with stablecoin payments per action. Payments and Invoicing."

> "One mechanism. Three prizes. Thank you."

---

## Handling questions

**"What if the agent goes rogue?"**
> "The owner can deactivate the passport on-chain instantly, revoke the session key, and a site can submit signed request evidence into the StakeVault slashing flow."

**"Why on-chain at all?"**
> "Verifiability without trust in our backend. A regulator or third-party auditor can check any agent's history directly on Avalanche. We could disappear and the trail still stands."

**"How is this different from API keys?"**
> "API keys identify a developer. Passports identify the agent. The agent owns its own wallet, has its own reputation, and produces a public audit log. It is a different unit of accountability."

**"How would real websites adopt this?"**
> "Our reference middleware is about 30 lines. It resolves the passport ID, checks the signed JSON-LD claims packet, verifies the delegated session key and its scope, confirms the passport still has active stake for high-value access, and validates that the current action is still cryptographically bound to the original intent before opening a green channel."

**"Is this real ZK?"**
> "For the hackathon demo, the proof-of-execution step is simulated with ECDSA so we can demonstrate the logic flow quickly. The interface is designed so we can swap in a RISC Zero receipt later without redesigning the protocol."

**"Is this full ERC-4337?"**
> "For the hackathon demo, the session-key layer simulates ERC-4337 semantics with owner-signed delegated session grants. That lets us demonstrate time limits, scope limits, and budget limits without rebuilding the wallet stack."

**"Did you really do all this in 26 hours?"**
> "Yes. The Snowtrace timestamps prove it." *(Smile.)*

---

## What NOT to do

- Do not sign up a fresh email live. Use the pre-prepared account.
- Do not click anything you did not rehearse.
- Do not navigate Snowtrace too long. It is a verification flash, not a tour.
- Do not apologize for what is missing. Talk about what is there.
- Do not say "we ran out of time." Say "we focused on..."
- Do not use jargon judges might not know. Say "Avalanche" not "C-Chain"; say "wallet" not "EOA"; say "audit trail" not "Merkle root".

## What to do

- Smile.
- Make eye contact with the panel during the close.
- Land "trust by signature, not by CAPTCHA" with confidence.
- Have your phone visible on the table. The OTP comes there and shows this is real, not staged.
- End on the green pulse animation or the trust-lab success state. Do not navigate away.
