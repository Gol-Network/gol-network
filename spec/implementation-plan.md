# GOL ETHOnline Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task after specification approval. Steps use checkboxes. Work inline unless Anderson explicitly requests delegation. This plan does not authorize application implementation yet.

**Goal:** Deliver a live Arc testnet account where an agent's 40 USDC payment succeeds, its subsequent 70 USDC request is refused against 60 remaining, and The Graph supports a cited natural-language explanation.

**Architecture:** Immutable USDC-only accounts, owner and agent wallets with separate credentials, a policy-restricted Privy agent signer, a durable payment runner, and an event-indexed question path. The AWS EC2 instance `gol-production` hosts Next.js frontend/backend, persistent payment worker and PostgreSQL, administered through AWS CLI. Subgraph Studio hosts the external subgraph environment; no Graph Node or IPFS service runs on EC2.

**Tech Stack:** Solidity/Foundry, OpenZeppelin Contracts, TypeScript, pnpm, viem, Next.js/React, Privy React and Node SDKs, OpenAI Responses, Graph CLI/AssemblyScript, Postgres, Vitest, Playwright. Pin compatible exact dependency versions in M0 and commit lockfiles.

**Spec:** [product](hackathon-product-spec.md), [architecture](architecture.md), [submission checklist](submission-checklist.md). Read all before executing.

## Global constraints

- No application implementation before Anderson's explicit specification approval.
- Standalone agent runner with web access and a developer CLI. MCP is out of scope, including GOL, Codex and Graph MCP integrations.
- Host frontend, backend, persistent payment worker and PostgreSQL on `gol-production` EC2. Use Subgraph Studio for external indexing. Verify exact AWS account/region/instance before deployment. No Vercel, self-hosted Graph Node or serverless scheduler dependency.
- Arc testnet only: chain ID `5042002`; USDC ERC-20 `0x3600000000000000000000000000000000000000`; six-decimal payment units.
- One active mandate per account; immutable owner; no arbitrary calls, approvals, upgrades, swaps, or routing.
- Acceptance mandate: per-payment cap 100 USDC; cumulative cap 100 USDC; pay 40, then request 70.
- Refusals persist by returning normally; technical reverts do not become policy records.
- No owner credentials in the backend/agent; no model-generated authority or transaction outcome.
- Real Graph records are the question/timeline source; fixtures are tests only.
- Start Fresh: write all project-specific code and assets during the hackathon. Use only attributed public libraries and starter scaffolds.
- Hyphen-only authored prose. Preserve captured prompts and dated evidence as historical records; they do not expand the active hackathon scope. Earlier document versions remain in Git history.
- Record real prompts, sources, meaningful human decisions, validation, and chronological commits. Never manufacture history or commit-frequency quotas.

## Milestones and schedule

The deadline is 13 September 2026 at 23:00 Asia/Ho_Chi_Minh. Internal freeze/submission target is 18:00 that day. These dates are targets, not permission to omit P0.

| Milestone | End-to-end result | Effort estimate | Target | Gate |
|---|---|---|---|---|
| M0 | Live service capabilities and credentials proven; provenance/track recorded | 3 to 5 hours plus access delays | 8 September | Approval and account access |
| M1 | Owner-funded account allows 40, refuses 70, permits withdrawal | 6 to 9 hours | 9 September | M0 Arc/token probe |
| M2 | That exact refusal queried from live The Graph endpoint | 4 to 7 hours | 10 September morning | M1 events, Studio access |
| M3 | Browser owner setup and natural-language agent payment work live | 8 to 12 hours | 10 to 11 September | M0 Privy control, M1 |
| M4 | One-page timeline and cited question answer complete full demo | 4 to 6 hours | 11 September | M2, M3 |
| M5 | Rehearsed public submission, documentation, assets, human video | 6 to 10 hours | 12 September | All prior P0 gates |
| Buffer | Defect fixes, final review, human submission | Remaining capacity | 13 September | No optional feature starts |

Total estimate is 31 to 49 engineering hours plus account onboarding, feedback, and narration. If access consumes the schedule, report the missed gate immediately. P1/P2 work is excluded. Preserve contract enforcement, indexing, Privy controls, and honest outcome reporting. If M2 fails, pause dependent query/UI work and resolve the provider problem.

## File map

```text
contracts/src/GolAccount.sol                 account policy, records, transfer, withdrawal
contracts/src/GolAccountFactory.sol          owner-to-account deployment registry
contracts/test/GolAccount.t.sol              unit and boundary cases
contracts/test/GolAccount.invariant.t.sol    stateful spending and bypass invariants
contracts/test/mocks/TestUSDC.sol            controlled token failures for local tests
contracts/script/Deploy.s.sol                testnet deployment and manifest
contracts/foundry.toml                       pinned compiler, optimizer, EVM target
deployments/arc-testnet.json                 public deployment evidence, no keys
packages/protocol/src/abi.ts                 generated contract ABI
packages/protocol/src/types.ts               transport interfaces and validation
packages/protocol/src/amount.ts              exact six-decimal parsing
subgraph/subgraph.yaml                      factory/template manifest
subgraph/schema.graphql                     indexed entities
subgraph/src/factory.ts                     AccountCreated mapping
subgraph/src/account.ts                     mandate/action/revocation mappings
subgraph/tests/account.test.ts              event-to-record mapping assertions
subgraph/queries/activity.graphql           persisted bounded queries
agent/src/payment/parse-instruction.ts      schema-limited natural-language parsing
agent/src/payment/submit-payment.ts         exact pay encoding and submission
agent/src/payment/reconcile-payment.ts      receipt/request/provider reconciliation
agent/src/payment/worker.ts                 durable job claim and per-agent lock
agent/src/privy/agent-wallet.ts              verified secondary-wallet provisioning
agent/src/privy/policy.ts                    chain/account/value signer restrictions
agent/src/privy/signer.ts                    only scoped server credential use
agent/src/query/activity.ts                 Graph queries, pagination, freshness
agent/src/query/answer.ts                   evidence-only explanation and validation
agent/src/model/openai.ts                   bounded Responses adapter
agent/src/db/schema.sql                     durable journal and account association
agent/src/db/journal.ts                     leases, unique requests, updates
agent/src/cli.ts                            developer runner: pay/status/ask
agent/test/payment.test.ts                  idempotency and real-result interpretation
agent/test/auth.test.ts                     user/account/wallet isolation
agent/test/query.test.ts                    stale/empty/error/citation behavior
agent/test/live-integrations.test.ts        explicitly gated real service checks
web/app/page.tsx                            one page composed from feature components
web/app/api/*/route.ts                      explicit server routes from architecture
web/src/components/OwnerSetup.tsx           sign-in, account, funding, mandate review
web/src/components/MandateStatus.tsx        chain-derived state and owner controls
web/src/components/AgentPayment.tsx         instructions and actual execution states
web/src/components/ActivityTimeline.tsx     indexed rows plus pending receipt overlay
web/src/components/Questions.tsx            read-only questions and evidence links
web/src/wallet/owner-actions.ts             direct owner signatures and receipt checks
web/tests/gol.spec.ts                       browser workflow and failure states
scripts/check-deployment.ts                 chain/token/code/subgraph configuration check
scripts/demo.ts                            repeatable live acceptance run, evidence output
spec/prompts/                              exact human/runtime prompts and dated changes
spec/evidence/                             real capability/test/feedback observations
README.md, ARCHITECTURE.md, SKILL.md         user/judge/operator documentation
FEEDBACK.md, THIRD_PARTY_NOTICES.md          actual feedback and exact provenance
assets/                                    logo, cover, real screenshots, diagram
.github/workflows/ci.yml                    required PR and main-branch validation
deploy/docker-compose.yml                  proxy, web, worker and persistent PostgreSQL
deploy/Caddyfile                            HTTPS and internal web upstream
deploy/deploy.sh                            pinned release activation and health checks
deploy/README.md                            AWS CLI discovery, access, deploy and recovery
deploy/backup-db.sh                         private off-VM PostgreSQL backups
```

Keep every change inside this repository. Do not read from or modify sibling product repositories as implementation sources. The retained specifications are documentation, not an application starter.

## M0. Remove live integration uncertainty

**Files:** `spec/evidence/integration-preflight.md`, `THIRD_PARTY_NOTICES.md`, root workspace/toolchain configuration, `scripts/check-deployment.ts`, disposable `spec/evidence/probe-results.json` containing public results only. After approval, a tiny event probe may live under `contracts/test/integration/` and remain explicitly a probe.

**Consumes:** approved product/architecture; submitter's account access and track direction.

**Produces:** exact working RPC, token decimals, Studio network acceptance, Privy allowed/denied signing evidence, model availability, pinned versions and license inventory. A failed capability is a blocked gate, not a mocked success.

- [ ] Record specification approval and the Start Fresh boundary in a dated decision entry. The standalone interface and MCP exclusion are already decided. Use the existing GOL Git repository. Commit reviewed specifications and input attribution before application commits. Do not publish private documents without the public-content review.
- [ ] Inspect available account configuration using secret names/presence only. Use fresh GOL applications and wallets. Owner interactive login is handled by the owner; never request pasted keys. Record which access is available and which must be provisioned.
- [ ] Refresh AWS browser authentication with `aws login`; verify caller identity and locate `gol-production` by Name tag, searching enabled regions if needed. Record actual account, region, instance ID, architecture, CPU/RAM/disk headroom, security groups and SSM/SSH access in private deployment configuration. Current CLI session is expired; no instance properties have been verified. This check does not authorize starting a deployment before specification approval.
- [ ] Pin Node 22, pnpm, Solidity 0.8.26 with optimizer enabled and EVM `paris` initially, plus compatible package releases. `paris` deliberately avoids reliance on newer opcodes; validate bytecode on Arc. Record actual tool versions and package licenses, not just this suggested baseline.
- [ ] Resolve the RPC 403 with a documented Arc provider or accessible network route. Execute the exact checks below and save returned public values. Repeat against a second official-listed provider if the primary is inconsistent.

```text
eth_chainId -> 0x4cef52 (5042002)
eth_call({to: USDC, data: 0x313ce567}, latest) -> 6
eth_getBlockByNumber(latest, false) -> number/hash/timestamp
eth_getTransactionReceipt(known_probe_hash) -> expected sender/to/status/logs
```

- [ ] Create/connect a GOL Studio subgraph using `arc-testnet`. After approval only, deploy a minimal event probe if needed and index a real emitted event through the intended provider. Record deployment ID, query URL kind, authenticated query response, and measured delay. Account/UI dropdown availability alone does not pass this gate.
- [ ] Provision owner W and separate agent A in a GOL Privy app. Configure only A with the additional signer and chain/account/value policy. Send one allowed probe call and attempt one wrong-destination signing call. Save request IDs and sanitized denial, never tokens. Confirm A cannot edit policies or export keys; verify W can export/recover its wallet through supported owner controls.
- [ ] Test Responses with the selected snapshot and strict schema. Pass an ambiguous recipient and verify clarification, not an invented address. Test model refusal and unavailable credentials. Store the actual prompt and sanitized response.
- [ ] Inspect the chosen public dependency versions' LICENSE/NOTICE files. Record each dependency or scaffold source, version, license, and generated files. Do not copy private or project-specific code from an earlier product.
- [ ] Commit actual M0 work and observations. If any required live gate fails, stop its dependent task and present evidence-backed alternatives from architecture section 2. No chain/provider switch is authorized by a failed probe.

## M1. Owner funds; agent succeeds and is refused

**Files:** contract sources/tests/script/config, generated ABI, protocol amount parser, `deployments/arc-testnet.json`.

**Consumes:** M0 verified token/RPC; exact Solidity interfaces and enums in architecture section 3.

**Produces:** verified factory/account with complete contract semantics and an independent 100/40/70 live receipt set.

- [ ] Write the primary behavior test before contract logic. The fixture deploys TestUSDC, a factory/account with owner O and agent A, mints/transfers 100e6 to the account, and creates the mandate from O. Test uses the architecture's method names and return enum.

```solidity
function test_40Then70PersistsRefusal() public {
    vm.prank(agent);
    assertEq(uint8(account.pay(id, bytes32(uint256(1)), recipient, 40e6)), 1);
    vm.prank(agent);
    assertEq(uint8(account.pay(id, bytes32(uint256(2)), recipient, 70e6)), 2);
    GolAccount.RequestRecord memory r = account.getRequest(id, bytes32(uint256(2)));
    assertEq(uint8(r.rule), 5);
    assertEq(r.attempted, 70e6);
    assertEq(r.headroom, 60e6);
    assertEq(r.spentAfter, 40e6);
    assertEq(token.balanceOf(recipient), 40e6);
    assertEq(token.balanceOf(address(account)), 60e6);
}
```

- [ ] Run `forge test --match-test test_40Then70PersistsRefusal -vvv` from `contracts/`; confirm failure for missing behavior, then implement account/factory according to the defined evaluation order. A policy refusal must return normally so its record persists.
- [ ] Implement the meaningful cases in the matrix below. Each case asserts balances, spent, request state, and emitted outcome count, not only a returned boolean.

| Test case | Expected |
|---|---|
| Exactly per-payment and cumulative cap | Execution permitted; remaining zero |
| One micro-USDC over per-payment cap | Refused PER_PAYMENT_CAP, no transfer |
| Remaining cap plus one micro-USDC | Refused CUMULATIVE_CAP with exact headroom |
| At expiry second / one second before | Refused / otherwise permitted |
| Unlisted recipient and over-cap amount | Recipient rule wins by documented order |
| Unauthorized owner-as-agent, third party, unknown mandate | Custom error; no persisted outcome |
| Zero amount/address/request ID | Custom error; no persisted outcome |
| Same request/payload twice | One transfer, one outcome event, same stored result |
| Same ID with altered amount/recipient | RequestConflict; original unchanged |
| Replay after expiry/revoke | Same original outcome, no second execution |
| Two different IDs competing for 60 remaining | Total transferred <=60 regardless of ordering |
| Insufficient funds after policy passes | Technical revert; request unseen; spent unchanged |
| Token false return/revert/read error | Complete rollback; no Executed/Refused |
| Token attempts callback into pay/withdraw | Reentrancy blocked; no duplicate transfer |
| Replace mandate | Old one revoked; new budget explicit; old requests retained |
| Owner withdrawal after revoke/expiry | Available balance goes only to owner |
| Agent tries withdrawal/create/revoke/arbitrary selector | No authority; account balance unchanged |
| Gas exhaustion/outer-call revert | No false claim of persisted refusal |
| Invalid/duplicate recipient configuration | Atomic creation failure |

- [ ] Add stateful invariant fuzzing: `spent <= cumulativeCap`, every executed request was authenticated/allowed/unexpired at execution, no request transfers twice, refusals never increase spent or transfer, and owner identity never changes. Model lifetime spend per mandate separately from owner withdrawals/funding.
- [ ] Run `forge test`, `forge test --match-contract GolAccountInvariantTest`, `forge fmt --check`; record executed counts and failures. Run amount-parser tests for one micro-USDC, uint256 bound, exponents, floating-point-like input, and decimal overflow.
- [ ] Deploy from the GOL deployer, verify factory and created account with the explorer's supported verification API/Foundry integration, and publish reproducible compiler/optimizer/constructor settings. Record chain, token, block, transaction hashes, bytecode hash, ABI hash, source commit, and verification URL in the public manifest. Never invent a verified link from an unverified address.
- [ ] Execute the acceptance case through a dedicated test agent, then owner withdrawal. Compare token deltas, events, and `getRequest` directly over RPC. Commit contract and test work in meaningful increments, preserving actual chronological history.

## M2. Real refusal to live Graph query

**Files:** `subgraph/` manifest/schema/mappings/tests/queries, `spec/evidence/graph-live.md`.

**Consumes:** M1 ABI and factory deployment; M0 Studio account/provider endpoint.

**Produces:** `ActivityPage` backed by real indexed `Action` entities, including exact refusal evidence.

- [ ] Define the Graph schema exactly as architecture section 6 and write mapping tests with a real-shaped MandateCreated, Executed, Refused, and MandateRevoked sequence. Assert refusal amount 70000000, headroom 60000000, transferred zero, spentAfter 40000000, and agent/request/transaction references.
- [ ] Run mapping tests and observe missing-handler failures. Implement factory templates and deterministic action IDs. Duplicate ingestion must not create duplicate action rows. Store event fields directly; do not call `remaining` at the latest block while mapping history.
- [ ] Generate ABI/types and run `pnpm --filter @gol/subgraph codegen`, `build`, and `test`. Check mapping schema against exported ABI. If the local mapping-test tool does not support this Mac, run the documented Linux CI/container command; report which tests actually executed.
- [ ] Deploy with the correct start block and network, run the actual 40/70 pair after deployment, and query the configured live endpoint using its intended API-key flow. Verify `_meta.hasIndexingErrors=false`, matching event hashes/log indexes and mandate values, and indexed block >= refusal block.

```typescript
expect(action.outcome).toBe('REFUSED');
expect(action.rule).toBe('CUMULATIVE_CAP');
expect(action.attempted).toBe('70000000');
expect(action.headroom).toBe('60000000');
expect(action.transactionHash).toBe(refusalReceipt.transactionHash.toLowerCase());
expect(BigInt(page.indexedBlock)).toBeGreaterThanOrEqual(refusalReceipt.blockNumber);
```

- [ ] Measure ten event-to-query delays and record min/median/max plus provider status. A slow index is allowed only with honest catching-up UX; the acceptance demonstration must eventually query the real record.
- [ ] Exercise redeploy/reindex and cursor reset; simulate changed block hash, duplicate receipt overlay, Graph errors and missing metadata. Verify no double count and no stale answer labeled current. Commit mappings and real evidence separately as they occur.

## M3. Browser setup and agent instruction to confirmed result

**Files:** `agent/src/payment/*`, `agent/src/privy/*`, model adapter, DB/journal/worker, CLI, protocol schemas, web owner/payment components and API routes.

**Consumes:** M1 contract, M0 signer policy/model access, architecture HTTP and transport interfaces.

**Produces:** Privy owner setup plus a durable natural-language payment workflow with real on-chain results.

- [ ] Write runner tests: a parsed payment encodes only `pay(id,requestId,recipient,amount)`, never raw transfer or owner calls. Expected policy refusal still submits. Ambiguous instruction does not submit. Owner key material is not accepted in configuration.
- [ ] Write authorization tests: another user cannot select an account, agent wallet ID, or request; altered client account/chain is rejected; revoked session cannot submit; public demo endpoints cannot sign. Confirm route body/Origin/rate constraints.
- [ ] Implement the exact parsing schema and decimal/address validator. Save the actual system prompt before the model-backed implementation. It must say that payment is USDC-only, one instruction means one attempt, unknown labels need clarification, and contract decisions must never be fabricated.
- [ ] Implement server-only Privy provisioning and scoped signer adapter proven in M0. No signer is added to W. Show a user consent step and the effective agent policy. Retain a small agent gas budget; prompt owner explicitly before gas top-up.
- [ ] Create the journal with unique `(account,mandate,requestId)`, atomic row claims, per-agent lock, and recoverable states. Test browser refresh, duplicate POST, changed input, timeout after signing, process death after provider acceptance, and replacement transactions. No case may automatically create a second business attempt.

```typescript
const first = await submitPayment(ctx, requestId, mandateId, intent);
const retry = await submitPayment(ctx, requestId, mandateId, intent);
expect(retry.requestId).toBe(first.requestId);
expect(chain.executedTransfersFor(requestId)).toBe(1);
await expect(submitPayment(ctx, requestId, mandateId, changedIntent))
  .rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
```

- [ ] Implement the persistent worker process for EC2: poll idle queues every two seconds, claim with durable leases, bound job execution, stop new claims on SIGTERM, and reconcile before signing after restart/lease expiry. Test two workers claiming the same request and a worker killed after provider acceptance. Run it as the separate Compose worker service without a public listener; no fire-and-forget HTTP tasks or external cron required.
- [ ] Build owner page actions as direct wallet calls: create account, fund, create/revoke mandate, withdraw to immutable owner. Test rejected signatures, wrong chain, insufficient gas, and owner action receipt failure. Owner confirmation previews must include exact account, agent, amount/caps, expiry and recipients.
- [ ] Build payment states and polling. Confirm outcome from receipt plus matching events/getter, not model prose or HTTP 200. `Refused` gets an amber/text label and explorer receipt even though transaction status is success. Signer denial and token failure have separate labels.
- [ ] Provide developer CLI `pay/status/ask` invoking the same server-side runner under explicit local GOL agent configuration; mark it developer-only. It accepts no owner private key. Public browser workflow satisfies normal access. A general public CLI login/token service is excluded baseline.
- [ ] Run Vitest auth/payment tests, TypeScript typecheck, lint, and Playwright owner/payment flows. Then exercise the real Privy control and the actual owner/browser-to-agent 40/70 flow on Arc. Capture current test counts and real hashes. Commit each independently reviewable working slice.

## M4. Indexed timeline and natural-language explanation

**Files:** `agent/src/query/*`, persisted queries, timeline/questions components, query tests, `spec/prompts/query-system.md`.

**Consumes:** M2 live indexed schema, M3 identity and request results.

**Produces:** coherent one-page acceptance demo with Graph-grounded answers.

- [ ] Write tests for fresh/empty/stale/unavailable data, missing metadata, page truncation, wrong-scope query, hallucinated citation, altered numeric answer, provider error, and model timeout. Inject a hostile recipient label and a question asking to send money; question service must have no signer calls.

```typescript
expect((await answerQuestion(scope, 'Why was 70 refused?')).citations[0].txHash)
  .toBe(indexedRefusal.transactionHash);
graph.failNext(new Error('unavailable'));
expect((await answerQuestion(scope, 'Any refusals?')).status).toBe('unavailable');
expect(signer.calls).toHaveLength(0);
```

- [ ] Implement bounded query-intent selection, persisted GraphQL templates, sequence pagination, `_meta` freshness, and deterministic citation URLs. Ensure account filter is supplied by code. Avoid an arbitrary query proxy or autonomous research tools.
- [ ] Save actual explanation prompt, implement evidence selection and numerical/citation validation. Verify 70/60/40/100 are evidence-derived. Fall back to the fact table only with a visible explanation error, not a pretend successful AI response.
- [ ] Merge receipt overlays with Graph action IDs/request IDs. Match duplicates to original events and link the original transaction rather than a duplicate receipt without logs. Show current block/freshness, outcome filters, and accessible state updates.
- [ ] Run query and browser tests plus a live question using the recorded Graph refusal. Refresh the page and run the same question with Graph temporarily unavailable; the page must retain dated records and report the outage. Record proof in `spec/evidence/end-to-end.md`.

## M5. Public deployment, documentation, and submission

**Files:** root docs, `assets/`, `spec/evidence/release.md`, `spec/submission-copy.md`, CI, deployment configuration, `scripts/demo.ts`.

**Consumes:** all previous P0 evidence; confirmed public source rights and track.

**Produces:** all ten P0 deliverables plus an explicit human handoff.

- [ ] Configure `gol-production` after exact AWS identity/instance verification: Caddy proxy, Next.js web/backend, persistent worker and PostgreSQL through Docker Compose under `/opt/gol`. Use persistent encrypted EBS-backed database storage and private container networking with no public database port. Verify host architecture/capacity and management access; expose only HTTPS/HTTP for the app. Use AWS CLI for infrastructure discovery and administration, with SSM where enrolled. Do not create or replace the instance merely because discovery failed.
- [ ] Configure separate database migration/runtime roles, daily and pre-migration backups to private encrypted S3, and retention of at least seven daily copies. Test restore into a separate database. Container redeployment and application rollback must preserve PostgreSQL data. Monitor disk capacity and memory before admitting the release load.
- [ ] Configure DNS/TLS, allowed Privy origins, chain RPC, Graph endpoint/key, model and scoped signing secrets. Use GOL-only secret entries and least-required instance-role access; inject worker signing credentials only into the worker. Build immutable source-commit-tagged images off-host and retain prior release tags. Run readiness checks before announcing the public demo URL.
- [ ] Rehearse release activation and recovery: backup database, drain worker claims, run compatible migrations, activate web/worker, test real payment/refusal/query, and verify rollback without deleting the journal. Test worker restart after submission, VM reboot recovery, log rotation and database restore. Record the successful target/deployment evidence without secrets.
- [ ] Implement CI on PRs and main: lockfile install, typecheck, lint, Foundry tests, mapping tests/build, agent tests, frontend build and critical browser flow. Live tests require explicit credentials and record skipped status honestly; they are not silently counted as passed.
- [ ] Build `scripts/demo.ts` to generate fresh request IDs, check mandate/balance, pay 40, request 70, verify refusal getter/event, await Graph with timeout, and request cited explanation. Output hashes and elapsed times as JSON. It never funds from unrelated accounts or creates new authorizations without owner input.
- [ ] Write README with prerequisites, setup, commands, testnet funding/gas, authority model, exact demo, explorer and query links, public dependency attribution, AI role, and limitations. Write root ARCHITECTURE.md as the deployed counterpart of this design, with Mermaid plus exported SVG/PNG. Keep spec and deployed status distinct.
- [ ] Write SKILL.md for developer agent and read-only query use: environment, installation, pay/status/ask examples, outcomes, credential boundaries, idempotency, citation behavior, and no arbitrary-contract tools. Document the standalone runner and GraphQL-backed query path. MCP installation, servers and integrations are excluded.
- [ ] Write FEEDBACK.md only from actual integration observations or received feedback, each dated with source, reproduction, impact, and resolution. An honest `No external feedback received yet` is acceptable. Do not fabricate partner endorsements.
- [ ] Review the retained hackathon specs, prompts, evidence and Git history for publication-sensitive material. Earlier source versions remain in local history; do not restore the removed broad roadmap into the active specs. Commit third-party licenses and generated-scaffold attribution.
- [ ] Produce logo and cover with the imagegen skill if AI generation is used; retain actual prompts/model attribution. Capture three screenshots of the working app: active mandate, refusal event/timeline, cited answer. Export the architecture image. Validate dimensions against dashboard before uploading.
- [ ] Finalize submission copy from the checklist draft using actual deployment evidence. Do not imply invoice verification, mainnet readiness, independent audit, or guaranteed partner eligibility.
- [ ] Perform one full clean-checkout reproduction and one signed-out judge-browser rehearsal. Run the full relevant suite once for the release candidate; record exact commands, counts, commit, environment and live evidence. Rerun only affected checks after any fix.
- [ ] Human records the compliant 2 to 4 minute narrated demo, verifies playback and uploads it. Human confirms participant/track/partner selections and submits the project. Record the final submission acknowledgement only after it actually appears.

## Release acceptance and handoff

P0 is complete only when all ten product traceability rows pass. A working local test is not a deployed integration, a submitted hash is not a payment result, and a recording is not a submitted entry. Save a compact release evidence table with contract addresses, source commit, verification links, refusal/execution hashes, Graph deployment/query proof, demo URL, final checks, asset paths and remaining human actions.

First action after approval: execute M0 under the Start Fresh boundary. The standalone runner is selected; no MCP work is part of this plan.
