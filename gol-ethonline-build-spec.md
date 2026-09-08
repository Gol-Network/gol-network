# GOL ETHOnline 2026 build spec

Updated 8 September 2026. This is the entry point for the hackathon scope. The documents under `spec/` define the implementation details. Application implementation still awaits specification approval; this documentation cleanup does not approve coding or deployment.

## Product

GOL lets a small business owner authorize an operations agent to pay approved contractors in USDC on Arc testnet. The owner sets a mandate on-chain. The account contract enforces per-payment and cumulative caps, a recipient allowlist, and expiry. It records executed payments and authenticated policy refusals so the owner can inspect them and ask questions grounded in The Graph's indexed records.

A payment proves a USDC transfer to an address. It does not verify an invoice, delivery, or the recipient's business identity.

## Read these specifications

| Document | Purpose |
|---|---|
| [Product specification](spec/hackathon-product-spec.md) | User journeys, scope, exact demo, states, and all ten P0 acceptance criteria |
| [Architecture](spec/architecture.md) | Contract/refusal semantics, signing, APIs, indexing, questions, and deployment design |
| [Implementation plan](spec/implementation-plan.md) | M0 to M5 tasks, meaningful tests, integration gates, and release evidence |
| [Submission checklist](spec/submission-checklist.md) | Dated event research, partner requirements, provenance, assets, recording, and final human actions |
| [Studio setup](spec/studio-setup.md) | Studio account, deploy key, query API key, CLI workflow, and endpoint verification |

Current user instructions take precedence, followed by the detailed hackathon specifications and this summary. Event eligibility is determined separately by official rules and the submitter's registration. The checklist retains dated research and explicitly identifies facts needing dashboard or live verification.

[Implementation prompt](spec/prompts/2026-09-08-autonomous-implementation.md) defines the autonomous coding assignment and submission attribution. The active specifications remain authoritative for product behavior.

## Exact acceptance demo

Use Arc testnet USDC, a fresh mandate, and an account funded with at least 100 USDC. Fund owner and agent gas separately. Set both caps to 100 USDC, approve recipient R, and set expiry seven days ahead.

1. Owner creates the mandate for agent A with an owner-signed transaction.
2. Agent pays 40 USDC to R. The contract emits `Executed`; cumulative headroom becomes 60.
3. Agent requests 70 USDC to R. The contract emits and stores `Refused` with `CUMULATIVE_CAP`, attempted amount 70, and headroom 60. No second transfer occurs.
4. Inspect the refusal independently through the contract getter and explorer event.
5. The live subgraph indexes that same record and transaction reference.
6. Ask why the agent was refused. The answer explains the remaining budget and cites the indexed transaction.

A policy refusal persists because its transaction returns successfully. Unauthorized or malformed requests and technical transaction failures have separate behavior; a reverted transaction cannot retain a refusal event. The owner can revoke the mandate and withdraw available account USDC to their own address.

## P0 deliverables

| ID | Required output |
|---|---|
| P0-1 | Tested account/factory contracts, deployed and verified on Arc testnet |
| P0-2 | Standalone agent payment runner with web access and a developer CLI |
| P0-3 | Live Studio subgraph indexing `Executed` and `Refused`, with verified provider query access |
| P0-4 | Read-only natural-language questions with indexed evidence and transaction citations |
| P0-5 | One-page app and backend: Privy login, owner setup/funding, mandate, agent payment, timeline, questions, revoke/withdraw, and a real restricted agent signer |
| P0-6 | Public HTTPS demo with a working frontend/backend and judge flow |
| P0-7 | README, ARCHITECTURE.md and diagram, SKILL.md, actual FEEDBACK.md, specs/prompts, and provenance |
| P0-8 | Logo, cover, and at least three screenshots from the working app |
| P0-9 | Submission description and how-it-is-made copy grounded in delivered behavior |
| P0-10 | Reproducible human-narrated demo video and final submission preparation |

Acceptance details and milestone mapping live in the product specification. Completion requires all ten items; local fixtures do not satisfy live integration gates.

## Selected implementation boundaries

- Arc testnet only; USDC payments only; one immutable account per owner and one active mandate per account.
- Owner credentials stay in the owner wallet. A separate Privy agent wallet has a policy-restricted backend signer. The on-chain mandate controls account spending.
- Standalone TypeScript runner shared by the web workflow and developer CLI. MCP is excluded.
- `gol-production` EC2 hosts the Next.js frontend/backend, persistent payment worker, and PostgreSQL. Administration uses AWS CLI; exact instance identity and readiness must be verified.
- Subgraph Studio/The Graph hosts indexing externally. PostgreSQL stores the private request journal; it is not the public activity evidence source.
- The Graph, Arc, and Privy are the partner targets. GOL is a Start Fresh submission built during the hackathon from original application code and attributed public libraries.
- No mainnet commitment or deployment is included. No implementation, successful integration, or prize eligibility is claimed as already achieved.

## Excluded scope

Trading, swaps, routing, perps, yield, launchpad, cross-chain/multi-chain support, mobile, Telegram, growth/quests, multi-agent delegation, account upgrades, recurring budgets, and arbitrary-contract execution are excluded.

The former P1/P2 extensions are also excluded from this build: second Graph product/composition, Circle Agent Stack, automatic human escalation, x402 paid queries, ENS identity, second venue/route comparison, and fulfillment/outcome verification. They are not a post-P0 task list. Alternative partner integrations are excluded.

## Execution and review

The plan starts with M0: prove Arc RPC/token access, real Studio indexing/query access, the Privy signer control, and model availability. M1 to M4 build the payment/refusal/query flow. M5 covers hosting, recovery, documentation, assets, and rehearsal.

The existing schedule targets 13 September 2026 at 18:00 Asia/Ho_Chi_Minh for submission, ahead of the deadline recorded in the submission checklist. Recheck official/dashboard requirements before submission. Record actual prompts, provenance, tests, and chronological commits; do not fabricate activity or evidence.

Review the product specification, architecture, implementation plan, and submission checklist together before application implementation. Account access, narration, final track/partner choices, and submission remain explicit human actions in that checklist.
