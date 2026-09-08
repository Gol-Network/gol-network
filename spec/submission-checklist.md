# GOL ETHOnline submission checklist

Status: preparation draft, checked against public official sources on 8 September 2026. Empty checkboxes mean not yet demonstrated. No account dashboard was accessed, no partner was contacted, and no submission was made during this specification pass.

## 1. Event facts and human-owned verification

The public deadline is **13 September 2026, 12:00 EDT = 16:00 UTC = 23:00 Asia/Ho_Chi_Minh**. Aim to submit at 18:00 local time. Public rules permit up to three partner selections, require a 2 to 4 minute video, and require disclosure of AI use and specification/prompt artifacts. Start Fresh excludes earlier project-specific code, designs and assets; public libraries/starters are allowed. Continuity permits existing-codebase work with disclosure. Meaningful incremental history is required; no daily commit quota is imposed by this plan. [Official event details](https://ethglobal.com/events/ethonline2026/info/details)

- [ ] Submitter confirms their registered participant identity, team membership, stake, track, and ability to publish source. Private registration/application status has not been verified here; do not infer it from planning notes.
- [ ] Check exact check-in windows and workshop/judging sessions in the dashboard. Session and judging times require dashboard confirmation before they are used as reminders.
- [ ] Record actual feedback/reviews and human design decisions. Do not attribute other people's work to the sole submitter or imply AI replaces the required human contribution.
- [ ] Confirm final form constraints, selected pool and allowed prize combinations before submitting. Naming a partner in README does not register for its prize.

Official onboarding describes individually accepted/staked participants, teams up to five, and solo participation. It describes stake return after successful submission, generally around three weeks after the event, not an immediate refund. It does not establish this submitter's personal status or guarantee refund for an incomplete entry. [Official onboarding](https://ethglobal.com/events/ethonline2026/info/start)

## 2. Start Fresh boundary

GOL is a Start Fresh submission. All project-specific code, contracts, designs, prompts, and assets are created during the hackathon. Only public libraries and starter scaffolds may be used, with exact attribution and their license notices retained.

### Public dependency/starter inventory

Verified from upstream GitHub metadata/LICENSE files or npm package metadata on 8 September. These licenses establish an initial inventory, not a claim that every transitive dependency is cleared. Pin exact installed versions and retain notices during M0.

| Dependency | Upstream license evidence | Use |
|---|---|---|
| OpenZeppelin Contracts | MIT, [upstream](https://github.com/OpenZeppelin/openzeppelin-contracts) | SafeERC20 and reentrancy utilities |
| viem | MIT, [actual source license](https://raw.githubusercontent.com/wevm/viem/main/src/LICENSE) | Typed EVM calls and bigint units; top-level LICENSE is a pointer |
| Next.js | MIT, [upstream](https://github.com/vercel/next.js) | Web and server routes |
| Graph tooling | Apache-2.0, [upstream](https://github.com/graphprotocol/graph-tooling) | Generated subgraph scaffolding and CLI |
| Privy React 3.40.0 / Node 0.34.0 | Apache-2.0 in [React registry](https://registry.npmjs.org/@privy-io/react-auth/latest) and [Node registry](https://registry.npmjs.org/@privy-io/node/latest) at inspection | Wallet/auth and signer integration; service account terms still apply |
| OpenAI JS 7.10.0 | Apache-2.0, [registry](https://registry.npmjs.org/openai/latest) at inspection | Responses adapter; service access separately provisioned |

Record provenance in `THIRD_PARTY_NOTICES.md`: component, original URL, source commit/version, file paths, license/notice path, modifications, date incorporated, and whether pre-existing or built during event. Also inventory React, TypeScript, test tools, SQL client and any optional assets at exact selected versions before release. Generated scaffold is attributed as scaffold; actual business logic remains identified separately.

## 3. Partner eligibility evidence

These are track-target checklists, not promises of qualification or awards. Do not present combined prize pools as an expected payout.

### The Graph

Official page has separate $5,000 AI pools for Start Fresh and Continuity. Both need meaningful AI use of live Graph provider data, public code and runnable documentation/video. Mock/static/local-only data does not qualify. A separate composition track requires meaningful standardized data or multiple Graph products; a single custom subgraph alone is insufficient. [The Graph event requirements](https://ethglobal.com/events/ethonline2026/prizes/the-graph)

- [ ] Select the Start Fresh pool and confirm it matches the registered submission track.
- [ ] Show the real refusal event in a live Graph provider response, with endpoint and deployment ID documented; keep API key private.
- [ ] Show a natural-language explanation that uses those records and valid transaction references.
- [ ] README/SKILL enables reproduction; public source and video included.
- [ ] Composition track excluded from this build. No second Graph product or MCP integration is planned.

Arc testnet support is explicitly documented under `arc-testnet`, `eip155:5042002`; this is the intended network. Live GOL indexing remains an M2 acceptance gate. [Exact Graph network](https://thegraph.com/docs/en/supported-networks/arc-testnet/)

### Arc

The official page requires a working frontend/backend, architecture diagram, documented demo and repository, and explicit bounty naming. Payment/treasury flows fit its finance theme. Its dedicated Agentic Economy title and description explicitly call for Circle Agent Stack; the baseline does not implement it. A Continuity DeFi/Agentic category exists. The mainnet-related categories carry a 30 September deployment/readiness commitment. [Arc event requirements](https://ethglobal.com/events/ethonline2026/prizes/arc)

- [ ] Select the applicable finance/payment category for the confirmed track; describe the USDC-only controlled-payment flow.
- [ ] Live Arc contract verified, exact public address and source commit published.
- [ ] Working frontend and backend, diagram image, docs and demo included.
- [ ] Dedicated Circle Agent Stack integration and its bounty are excluded from this build.
- [ ] Exclude testnet-to-mainnet commitment categories; no mainnet work is authorized by this plan.

### Privy

The B2B category requires core Privy integration, a wallet, a working business flow and a real Privy control. The financial-flow category requires a generally available functional wallet flow and explanation of its value. Service features needing guided onboarding cannot substitute for that required live flow. [Privy event requirements](https://ethglobal.com/events/ethonline2026/prizes/privy)

- [ ] Owner uses a real Privy wallet to create/fund the business account and sign its mandate.
- [ ] Separate agent wallet has a policy-restricted additional signer; wrong-destination request is demonstrably rejected.
- [ ] Demonstrate contractor-spend workflow and owner revoke/withdraw controls.
- [ ] Explain Privy onboarding and scoped signing separately from contract-enforced budget.
- [ ] Confirm dashboard eligibility for the selected event track; public page alone does not establish account-specific eligibility.

Alternative partner integrations, hardware purchases, alternate chains, and routing are excluded from this submission.

## 4. P0 release checklist

- [ ] P0-1: deployed/verified Arc account contract, all policy/security tests, independent refusal getter and explorer evidence.
- [ ] P0-2: functioning agent runner; actual receipt reporting; owner/agent credential isolation.
- [ ] P0-3: live subgraph indexes both outcomes; real API-key provider query; measured delay and recovery behavior.
- [ ] P0-4: grounded question works; stale/empty/unavailable states tested.
- [ ] P0-5: one-page Privy app and working backend; meaningful control; funding/withdrawal/revoke included.
- [ ] P0-6: publicly reachable live demonstration URL and a clean-browser judge path.
- [ ] P0-7: README, root ARCHITECTURE.md with diagram image, SKILL.md, actual FEEDBACK.md, specs/prompts/provenance.
- [ ] P0-8: 512x512 logo, 640x360 cover, minimum three actual app screenshots. Planned asset sizes; validate exact dashboard dimensions.
- [ ] P0-9: short description <=100 chars, description >=280 chars, how-made >=280 chars. Planned copy bounds; validate exact dashboard constraints.
- [ ] P0-10: compliant 2 to 4 minute real human-narrated video uploaded and playable.

Also prepare name, tagline, emoji, category, tech stack, source-code URL and live-demo URL for the submission. Exact form validation and required asset fields require the authenticated dashboard; no public source inspected here proves every stated dimension or character bound.

## 5. Deployment and reproducibility

- [ ] Use GOL-specific Privy/model/Graph/hosting configuration and fresh testnet wallets; record only credential presence, never values.
- [ ] Verify runtime chain ID and ERC-20 decimals; wrong-chain config fails closed.
- [ ] Commit contract/compiler/optimizer/constructor settings, ABI, start block and deployed bytecode hash.
- [ ] Verify source on the configured Arc explorer; use its documented verification provider/API, not an assumed explorer hostname.
- [ ] Publish factory/account/agent/recipient addresses and execution/refusal transaction references in deployment metadata.
- [ ] Deploy subgraph with correct network/start block, then verify indexed hashes/amounts and `_meta` health.
- [ ] Authenticate AWS CLI with browser login and verify the exact `gol-production` EC2 account/region/instance, architecture/capacity and SSM/SSH access. Current inspection could not proceed because the session expired.
- [ ] Host Next.js frontend/backend, persistent worker and PostgreSQL on `gol-production` with Docker Compose and an HTTPS proxy. Use Subgraph Studio externally; no self-hosted Graph Node/IPFS. Record DNS, TLS and health-check evidence; no Vercel deployment or cron required.
- [ ] Keep PostgreSQL private with persistent encrypted EBS-backed storage, restricted runtime credentials and off-VM S3 backups. Test restore and preserve database data across container replacement.
- [ ] Complete [Studio setup](studio-setup.md): wallet connection, subgraph creation, deploy-key access, query API key and actual endpoint verification. Distinguish Studio deployment from optional network publication.
- [ ] Back up the database, drain worker claims, run compatible migrations, configure allowed origins and GOL-only secrets, and activate pinned release images. Verify restart/reboot recovery and rollback without discarding pending requests.
- [ ] Verify model/signer/Graph/RPC failures produce distinct honest UI states; API keys are not present in browser bundles.
- [ ] Run from a clean checkout using frozen lockfiles; save exact checks and test counts.
- [ ] Rehearse as a signed-out judge. Read-only demo data requires no credentials; interactive owner setup needs login and testnet funds with clear guidance.
- [ ] Keep a second funded test account and spare gas for rehearsal. Never share the owner's private key with judges.
- [ ] Record a final live acceptance evidence bundle tied to one source commit and deployment.

## 6. Recording plan: 3 minutes 30 seconds

This is a reproducible sequence, not a claim a video exists. Use screen capture, audible human narration and no soundtrack. Public guidance requires at least 720p and prohibits speed-up, phone recording and synthesized voice. It permits removing unnecessary waiting. No music is our production choice. Verify accepted file/container formats in the dashboard. [Official recording guidance](https://ethglobal.com/events/ethonline2026/info/details)

| Time | On-screen action | Narration purpose |
|---|---|---|
| 0:00 to 0:15 | GOL page, business account context | An operations agent can pay a contractor within an owner-set budget. No unverified incident anecdote. |
| 0:15 to 0:50 | Owner login, account funding/status, mandate review/create | Agent address, approved recipient, 100 per-payment/100 cumulative cap, seven-day expiry; owner signs. |
| 0:50 to 1:20 | `Pay 40 USDC` | Agent submits; show actual Executed receipt and 60 remaining. |
| 1:20 to 2:00 | `Pay 70 USDC` | Contract records CUMULATIVE_CAP refusal. Explain successful transaction status versus refused payment. |
| 2:00 to 2:25 | Explorer event and request getter, indexed row | Show 70 attempted, 60 headroom, no second transfer, same Graph transaction reference. |
| 2:25 to 3:00 | Ask why it was refused | Answer cites the indexed refusal; highlight source block and transaction link. |
| 3:00 to 3:30 | Architecture and owner revoke control | Name Arc, The Graph and Privy; show restricted signer and on-chain authority; conclude testnet scope. |

Preflight before recording: chain balance >=100 on a fresh mandate; agent and owner gas; exact recipient; model responding; subgraph healthy; valid session; hidden secrets; actual public URLs. If editing out indexing wait, preserve action order and show the real query result. Do not composite an unrelated event into the demo. Verify final duration/resolution/audio and watch the exported file once before upload.

## 7. Draft submission copy

These drafts describe intended behavior. Replace them with verified final implementation details and the actual public dependency inventory before submission.

**Name:** GOL

**Tagline / short description:** An agent payment account that enforces spending limits and explains refusals on-chain.

**Description:** GOL helps a small business owner let an AI operations agent pay approved contractors in USDC on Arc testnet. The owner sets a per-payment cap, a cumulative budget, approved recipients and an expiry. The account contract enforces those limits and records both payments and policy refusals. Owners can inspect the records through The Graph and ask why a request was refused, with answers linked to the underlying transactions. GOL verifies payment execution, not invoices or delivery.

**How it is made:** GOL combines a Solidity USDC account, a typed agent payment runner, Privy owner and agent wallets, and a one-page web application. A restricted signer submits agent requests while the contract controls the account's spending authority. Successful payments and persisted policy refusals are indexed by a subgraph on Arc testnet. The question layer fetches indexed records and produces explanations with transaction references. Our public repository documents tests, architecture, AI prompts, and public dependency attribution.

Avoid `first`, `cannot lose funds`, `audited`, `mainnet-ready`, `all requests are recorded`, or `eligible for every prize`. Use the final verified contract address, deployed endpoint, model snapshot, and actual provenance rather than generic placeholders when submitting.

## 8. Autonomy and final human actions

| Work | Who/constraint |
|---|---|
| Spec review | Anderson/submitter; Start Fresh and standalone runner selected; MCP excluded; application code awaits approval |
| Local code, meaningful tests, docs, prompts, source audit, asset preparation | Agent can complete after approval within the chosen scope |
| Account provisioning and provider access | Agent can configure with authorized access; owner handles login/consent and account terms |
| Source publication rights and Start Fresh confirmation | Submitter/rights holder; dashboard confirmation before submission |
| Testnet deployment and public hosting | Implementation phase; frontend/backend/worker on `gol-production` EC2 via AWS CLI and verified host access; GOL wallets/accounts only |
| Real business/partner feedback | Humans or actual observed integration results; never invented |
| Narration and final recording review | Human; no AI voiceover |
| Dashboard check-ins, prize selection and final submission | Registered submitter; record acknowledgement |
| Finalist attendance/Q&A | Submitter if selected; verify exact time in dashboard |

No feedback or permission message has been sent on the user's behalf. Remaining external-access gates do not justify pretending that local fixtures satisfy live requirements.
