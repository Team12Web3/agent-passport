# 06 — Integration Plan

Most teams die at integration. Schedule it explicitly. Don't assume it happens.

## Hour 0 — Kickoff (everyone, together, 30 minutes)

1. Person 1 creates the GitHub repo with the skeleton from this docs folder. Everyone clones.
2. One designated person (Person 2) creates all the accounts in [`05-environment-setup.md`](./05-environment-setup.md).
3. Shared `.env.local` posted in 1Password / pinned message. Everyone copies.
4. Everyone runs `pnpm install && pnpm dev`. Sanity check: localhost:3000 works.
5. Person 1 deploys an empty Next.js app to Vercel. Everyone bookmarks the preview URL.
6. 5-minute standup: each person says their hour-0–4 plan in one sentence.
7. **Lock the API contract spec** ([`03-api-contracts.md`](./03-api-contracts.md)). Person 1 declares it frozen.

## Checkpoints

| Time   | Goal                                                              | How to verify                                              |
|--------|-------------------------------------------------------------------|------------------------------------------------------------|
| **T+4**  | Contracts deployed to Fuji; addresses in `deployments.json` on `main` | `cast call <address> "nextId()(uint256)" --rpc-url $RPC` returns 1 |
| **T+4**  | Login works on Vercel preview                                     | Person 2 demos in Discord                                  |
| **T+8**  | First agent created end-to-end (wallet + funding + passport mint) | Curl `/api/agents/create`; see Snowtrace tx              |
| **T+12** | Dashboard shows real agents from DB with live balances            | Open preview URL, see your agent                           |
| **T+14** | `/api/run` works end-to-end against books.toscrape.com or Wikipedia | curl streams events; final `done` event has tx hash      |
| **T+18** | Trust protocol round-trip works                                   | Hit `/api/trust/demo-site` without headers → 403; with → JSON |
| **T+20** | Run page UI streams real events; result card renders              | Click Run on preview; watch terminal                       |
| **T+22** | Full demo flow runs on preview URL with real Fuji txs             | Person 5 records a successful walkthrough                  |
| **T+24** | Trust-protocol kill-shot animation works                          | Toggle "without/with passport"; red→green animates         |
| **T+25** | Demo rehearsal #5 clean; backup video recorded                    | Phone records 90-second clean run                          |

If a checkpoint slips by more than 1 hour, the team **stops feature work** and all-hands on the lag. Falling behind compounds.

## Critical merge order

This is the only sequence that doesn't deadlock. Don't reorder.

1. **Hour 0–1** — Person 1: repo skeleton + API spec → main
2. **Hour 1–4** — Person 1: contracts deployed → main, `deployments.json` committed
3. **Hour 1–4** — Person 2: Thirdweb provider + login → main
4. **Hour 1–4** — Person 5: marketing landing page (uses Person 2's button placeholder) → main
5. **Hour 4–8** — Person 2: agent wallet + funding + signing utilities → main
6. **Hour 4–8** — Person 1: `/api/agents/create` (uses Person 2's utils) → main
7. **Hour 8–12** — Person 4: dashboard + create wizard (uses `/api/agents/*`) → main
8. **Hour 8–14** — Person 1: agent runtime + `/api/run` → main
9. **Hour 8–14** — Person 3: run page UI with mocked SSE → main
10. **Hour 14–18** — Person 3: switch to real `/api/run` → main
11. **Hour 14–18** — Person 1: `/api/trust/demo-site` with verification → main
12. **Hour 18–22** — Person 3: trust-protocol toggle + kill-shot animation → main
13. **Hour 22–26** — Person 5: demo rehearsals; everyone polishes assigned area

## Branch strategy

- `main` — always deployable; protected
- `feat/<person>-<thing>` — short-lived feature branches
- Open small PRs; squash-merge; don't sit on branches >2 hours
- Hour 22+: only critical fixes go to `main`. Polish goes to `polish/*` branches that don't auto-deploy.

## Daily rituals (every 4 hours)

15-minute standup at hours 4, 8, 12, 16, 20, 24:

- What I shipped since last standup
- What I'm shipping in the next 4 hours
- Where I'm blocked (someone responds with: "I'll unblock you in 15 minutes")

Keep it crisp. No retros, no philosophy. Ship.

## When things go wrong

| Problem                                | Fix                                                                              |
|----------------------------------------|----------------------------------------------------------------------------------|
| Firecrawl rate-limited or 5xx          | Runtime falls back to Jina Reader (no key). Already in spec.                     |
| Fuji RPC slow / down                   | Switch `NEXT_PUBLIC_FUJI_RPC` to a backup (Ankr public RPC). Have it ready.       |
| Funding tx fails                       | We have 3 pre-funded demo agents; switch to one of them.                          |
| Login broken on preview                | Roll back the offending PR. Reproduce on localhost first.                         |
| Contract bug found late                | DO NOT redeploy. Patch around it in the API layer. (e.g., skip a check, use a workaround.) |
| Vercel build broken                    | `git revert` last commit, deploy, then debug locally.                             |
| Demo wifi dies                         | Show backup video Person 5 recorded.                                              |
| Person stuck for >1 hour               | Pair with Person 1. If still stuck, cut the feature.                              |

## Pre-demo checklist (run at T+25)

```
[ ] Vercel preview URL is live and on the demo laptop's bookmarks
[ ] Demo laptop is wired to ethernet (not wifi) at the venue
[ ] Demo Google account is signed into Thirdweb (so OTP comes to a phone we control)
[ ] 3 pre-created funded agents exist in DB (in case live creation fails)
[ ] Backup video is on the laptop AND on a USB stick AND uploaded to YouTube as unlisted
[ ] Demo URL is loaded in a tab and passes a fresh run
[ ] Trust protocol toggle has been tested 3 times in a row
[ ] Slide deck is on the laptop AND on a USB stick
[ ] Phone has a hotspot in case of wifi failure
[ ] One team member knows the script; one is the clicker; one watches the laptop for warnings
```

## Hour-zero forbidden phrases

If you hear any of these in the first 4 hours, redirect:

- "What if we also added..." — no.
- "I think we should rethink..." — no.
- "Let's add full ERC-4337 or production-grade proving infra tonight" — no.
- "Let's switch to <library>" — no.

The plan is the plan. Follow it. Win.
