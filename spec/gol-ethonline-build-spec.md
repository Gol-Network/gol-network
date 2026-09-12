# Gol × ETHOnline 2026 — Build Spec

### 🔴 Five days. One demo. Three partner prizes.

**Builder and submitter:** Hiển — **solo.** *(Applications closed; nobody else can be added.)*
**Written:** 8 September 2026 · **Submission deadline: Sunday 13 September, 11:00 PM Saigon** *(12:00 PM EDT)*
**Track:** ⭐ **Classic / Start Fresh.** ⛔ **No prior Morca code. Not one line.**

---

## 0. 🔴 Read this before anything else

### 0.1 ⭐ Solo — and three things that makes better, not worse

**Applications are closed. Nathan and Anderson cannot be added. Confirmed 8 September.**

| | Why this is survivable |
|---|---|
| **1** | ⭐⭐ **Most of the money never reaches live judging.** ETHGlobal: *"at most async events, the majority of prizes are paid out to projects that do not advance to the live judging."* **Partner prizes are judged from the repo and the video. No presentation, no Q&A** |
| **2** | ⭐ **The stake returns the moment a project is submitted.** **The floor is "submit something real," not "win"** |
| **3** | ⭐ **Solo is normal here.** ETHGlobal says it explicitly: *"if you prefer to hack solo, that's completely fine too"* |

### 0.2 🔴 What solo actually changes: the scope

**One person, five days, with management work continuing. So the build gets cut, hard.**

⭐⭐ **The cut: the agent PAYS. It does not trade.**

**No routing, no DEX, no price feeds, no swap logic.** **A mandate, a USDC transfer on Arc, and a refusal when it goes out of bounds.**

> **That is still exactly Gol v0 — an owner sets a boundary, an agent works inside it, and the chain says no when it doesn't.**

⭐ **And it loses us nothing:** Arc's agentic track asks for *"agents that hold wallets, make payments… using USDC."* Privy's tracks ask for a payment or approval flow. **The Graph doesn't care what the events are, only that they're real and queryable.**

### 0.3 ⚠️ You can still get help — the line is what you can explain

**Nathan and Anderson can review, debug, pair over a screen share.** ⛔ **The submission is yours, and if it reaches the finalist round you get three minutes of *"what challenges did you solve, and how?"***

⭐ **Practical rule: you must be able to explain every file. Don't ship code you haven't read.**

### 0.2 Why from-scratch and not continuity

**Both exist and both have real money. But the from-scratch pools we can reach are bigger, and eligibility is unconditional.**

⭐ **And the decisive reason: Gol genuinely has no code.** **We are not disguising anything — we are building a new product that happens to be built by people who have built related things.** ⛔ **Reusing Botanary's contracts here would be both a rules breach and a lie about what Gol is.**

---

## 1. What we are building

> ### **Gol — the agent account that says no, and proves it.**
>
> **An owner sets a spending mandate on-chain. An AI agent works inside it. Every action it was *refused* is emitted as an event, indexed, and queryable in natural language.**

### ⭐ The demo, which never changes

**Set a $100 limit. Let the agent trade. Let it try $101.**
**Show the chain refusing it — with the reason and the remaining headroom — in a block explorer.**
**Then ask the agent, in English: *"what have you been refused, and why?"* — and watch it answer from indexed on-chain data.**

⭐⭐ **That last step is what turns a wallet demo into a Graph submission. It is also, genuinely, the product.**

---

## 2. 🔴 Prize selection — and why

**⭐ Rule that shapes everything: *"If a partner has multiple tracks, you can be eligible for all of them while only counting as 1 Partner Prize."*** **So we pick partners with several from-scratch tracks, not single big numbers.**

| Pick | Partner | From-scratch pools we can reach | Why |
|---|---|---|---|
| **1** | ⭐⭐ **The Graph** | **AI Use Case (From Scratch) $5,000** + **Composable/Standardized $5,000** = **$10,000** | **The refusal record is worthless unless it's queryable. This is a real need, not a bolt-on** |
| **2** | ⭐⭐ **Arc (Circle)** | **Agentic Economy $1,667** + **DeFi/Onchain Finance $1,667** + **Testnet→Mainnet $3,500** = **$6,834** | *"AI agents that hold wallets, make payments, manage risk… using USDC"* — **that sentence is Gol** |
| **3** | ⭐ **Privy** | **B2B financial product $2,500** + **Best financial flow $2,500** = **$5,000** | *"spend management… organization wallets, policies, quorum approvals, intents"* — **our mandate console, described by them** |

> **Total from-scratch-eligible surface: ~$21,800 across three selections.**

### ⚠️ The one I'd swap in if we can

**Ledger — AI Agents x Ledger, $3,500 (from-scratch).** ⭐⭐ **The most on-thesis track in the whole event:**

> *"systems that ask for a human before anything irreversible"* · *"agents that use secrets they cannot leak: a broker hands out scoped capabilities, never the API key"* · *"human-in-the-loop agents where Ledger approves high-risk actions before funds move"*

🔴 **Blocker: it requires the Ledger Agent Stack and the Key Ring CLI — and probably a physical device.** ⭐ **If Nathan or Hiển has a Ledger, swap it in for Privy and it becomes our strongest narrative fit.** **Check tonight.**

### ⛔ Deliberately not selected

| | Why not |
|---|---|
| **Hedera $15,000** | ⭐ The agentic-payments track fits, **but it needs a live x402 service on a chain we've never touched, settled through a specific facilitator.** ⚠️ **Too much new surface for five days** |
| **1inch $7,000** | Requires Aqua/SwapVM and a "sophisticated DeFi position." ⛔ **A detour from the authority layer** |
| **Chainlink $3,000** | CRE Confidential Workflows is a whole new runtime. ⛔ **Not in five days** |
| **World $7,000** | ⚠️ **AgentKit — the on-thesis half — is Continuity-only.** Selfie Check isn't our product |
| **ENS $5,000** | ⭐ *"agents as namespaces, each with their own identity and permissions"* is a real fit — **but ENSv2 is Sepolia-only beta and we're deploying on Arc.** ⚠️ **Stretch goal only** |
| **Uniswap, Bazantic** | Small, and neither is load-bearing for us |

---

## 3. Scope — P0, P1, P2

### 🔴 P0 — without these there is no submission

**⭐ Seven items. Roughly one per day, with one day of slack. Sized for one person.**

| # | Deliverable | Size | ✅ Done when |
|---|---|---|---|
| **P0-1** | **Mandate contract on Arc testnet** | **~150 lines** | Deployed, verified, address public. **Enforces: per-tx cap · cumulative cap · recipient allowlist · expiry.** ⭐ **Emits `Refused(agent, rule, attempted, headroom, reason)` and `Executed(...)`** ⛔ **No swaps, no routing, no oracles** |
| **P0-2** | **Agent script** | **half a day** | Reads a goal, builds a **USDC transfer** on Arc, submits it through the mandate. **Gets through inside bounds; gets refused outside** |
| **P0-3** | **Subgraph on Subgraph Studio** | **1 day** | ⭐ Indexes `Executed` and `Refused`. 🔴 **Live data with an API key — mocked or local-only does NOT qualify** |
| **P0-4** | **Ask-in-English layer** | **half a day** | *"What was this agent refused, and why?"* → queries the subgraph → answers. ⭐ **This is what makes it an AI submission rather than a data dump** |
| **P0-5** | **One-page frontend + Privy** | **1 day** | 🔴 **Arc requires a working frontend AND backend.** ⭐ **One page is enough:** sign in with Privy · set a mandate · run the agent · **one timeline of allowed and refused, read from the subgraph.** **Plus at least one Privy control — a policy, signer, quorum or intent** |
| **P0-6** | 🔴 **Live deployed demo URL** | **2 hours** | ⚠️ **The submission form's "link to a demonstration" field is REQUIRED, not optional.** **Deploy the frontend to Vercel. A repo link is not enough** |
| **P0-7** | **Docs pack** | **half a day** | **README** (setup · architecture · payment flow · **AI attribution**) · **ARCHITECTURE.md + diagram** *(Arc requires this)* · **SKILL.md** *(The Graph asks for it)* · **FEEDBACK.md** · **`/spec`** |
| **P0-8** | ⚠️ **Submission assets** | **half a day** | 🔴 **Easy to forget and they block the form: logo 512×512 square · cover image 16:9 (640×360) · minimum 3 screenshots.** ⭐ Generate the logo and cover with an image tool; screenshots come from the working app |
| **P0-9** | **Written copy** | **1 hour** | **Short description ≤100 chars · Description ≥280 chars · "How it's made" ≥280 chars.** ⭐ **Write Friday, not Sunday** |
| **P0-10** | **Demo video, 2–4 min** | **half a day** | §6. ⚠️ **Record Saturday. Not Sunday** |

### ⭐ P1 — do these if P0 lands by Friday night

| # | Deliverable | Why |
|---|---|---|
| **P1-1** | **Compose a second Graph product** | ⭐⭐ Unlocks the **second $5,000 Graph track.** Layer the **Subgraph MCP** over our subgraph, or add a Substreams module. **"Simply querying one Subgraph does not qualify" for that track** |
| **P1-2** | **Circle Agent Stack** | Arc's agentic track names it directly. **Use the starter kit rather than hand-rolling** |
| **P1-3** | **Human-in-the-loop escalation** | Above a threshold, the agent asks the owner instead of acting. ⭐ **Cheap, and it's the Ledger narrative if we swap that in** |
| **P1-4** | **x402 pay-per-query** | ⭐ The Graph's AI track explicitly calls out *"let your agent pay per query autonomously with x402"* |

### ⚠️ P2 — only if everything else is done

| | |
|---|---|
| **P2-1** | ENS agent identity — name the agent, delegate scoped rights via Enhanced Access Control |
| **P2-2** | A second venue / route comparison |
| **P2-3** | Outcome verification — promised vs actual |

### ⛔ Explicitly out of scope

**Perps · launchpad · yield · cross-chain · mobile · Telegram · growth/quests · partial-failure recovery · the learning loop · multi-chain.**

🔴 **Every one of these is in the Gol PRD and none of them belong in this five-day build. If it isn't needed to show a refusal being enforced and then queried, it does not ship this week.**

---

## 4. Prize requirement checklists

**⚠️ These are disqualification conditions, not suggestions. Check each one off before submitting.**

### The Graph — AI Use Case (From Scratch), $5,000

- [ ] **The Graph is load-bearing** — the agent uses it as its source of blockchain data
- [ ] 🔴 **Live data from a Graph provider**, with an API key from Subgraph Studio. ⛔ **Mocked, local-only or static data does not qualify**
- [ ] **Meaningful work with the data** — reasoning, decisions, automation or a natural-language interface. ⛔ **Not just printing a query result**
- [ ] **Open source, with a clear README or `SKILL.md` so judges can run it**
- [ ] **Public repo + 2–4 minute demo video**
- [ ] ⭐ **Select the Start Fresh pool** *(the track is judged in two separate pools — we compete only against other from-scratch builds)*

### The Graph — Composable/Standardized, $5,000 *(P1 stretch)*

- [ ] **Compose two or more Graph products**, OR build on a standardized schema
- [ ] ⛔ **Querying one subgraph with no composition does not qualify**
- [ ] **Make the leverage clear: show what became easier because of the composition**

### Arc — all three tracks

- [ ] 🔴 **Working frontend AND backend**
- [ ] 🔴 **Architecture diagram**
- [ ] **Video demonstration + presentation**, with detailed documentation
- [ ] **GitHub repo link**
- [ ] 🔴 **State clearly in the submission which Arc bounty/bounties you are entering** — *they say this twice*
- [ ] **Meaningful use of Arc and USDC**
- [ ] For the **$3,500 Testnet→Mainnet** track: ⚠️ **deployed or deployment-ready on Arc mainnet by 30 September** — **a commitment that outlives the hackathon. Only claim it if we'll honour it**

### Privy

- [ ] **Privy integrated as a core part of the product**
- [ ] **At least one Privy wallet created or used**
- [ ] **A business/organization use case demonstrated**
- [ ] **At least one functional B2B workflow** — payment, approval, treasury op, or wallet admin
- [ ] 🔴 **At least one Privy control: policy, signer, key quorum, or intent**
- [ ] **Working demo + source access + a clear explanation of how Privy enables the product**

### 🔴 Event-wide, all submissions

- [ ] **Commit history spread across the week.** ⛔ **No single large commit on the final day — this is a stated disqualifier, and 1inch repeats it**
- [ ] **AI tool usage documented** — which files, which parts
- [ ] ⭐ **All spec files, prompts and planning artifacts in the repo** — see §5.3
- [ ] **Video: 2–4 min, ≥720p, no speed-up, no AI voiceover, no phone recording, no music-with-text**

---

## 5. Repo and process

### 5.1 Structure

```
gol/
├── README.md              architecture · setup · payment flow · AI attribution
├── ARCHITECTURE.md        + the diagram image        ← Arc requires this
├── SKILL.md               how an agent uses the query layer  ← Graph asks for this
├── FEEDBACK.md            partner feedback
├── /spec                  ⭐ the PRD + prompts + planning artifacts  ← see 5.3
├── /contracts             the mandate contract + tests
├── /subgraph              schema, mappings, manifest
├── /agent                 the loop + the natural-language query layer
└── /web                   the frontend
```

### 5.2 🔴🔴 Commit discipline — and the thing that turns "a lot of code" from a risk into proof

**The rule, verbatim:** *"You must commit frequently and not have small commits with large changes on GitHub."* ⭐⭐ **And *"proper use of git commit history"* is a stated round-1 qualification, not just a rule.**

#### The confusion to clear up first

**Two different worries get merged into one. They are not the same problem.**

| | The worry | The truth |
|---|---|---|
| **A** | *"Moving a lot of code into Gol looks illegal"* | 🔴 **It IS a rule breach — but a Rule 1 breach, not a commit-history one.** *"You may not add features to existing work."* ⛔ **Botanary's contracts are project-specific work, not boilerplate. No commit strategy fixes that, and slicing it up to look organic is worse — the repo is public for anyone to verify** |
| **B** | *"A lot of new code fast looks suspicious"* | ✅ **This is explicitly permitted.** AI tools are allowed with attribution. **The only requirement is that it's written this week and committed as it happens** |

#### ⭐⭐ The pattern: commit the spec BEFORE the code it produces

```
commit  "spec: mandate contract — caps, allowlist, expiry, refusal event"
commit  "contracts: MandateVault from spec (AI-assisted, prompt in /spec/01)"
commit  "contracts: fix headroom calc — spec was wrong about partial fills"
commit  "test: refusal fires at exactly cap+1"
```

> **Read that as a judge: a person directing a tool, catching its mistakes, and testing the result.**
>
> ⭐⭐ **It is exactly what they asked for — *"judges need to see the full picture of how you directed the AI, not just the generated output"* — and almost nobody else will do it.**

#### ⚠️ Hardcore in depth, not in volume

**One person producing 20,000 lines in five days invites the question even when the answer is honest.**

⭐ **The judging criteria are Technicality, Originality, Practicality, Usability and WOW. None of them is lines of code.**

**So: not fifty features. One thing built properly —** ⭐ **argument-level enforcement** *(cap the amount **inside** the call, not just the total)* · **tests for the nasty edges** *(exactly-at-cap, expiry boundary, replay)* · **a considered subgraph schema** · **a real MCP layer, not a wrapper.**

**Practical: commit at least three times a day, every day, starting tonight.**

### 5.3 ⭐⭐ The AI attribution rule is an advantage — use it

**ETHGlobal:** *"If you use a spec-driven workflow, you must include all spec files, prompts, and planning artifacts in your submission repository. Judges need to see the full picture of how you directed the AI, not just the generated output."*

⭐⭐ **We have a full product PRD. Almost nobody else will.** **Put `Gol-Lean-PRD.md` and this build spec in `/spec`, plus the prompts used.**

⚠️ **And the flip side is real:** *"submissions that rely entirely on AI without meaningful contributions from team members may not be eligible."* **The commit history and the Q&A round are how that gets judged.**

---

## 6. Demo video spec

**⛔ Every one of these causes a forced resubmission:**

| | Rule |
|---|---|
| **Length** | **2–4 minutes.** Under or over is rejected at upload |
| **Resolution** | **720p minimum** · `.mp4` or `.mov` |
| 🔴 | **No speeding up.** *"This will be verified manually"* — they say so on every page |
| ⛔ | **No AI voiceover or text-to-speech** |
| ⛔ | **No phone recording** |
| 🔴 | ⚠️ **"Audio without music" — no music at all, just you talking.** *(Stricter than the general guidance)* |
| | Intro ≤ 20 seconds · slides ≤ 4 bullets · edit out waiting |
| ⭐ | **It plays during your judging slot** — so it has to stand alone without you narrating over it |

### ⭐ The script

| Time | Content |
|---|---|
| **0:00–0:20** | The problem. *"An AI agent was talked into moving $200,000 with a message in Morse code. Nothing was hacked."* |
| **0:20–0:50** | Owner signs in with Privy, sets a mandate: **$100, this recipient, USDC, 7 days** |
| **0:50–1:40** | Agent runs, makes a legitimate payment on Arc. ✅ Allowed |
| **1:40–2:20** | ⭐⭐ **Agent tries $101. Refused. Show the event in the explorer — reason and headroom** |
| **2:20–3:10** | ⭐⭐ **Ask in English: "what have you been refused, and why?"** — agent queries the subgraph and answers |
| **3:10–3:40** | Architecture diagram, 30 seconds. Name Arc, The Graph, Privy explicitly |

⭐ **The refusal at 1:40 is the whole video. Everything before it is setup and everything after is proof.**

---

## 7. Day by day

| Day | The one thing that must land | Also |
|---|---|---|
| 🔴 **Tue 8** | **Repo init + first commit** *(spec first, then code)* | Check-in #1 (late is fine). **Create the project on the dashboard: emoji, name, category.** Arc testnet account + faucet. **8 PM: Arc workshop** |
| **Wed 9** | ⭐⭐ **Contract deployed to Arc testnet, both events firing** | Tests for the nasty edges. Trigger a refusal by hand and see the event |
| **Thu 10** | ⭐⭐ **Subgraph live on Subgraph Studio, indexing real events** | **8 PM: Feedback Session #2.** Start the architecture diagram |
| **Fri 11** | **Agent script + ask-in-English layer, end to end** | 🔴 **Check-in #2 by 10:59 AM.** ⭐ **Write the three text fields — short description, description, how-it's-made** |
| **Sat 12** | **Frontend deployed to a live URL + Privy. Then record the video** | 🔴 **Logo, cover image, 3 screenshots.** README · ARCHITECTURE · SKILL · FEEDBACK · `/spec` |
| **Sun 13** | ⭐⭐ **Submit by 6 PM Saigon — five hours early** | ⛔ **Bug fixes only. No new features** |

### 🔴 Form fields that block submission — get these ready, not discovered

**The form warns: *"You're missing the following to start this form"* and lists them. All required:**

**Logo · Project banner/cover · at least 3 screenshots · demo video · name, tagline, emoji, category, description, how-it's-made, source-code URL · tech stack · ⚠️ a live demonstration link.**

**Two form decisions, both settled:**

| Field | ✅ Choose | Why |
|---|---|---|
| **Track** | **Building from Scratch** | ⚠️ *"You will only be eligible for the prizes from the track you select."* **Locks out every Continuity-only prize — the right trade, our from-scratch pools are bigger** |
| **Submission type** | ⭐ **Top 10 Finalist & Partner Prizes** | **Costs nothing — partner judging happens either way.** ⚠️ **If you advance, you present live Monday 14 Sept, 12:00 PM EDT = midnight Saigon.** ⭐ **Worth staying up for** |

### ⚠️ The cut list, in the order I'd cut

**If Thursday night arrives and the subgraph isn't indexing, start cutting from the top:**

| | Cut | Costs us |
|---|---|---|
| **1** | **Frontend down to a single static page** reading the subgraph | Nothing that matters. **A working refusal beats a pretty page with nothing behind it** |
| **2** | **Privy down to plain wallet connect** | 🔴 **Privy as a prize selection.** Swap it for a partner we already satisfy |
| **3** | ⛔ **Never cut** the contract, the subgraph, or the ask-in-English layer | **Those three are the submission** |

🔴 **Absolute floor, if everything goes wrong: contract deployed + one refusal visible in the explorer + a 2-minute video.** ⭐ **That is still a valid submission, your stake comes back, and Gol has a public address.**

---

## 8. Judging — what they score

**Technicality · Originality · Practicality · Usability · WOW Factor**

⭐⭐ **Our answer to Originality and WOW is the same thing: almost every project in that showcase demos something *working*. We demo something *refusing* — on purpose, on-chain, with a receipt.**

**Async round screens roughly the top 20% into live judging.** ⚠️ **But partner prizes are judged separately and most of the money goes to projects that never reach the live round.** ⭐ **So the partner checklists in §4 matter more than the finalist path.**

**Prepare answers for:** *What inspired it? · What tools did you use, and why? · What challenges did you solve, and how?*

---

## 9. ⛔ Ways this goes wrong

| Risk | Prevention |
|---|---|
| 🔴 **Solo, and management work doesn't stop** | ⭐ **Block the mornings. One deliverable per day — §7. If a day's item doesn't land, cut from §7's list rather than pushing everything right** |
| 🔴 **Subgraph uses mocked data** | ⛔ **Explicitly disqualifying for The Graph. Live provider, API key, real events** |
| 🔴 **One big commit on Sunday** | **Commit three times a day from tonight** |
| **Video rejected at upload** | **Record Saturday. Check length and resolution before uploading** |
| **Scope creep into the Gol PRD** | ⛔ **§3's out-of-scope list is binding. If it isn't a refusal being enforced and then queried, it doesn't ship** |
| **Arc mainnet promise we don't keep** | ⚠️ **Only claim the $3,500 track if we will actually deploy by 30 September** |
| **Prior Morca code leaks in** | ⛔ **Fresh repo, fresh contract. Not one line copied** |

---

## 10. What this is worth beyond the money

⭐⭐ **Gol has been a document with no deadline since 5 September. Every version of the PRD carries the same open question at the top: *Gol has no date.***

> **On 13 September that stops being true.**

**What we get regardless of prizes:** **a public showcase listing · a deployed contract with a real address · a subgraph with live data · a 3-minute demo video · and async judging feedback from partners who see hundreds of submissions.**

⭐ **All of which is exactly the evidence a community-fund application needs — which is what the Gol Complete PRD was written for.**

---

*Companion to `Gol_Complete_PRD_v1.md` (the full specification) and `Gol-Lean-PRD.md` (the business-side summary). ⛔ This build spec is deliberately much smaller than both — that is the point.*
