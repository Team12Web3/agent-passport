# 07 — Demo Script

90 seconds. One person at the keyboard, one person narrating. Rehearse 5+ times.

---

## Final Fill-Ins

- Preview URL: `TO_BE_SET_AFTER_DEPLOY`
- Snowtrace contract tab: `TO_BE_SET_AFTER_DEPLOY`
- Backup video URL: `TO_BE_SET_AFTER_RECORDING`
- Narration: `TO_BE_ASSIGNED`
- Clicking: `TO_BE_ASSIGNED`
- Camera / timer: `TO_BE_ASSIGNED`
- Demo email: `TO_BE_ASSIGNED`
- Demo OTP phone: `TO_BE_ASSIGNED`
- Demo URL: `https://en.wikipedia.org/wiki/Internet_bot`
- Safe fallback URL: `https://en.wikipedia.org/wiki/Web_scraping`
- Demo prompt: `Summarize the main themes of this page and explain why trusted AI agents need verifiable identity.`

## Final Rehearsal Checklist

- [ ] Preview URL bookmarked on the demo laptop
- [ ] Snowtrace tab open and tested
- [ ] Backup video saved locally
- [ ] Backup video uploaded as unlisted YouTube link
- [ ] Backup video copied to USB
- [ ] Three funded demo agents pre-created
- [ ] Demo Google account signed in and OTP path confirmed
- [ ] Phone hotspot tested
- [ ] Printed copy of this script packed

---

## Setup before the demo

1. Demo laptop on the lectern, on ethernet.
2. Browser open on **preview URL**, marketing page loaded.
3. Second tab: **Snowtrace** at our `AgentPassport` contract address so judges can verify this is real if they ask.
4. Third tab: backup video as YouTube unlisted, ready to play if anything breaks.
5. Phone hotspot ready.

---

## The script (with timing)

### 0:00–0:10 — Hook

**On screen:** marketing page hero.

**Narrator:**

> "The internet is in a war with AI agents. CAPTCHAs, popups, click-to-verify. It's a war the internet is going to lose, and meanwhile *legitimate* agents — yours, mine — get blocked the same as malicious crawlers."

> "We think there's a better question to ask. Not *'is this an AI'* — but *'is this AI **trustworthy**'*."

> "Meet Agent Passport."

### 0:10–0:25 — Sign in

**Action:** Click **Continue with email**. Use a pre-set test email; OTP comes to a phone the team controls. Enter code.

**Narrator:**

> "I sign in with email — no MetaMask, no seed phrase, no crypto knowledge. Behind the scenes, Thirdweb provisions an embedded wallet for me automatically."

### 0:25–0:50 — Create an agent

**Action:** Empty dashboard appears. Create Agent dialog auto-opens.

- Name: **Researcher**
- Purpose: **Summarizes web pages**
- Tools: leave all 3 checked
- Click **Create**

Watch the progress: *Generating wallet… Funding wallet… Minting passport on Avalanche… Done.*

**Narrator:**

> "I name my agent. Tell it what to do. Pick its tools. Three checkboxes."

> "When I click Create, three things happen on Avalanche Fuji: the agent gets its own crypto wallet — with its own private key. The platform funds it with test AVAX and USDC. And we mint an on-chain passport binding this agent to me, on Avalanche."

> "Three transactions, eight seconds, zero crypto knowledge required from the user."

### 0:50–1:00 — Show the dashboard

**Action:** Dashboard now shows the new agent card.

- Point at wallet address.
- Point at AVAX / USDC balance.
- Click **wallet address** to open Snowtrace in new tab.
- *(Optional — only if confident)* show the funding tx is real.
- Close tab, back to dashboard.

**Narrator:**

> "Here's my agent. Real wallet, real balance, real on-chain passport. You can verify all of this independently on Snowtrace."

### 1:00–1:30 — Run a task

**Action:** Click **Run task →** on the agent card.

URL: `https://en.wikipedia.org/wiki/Internet_bot` *(or your tested-safe URL)*

Prompt: `Summarize the main themes of this page and explain why trusted AI agents need verifiable identity.`

Click **Run with Passport**.

Right panel streams events in real-time. Don't read every line — let the audience see it scroll.

When `done` event fires and the result card appears:

**Narrator:**

> "I give it a URL and a prompt. The agent goes off, scrapes the page, reasons about it with Claude, and produces a summary."

> "But more importantly — *every action it took is bundled into a single on-chain transaction*. One tamper-proof receipt of the agent's work."

**Action:** Click **View on Snowtrace** in the result card. New tab opens to a real `ActionLogged` event.

> "That's the agent's signature on Avalanche. Anyone in the world can audit what this agent just did, even if our company disappears tomorrow."

### 1:30–2:10 — Trust Protocol kill-shot

**Action:** Close Snowtrace tab. Scroll down to the **Trust Protocol** section.

Click **Run without Passport**.

The iframe overlays red: **403 — captcha_required**. Terminal logs `BLOCKED`.

**Narrator:**

> "Now here's the protocol. Imagine a website that wants to *welcome* trusted agents but block bad ones."

> "Without our passport, the request gets blocked. CAPTCHA. 403."

**Action:** Click **Run with Passport**.

Animation: red → "Verifying passport..." → green pulse. Iframe morphs into clean JSON.

> "With the passport — three signed headers — the website verifies us in 30 lines of middleware, and opens a green channel."

> "*Trust by signature, not by CAPTCHA.*"

### 2:10–2:30 — Close

**Action:** Stay on the green-pulse animation. Don't navigate away.

**Narrator:**

> "Built in 26 hours, on Avalanche."

> "Every agent action is a real transaction on Fuji — that's our submission for the Avalanche track."

> "Each agent has a portable, owner-bound digital identity — Lumin's track."

> "And the same on-chain log doubles as an invoice ledger with stablecoin payments per action — Payments and Invoicing."

> "One mechanism. Three prizes. Thank you."

---

## Handling questions

**"What if the agent goes rogue?"**
> "The owner can deactivate the passport on-chain instantly. The trust score also drops on bad behavior — every accepting site sees that score in real-time."

**"Why on-chain at all?"**
> "Verifiability without trust in our backend. A regulator or third-party auditor can check any agent's history directly on Avalanche. We could disappear and the trail still stands."

**"How is this different from API keys?"**
> "API keys identify a developer. Passports identify the *agent*. The agent owns its own wallet, has its own reputation, and produces a public audit log. It's a different unit of accountability."

**"How would real websites adopt this?"**
> "Our reference middleware is 30 lines. We're going to open-source it. Sites that want agent traffic — search, commerce, data APIs — have every incentive to add it. CAPTCHAs are a losing fight."

**"Did you really do all this in 26 hours?"**
> "Yes. The Snowtrace timestamps prove it." *(Smile.)*

---

## What NOT to do

- ❌ Don't sign up a fresh email live. Use the pre-prepared account.
- ❌ Don't click anything you didn't rehearse.
- ❌ Don't navigate Snowtrace too long — it's a verification flash, not a tour.
- ❌ Don't apologize for what's missing. Talk about what's there.
- ❌ Don't say "we ran out of time." Say "we focused on…"
- ❌ Don't use jargon judges might not know — say "Avalanche" not "C-Chain"; say "wallet" not "EOA"; say "audit trail" not "Merkle root".

## What to do

- ✅ Smile.
- ✅ Make eye contact with the panel during the close.
- ✅ Land *"trust by signature, not by CAPTCHA"* with confidence.
- ✅ Have your phone visible on the table — the OTP comes there, demonstrates this is real, not staged.
- ✅ End on the green pulse animation. Don't navigate away.

## Rehearsal Log

1. Rehearsal 1:
   Result:
   Notes:
2. Rehearsal 2:
   Result:
   Notes:
3. Rehearsal 3:
   Result:
   Notes:
4. Rehearsal 4 (recorded):
   Result:
   Notes:
5. Rehearsal 5:
   Result:
   Notes:
