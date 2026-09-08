# GOL ETHOnline product specification

Status: proposed for review, 8 September 2026. Application implementation is not authorized until Anderson approves this specification. The accompanying execution plan is provided now as requested. No application code exists in this folder.

## 1. Scope and source precedence

Workspace: the `gol-network` repository root. The current checkout contains hackathon specifications and preparation records, with no application or package manifest. Start at the [hackathon build spec](../gol-ethonline-build-spec.md).

Precedence: current user instructions and corrections, the detailed hackathon specifications, then the root build-spec summary. Official event rules determine event eligibility independently of our product decisions. Historical prompts and evidence document how this scope was chosen; they do not add requirements. The broader product roadmap has been removed from the active document set at Anderson's request.

The submission is a business spend-management account on Arc testnet. A small business owner gives an operations agent a bounded USDC payment allowance for an approved contractor. The agent can submit payments, but only the account contract can release the deposited funds. The owner can revoke permission and withdraw funds using their wallet without the GOL backend.

Hosting decision: Anderson selected the AWS EC2 instance `gol-production` for frontend, backend, persistent payment worker and PostgreSQL, operated through AWS CLI. The subgraph is deployed through Subgraph Studio; Graph indexing and query infrastructure remain external. No Graph Node or IPFS service runs on the VM. The acceptance requirement is a working public HTTPS demo. The instance has not yet been verified or configured for GOL. Follow [Studio setup](studio-setup.md) for account and credential preparation.

A payment is an exact USDC transfer to an address. It does not verify an invoice, completed work, delivery, an API response, or the economic legitimacy of a recipient. Labels such as `Design contractor` are owner-entered conveniences, not verified identities. Public events expose addresses and amounts; do not include invoice text, personal data, or raw instructions on-chain.

## 2. Selected design and open decisions

### Account architecture

Use one immutable, USDC-only account per owner, created by a factory. This keeps the authority surface small and permits independent owner withdrawal. The owner funds a separate contract address.

The proposed account has one active mandate at a time. An owner can revoke and create a new numbered mandate; existing mandate terms and spending history never mutate. The owner can deliberately grant a fresh budget. Cumulative limits apply per mandate, not across every mandate the owner ever creates.

### Agent interface

Selected interface: a standalone TypeScript agent runner, callable by the web backend and by a developer CLI. The same payment and query functions serve both. This gives judges a complete browser demo without installing Codex.

Anderson explicitly excluded MCP from scope after reviewing the feature summary. Do not build a GOL MCP server, a Codex MCP integration, or a Graph MCP integration for this submission. The interface decision is resolved; approval of the complete specification before application implementation remains required.

### Start Fresh boundary

GOL is a new project for the ETHOnline Start Fresh track. Write all project-specific application code, contracts, designs, prompts, and assets during the hackathon. Public libraries and starter scaffolds are allowed with exact attribution. Do not copy code, designs, assets, configuration, addresses, secrets, or private implementation material from any earlier product.

## 3. Product journeys

### Owner setup

1. Open the one-page app and see an Arc testnet label, a read-only demonstration account, and a sign-in action.
2. Sign in with Privy and obtain an embedded owner wallet. Verify the selected address and chain before every owner transaction. An external wallet can be supported later; it is not required for the first flow.
3. Create a GOL account from the factory using an owner-signed transaction. Display both wallet address and account address with distinct labels.
4. Fund the account using the official USDC ERC-20 interface. Show account payment balance and owner/agent gas balances separately. Funding does not grant authority.
5. Provision a separate Privy agent wallet and grant the backend a policy-restricted signer on that wallet only. The owner wallet never receives this signer. Display the agent address and control status.
6. Enter per-payment cap, cumulative cap, one or more recipient addresses, and expiry. Show a review of exact values before requesting the owner's mandate signature. Creation becomes active only after its receipt confirms.

### Agent pays

1. Owner enters `Pay 40 USDC to Design contractor` and presses `Run agent`.
2. The agent parses one payment. Recipient labels resolve through the account's address book; unknown or ambiguous labels require clarification. No guessed address, exchange rate, split payment, or silently reduced amount.
3. The page shows the resolved recipient and amount as real tool activity. The runtime submits one `pay` call with its stable request ID. An explicit payment instruction is sufficient; no second owner signature is needed inside an existing mandate.
4. The UI shows signing, submitted transaction hash, then the actual receipt-derived result. Simulation can help estimate gas but is not an outcome. In particular, an expected policy refusal must still be submitted so it is recorded.
5. A confirmed payment or policy refusal initially appears as `On-chain; indexing pending`. The indexed timeline replaces that overlay when the matching event arrives. There is never a second row for the same event.

### Review and questions

The owner filters the timeline by outcome and mandate, opens an event's explorer link, or asks why the agent was refused. The question path queries actual Graph records and includes their transaction references. It cannot execute payments. It shows the indexed block and freshness status beside the answer.

### Revoke and withdraw

The owner can revoke the active mandate and withdraw any available account USDC to their own immutable owner address. Neither operation requires agent consent, Graph availability, or GOL backend permission. A documented explorer/CLI route provides these calls if the web app is unavailable. Owner wallet access, chain availability, and gas remain necessary. Privy key export/recovery must be tested; do not promise independence from every wallet provider merely because the contract is non-custodial.

Revocation takes effect in chain execution order. A payment finalized before revocation remains valid. A later request from the recorded agent is refused as `MANDATE_REVOKED`. Revocation does not refund completed payments.

## 4. Exact acceptance demonstration

Use a fresh mandate and an account funded with at least 100 USDC. Fund owner and agent gas separately. Set per-payment cap to **100 USDC**, cumulative cap to **100 USDC**, allowlist containing recipient R, and expiry seven days ahead. Using a cap below 70 would demonstrate the wrong rule.

| Step | Required evidence |
|---|---|
| Owner creates mandate for agent A | Owner-signed creation receipt, exact mandate values, mandate ID |
| Agent pays 40 USDC to R | Receipt status success, `Executed`, recipient increases by 40, spent becomes 40 |
| Agent requests 70 USDC to R | Receipt status success, `Refused` with `CUMULATIVE_CAP`, attempted 70, headroom 60 |
| Inspect refusal independently | Verified contract getter and explorer event show the same request ID, agent, reason, and amounts |
| Inspect balances | Second request transfers zero; spent remains 40; account payment balance remains 60 if initially funded with 100 |
| Wait for The Graph | Live provider returns the same refusal transaction hash, log index, request ID, and headroom |
| Ask why | Answer explains 70 exceeded the remaining 60 after spending 40 of 100, and links to the refusal transaction |

The sender of `pay` is the agent wallet, so gas is paid from the agent wallet. The account's 60 USDC payment balance is not reduced by the agent transaction's gas. A refusal costs gas even though no payment occurs.

## 5. User states

| Surface | States and required behavior |
|---|---|
| Authentication | Initializing, signed out, OTP in progress, authenticated, expired session, provider unavailable. Never show another user's account during refresh. |
| Account/funding | No account, awaiting owner signature, submitted, ready, insufficient owner gas, insufficient account balance, failed transfer. Wallet rejection leaves the previous state intact. |
| Mandate | Not created, creating, active, exhausted, expired, revoked. Balance and cap headroom are separate numbers. Expiry uses chain time for enforcement. |
| Payment instruction | Idle, parsing, needs clarification, queued, signing, submitted, pending, executed, policy refused, signer blocked, technical failure, unknown. A timeout is unknown, not failure. |
| Timeline | Loading, current, empty through block B, indexing pending, stale, unavailable, integrity mismatch. Cached data is visibly dated. |
| Questions | Asking, fetching records, explaining, answer with citations, no matches through block B, partial results, stale, unavailable, model failure. Never turn unavailable data into a zero count. |
| Withdrawal/revocation | Review, awaiting signature, submitted, confirmed, wallet rejected, transaction failed. Submission is never described as already effective. |

All states use text and accessible status announcements, not color alone. Disable duplicate submissions for a pending instruction while supporting refresh and recovery by request ID. Preserve the timeline if a question fails. Format USDC to at most six decimals without floating-point arithmetic.

## 6. Requirement traceability: all ten P0 items

| Source ID | Deliverable | Acceptance criterion | Milestone |
|---|---|---|---|
| P0-1 | Account/factory contracts, tests, verified Arc deployment | Four policy limits enforced; exact demo; getter-backed refusal; public address and reproducible build | M1, M2 |
| P0-2 | Agent runner and CLI | One natural-language payment becomes one scoped transaction; exact confirmed result; credentials separated | M3 |
| P0-3 | Live Studio subgraph and provider query | Real `Executed` and `Refused` indexed using `arc-testnet`; authenticated provider query demonstrated | M0, M2 |
| P0-4 | Read-only natural-language question path | Explains indexed records with valid transaction references; empty/stale/unavailable tests pass | M4 |
| P0-5 | One-page app, backend, Privy wallet and control | Owner setup, funding, mandate, run, timeline, ask, revoke, withdraw; real Privy signer-policy negative test | M0, M3, M4 |
| P0-6 | Public deployed web and backend | Clean browser can load live page and complete documented judge flow | M3, M5 |
| P0-7 | README, root ARCHITECTURE + diagram, SKILL, FEEDBACK, specs/prompts | Clean-checkout instructions work; attribution complete; feedback entries reflect actual observations only | Every milestone, M5 |
| P0-8 | Logo, cover, three screenshots | Logo 512x512, cover 640x360, three real app screenshots; exact dashboard constraints rechecked | M5 |
| P0-9 | Submission copy | Draft short description <=100 characters and two text fields >=280 characters; final claims match evidence | M5 |
| P0-10 | Human-narrated demo recording | Real 100/40/70 sequence, indexed explanation, architecture; upload-compliant recording | M5, human |

Completion requires all ten P0 items. Contract size estimates are not correctness or security limits.

## 7. Excluded scope

Only the P0 deliverables above belong to this build. The former P1/P2 items are excluded, not queued for implementation after P0:

- P1-1 to P1-4: second Graph product/composition, Circle Agent Stack, automatic human escalation, and x402 paid queries.
- P2-1 to P2-3: ENS identity, second venue/route comparison, and fulfillment/outcome verification.
- Broader roadmap: MCP, trading, swaps, perps, yield, launchpad, cross-chain/multi-chain support, mobile, Telegram, growth, multi-agent delegation, account upgrades, recurring budgets, and general arbitrary-contract execution.

Owner revoke/withdraw and the developer CLI remain P0. No alternative partner integration or mainnet commitment belongs to this plan.

## 8. Claim boundaries

| Topic | Hackathon boundary |
|---|---|
| Business workflow | Owner-operated small-business contractor spending; no organization RBAC or payroll system implied. |
| Source provenance | Original project-specific work plus exact attribution for public libraries and generated scaffolds. |
| Demo | Pay 40 then request 70 against a 100 cumulative cap; record the refusal with 60 remaining. |
| Refusal coverage | Only authenticated, well-formed policy requests whose transactions complete successfully persist a refusal. Invalid callers, failed signatures, out-of-gas and reverted transactions cannot promise a record. |
| Owner withdrawal | Owner bypasses mandate policy, never token restrictions, available balance, wallet access, or chain failures. |
| Agent authority | Agent holds a scoped transaction credential; the contract limits how it can move account funds. |
| Completion | All ten P0 items need evidence. A bare contract/video or local fixtures do not satisfy the planned product and partner checks. |
| Event claims | No prize, refund, personal registration status, or eligibility guarantee; use the dated evidence and dashboard gates in the submission checklist. |

## 9. Approval and completion boundary

Approve the four specification documents together. The initial interface is the standalone runner; MCP is excluded. The first implementation milestone is M0: establish live Arc connectivity, Studio access, and a real Privy control before building the main experience.

Account access, eligibility classification, ownership/publication rights, narration, and final submission are identified in [submission checklist](submission-checklist.md). Local implementation, tests, documentation, and review can proceed autonomously after specification approval. No prize, deployed state, or test result is represented as already achieved.
