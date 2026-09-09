# GOL pre-integration demo completion specification

Status: implementation-ready, 8 September 2026.

## 1. Objective

Complete every repository change that can be finished before external provider accounts, credentials,
testnet funds, deployed addresses, DNS, or a production host are available. The result must be one
integration-ready build that can run the complete GOL demo after real configuration is supplied:

1. The owner signs in with Privy.
2. GOL creates the owner's account and a separate restricted agent wallet.
3. The owner funds the account and agent gas reserve, reviews the mandate, and signs it.
4. The agent executes a 40 USDC payment.
5. The agent submits a 70 USDC request, which the contract records as refused because only 60 USDC
   remains.
6. The interface follows both transactions from submission through indexing.
7. The Graph timeline shows both outcomes.
8. Ask the Record explains the refusal and exposes its indexed and explorer citations.

This is a focused completion pass, not a product expansion. Prefer a reliable, legible demo path over
general-purpose abstractions.

## 2. Authority and scope

This specification is the implementation delta between the current local build and external
integration. It supplements [hackathon-product-spec.md](hackathon-product-spec.md); that document
remains authoritative for the product, trust boundaries, exact 100/40/70 demonstration, and excluded
scope.

In scope:

- production-safe runtime configuration and Docker networking
- resumable owner and agent setup
- explicit owner and agent gas readiness
- complete payment progress and indexing-pending behavior
- correct Graph filtering and bounded pagination
- visible grounded-answer citations and freshness
- idempotent worker recovery
- redacted provider preflight and live acceptance tooling
- the minimum UI refinement needed to record the intended flow clearly

Not in scope during this phase:

- creating Privy, OpenAI, The Graph, AWS, DNS, or explorer accounts
- generating or storing real credentials
- deploying the contracts, subgraph, database, or application
- funding real wallets or submitting real transactions
- changing Arc testnet, USDC, the account architecture, or the 100/40/70 story
- additional recipients workflows, organizations, RBAC, invoices, recurring payments, swaps, routing,
  MCP, mobile applications, or new partner integrations
- recording the final video or claiming live-provider acceptance

## 3. Non-negotiable product boundaries

- The owner wallet and agent wallet remain distinct.
- The backend never receives the owner wallet's signing key.
- The backend signer may submit only `eth_sendTransaction` on Arc chain `5042002`, to the linked
  `GolAccount`, with zero native value. Other signer methods default to deny.
- `GolAccount` remains the final authority for agent identity, recipient, per-payment cap, cumulative
  cap, expiry, revocation, and request replay.
- An expected contract refusal must be broadcast and confirmed. It is not replaced by frontend,
  model, or Privy simulation.
- Account USDC and gas readiness are displayed separately even though Arc's native and ERC-20 views
  represent the same underlying USDC balance.
- The question path has no signer or payment dependency.
- Fixtures are always labeled as fixtures and can never be presented as live provider evidence.

## 4. Required implementation

### 4.1 Runtime configuration and container connectivity

The same production image must be configurable after it is built.

- Remove browser dependence on build-time `NEXT_PUBLIC_*` environment replacement. Read public
  configuration on the server at runtime and pass only the non-secret Privy app ID, factory address,
  chain ID, RPC URL, and explorer URL into client components as typed props.
- Use one canonical `PRIVY_APP_ID` for authentication, server provisioning, the worker, and the
  client-provided public app ID. Do not maintain separate values that can silently point to different
  Privy applications.
- Add centralized environment parsing that validates addresses, HTTPS production URLs, chain ID,
  paired Privy signer ID/private key configuration, and required production fields. Fail with field
  names but never values.
- Give the worker outbound network access in addition to private PostgreSQL access. PostgreSQL stays
  only on the internal network and exposes no host port. The worker exposes no inbound port.
- Keep web-to-PostgreSQL traffic private and Caddy as the only public ingress.
- Add the developer-token variables required by the CLI and acceptance runner to
  `deploy/.env.example`, clearly labeled as operator-only secrets.
- Make `/api/health` actively verify the database and Arc chain ID. It may report provider
  configuration presence for Privy/OpenAI and perform a small bounded Graph metadata query, but it
  must not make a paid model call. Responses expose no secret, wallet ID, or internal error body.

### 4.2 Canonical Privy signer policy

- Implement one canonical policy builder used by provisioning code, the local policy assertion, and
  tests. Remove parallel policy descriptions that can drift.
- The policy must allow only `eth_sendTransaction` when the transaction chain is `5042002`, `to` is
  the linked GOL account, and native `value` is zero. All unmatched methods and transactions are
  denied by Privy's default-deny behavior.
- Name and display the policy accurately. Do not call it ABI-level `pay`-only unless an
  `ethereum_calldata` condition is actually enabled and proven during live integration.
- Present an explicit consent/review step before provisioning. Show the agent wallet purpose, chain,
  destination account, zero-native-value constraint, default-deny behavior, and revocation path.
- Store only Privy resource IDs and public wallet addresses in PostgreSQL. Authorization private keys
  remain environment secrets.
- Ensure `PRIVY_AUTHORIZATION_KEY_ID` is treated as the key-quorum/signer ID corresponding to
  `PRIVY_AUTHORIZATION_PRIVATE_KEY`. Startup validation checks presence as a pair; the live preflight
  will prove the match.

### 4.3 Resumable owner setup and funding

Replace the current all-at-once setup action with a visible, resumable checklist:

1. Owner authenticated and on Arc testnet.
2. Owner gas balance available.
3. GOL account created and confirmed.
4. Restricted agent wallet provisioned.
5. Agent gas reserve funded and confirmed.
6. GOL account funded with 100 USDC and confirmed.
7. Mandate reviewed, signed, and confirmed.

Requirements:

- Display the owner wallet, GOL account, agent wallet, and approved recipient as separately labeled
  addresses with explorer links.
- Display owner gas, agent gas, and GOL payment balance as separate rows. Never add the native and
  ERC-20 views together.
- If owner gas is insufficient, stop before requesting a transaction and show a configured Arc faucet
  or funding instruction. The application cannot claim to fund an empty owner wallet itself.
- Add an explicit owner-to-agent gas top-up action. Use the Arc USDC interface and an
  operator-configurable small demo amount, defaulting to 1 USDC. Show the exact destination and
  amount before signature. This transfer is outside the mandate's 100 USDC account budget.
- Fund the GOL account to exactly the required demo balance rather than blindly transferring another
  100 USDC when a balance already exists.
- Show the complete mandate review before signature: agent address, 100 USDC per-payment cap,
  100 USDC cumulative cap, approved recipient, and seven-day expiry.
- Every owner transaction must distinguish awaiting signature, submitted with hash, confirmed,
  rejected, reverted, and insufficient-gas states.
- Persist no false completion locally. On reload, derive completed owner steps from the chain and the
  authenticated account link, then resume at the first incomplete step.
- Disable each action while its transaction is pending. Repeated clicks must not create duplicate
  account, funding, provisioning, or mandate requests.

### 4.4 Agent instruction and durable execution

- Keep the narrow instruction contract: one exact USDC amount and one known recipient label or
  address. Unknown, conflicting, multiple, or malformed payment instructions require clarification.
- Before submission, show the resolved amount, recipient label, recipient address, mandate ID, and
  generated request ID.
- Render the durable stages distinctly: queued, parsing, needs clarification, signing, submitted,
  confirming, executed, refused, signer blocked, technical failure, and unknown.
- Display the Arc transaction link as soon as a hash exists. A successful transaction receipt and a
  successful payment are different states.
- Disable a second Run Agent submission while the current request is non-terminal. Preserve the
  request ID in browser storage and recover its state after refresh.
- Do not erase the last confirmed result when a later poll or provider request fails.

### 4.5 Idempotency and worker recovery

- Keep one stable request ID as the journal key, contract replay key, and Privy idempotency/reference
  key.
- If the worker stops after marking a request as signing but before persisting Privy's response, it
  must reconstruct the exact stored intent and resubmit with the same Privy idempotency key. It must
  not create a new business request or immediately abandon the request as ambiguous.
- If a Privy operation ID or transaction hash exists, reconcile it before any submission attempt.
- Persist the parsed recipient and amount before the first external signing request.
- A changed payload under an existing request ID remains a conflict. Same-ID/same-payload retries
  converge on one transaction and one terminal journal result.
- Preserve honest terminal distinctions: Privy policy denial is `signer_blocked`; a confirmed
  contract outcome is `executed` or `refused`; unresolved provider or receipt state is `unknown`, not
  `failed`.

### 4.6 On-chain-to-indexed activity transition

- When a receipt-derived `Executed` or `Refused` result is confirmed, immediately create an
  `On-chain; indexing pending` overlay containing its request ID, transaction hash, outcome, amounts,
  and rule.
- Poll the scoped Graph query with bounded backoff until the matching request ID and transaction hash
  arrive, then replace the overlay with the indexed record.
- Dedupe by the indexed action identity and request/transaction relationship. Never display the
  overlay and indexed form as two business events.
- After the automatic polling window, retain the confirmed overlay and offer `Check indexing again`.
  Do not remove an on-chain result merely because Graph is delayed or unavailable.
- Preserve the last successful indexed timeline during temporary Graph failures and mark it with its
  last indexed block/time and a stale or unavailable badge.
- Keep filters for All, Executed, and Refused. Add mandate filtering only if it fits the one-page layout
  without distracting from the exact demo.

### 4.7 Graph query correctness

- Apply outcome, rule, mandate, and timestamp filters in GraphQL variables/`where` clauses before
  pagination. Do not fetch the first unfiltered page and discard non-matching rows afterward.
- Retain deterministic sequence pagination with a strict maximum page size of 50 for the visible
  timeline.
- The question evidence loader may fetch multiple pages but must stop at 100 scoped records. It must
  expose truncation as `partial`.
- Always inject the authenticated linked account from server code. Clients cannot replace the account
  scope or submit arbitrary GraphQL.
- Validate response shape, hashes, amounts, account, deployment metadata, and indexing-error state.
  An invalid response becomes unavailable or integrity mismatch; it never becomes an empty result.
- Generate the deployable manifest from the verified deployment manifest or an explicit command
  argument. The preparation command must refuse `status: not_deployed`, null factory, or null start
  block rather than deploying the placeholder address.

### 4.8 Ask the Record

- Store and render the complete `GroundedAnswer`, not only its text.
- Show status, answer text, record count, indexed block, source deployment, freshness/partial state,
  and one or more clickable citations containing transaction hash and log index.
- Build explorer URLs in trusted server code from validated hashes. Never display a model-generated
  URL.
- The model receives at most the selected 100 indexed records and cannot call tools. Its output may
  cite only supplied action IDs and may not introduce unsupported numbers.
- On invalid model output, timeout, or model unavailability, show `Explanation unavailable` and the
  deterministic evidence explanation with citations. Do not label the fallback as a successful AI
  response.
- Asking a question must not clear or refresh away the timeline, enqueue work, or access signer
  configuration.

### 4.9 One-page demo presentation

Keep the existing visual direction and one-page structure. Complete the experience rather than adding
new pages.

- Add a compact setup-progress treatment and make the next required action obvious.
- Show live versus fixture mode in a persistent, unambiguous banner.
- Show short addresses by default with copy and explorer actions available.
- Use visible transaction links for owner setup, execution, refusal, and answer citations.
- Make `EXECUTED`, `REFUSED`, `SIGNER BLOCKED`, `INDEXING`, and `UNKNOWN` understandable through text,
  not color alone.
- Keep the 40 USDC and 70 USDC instruction shortcuts.
- Ensure the 70 USDC transaction is described as a successful on-chain refusal, never a failed
  payment transaction.
- Preserve a usable recording layout at a 1440-by-900 browser viewport and a usable narrow layout.
- Do not add charts, navigation, settings, onboarding tours, or decorative motion that compete with
  the four proof surfaces: authority, payment, indexed evidence, and grounded explanation.

### 4.10 Integration and acceptance tooling

Prepare commands that can be executed later without changing application code:

- A redacted provider preflight validates configuration presence, Arc chain ID, Privy application
  access, signer/quorum match, OpenAI model access, Graph `_meta`, deployed bytecode, and account
  ownership. It prints booleans, public IDs/addresses, and error codes only.
- A Privy policy probe sends one allowed GOL call and one harmless wrong-destination request. The
  latter must be denied before broadcast. The probe requires an explicit environment opt-in because
  the allowed call can consume gas.
- Subgraph preparation updates factory and start block from deployment metadata and produces a clean
  build without embedding a deploy or query key.
- The existing live acceptance runner remains the final 40/70 gate. Extend its output to include the
  deployed source commit, policy ID, indexed action IDs, answer citations, and public application URL,
  without printing tokens or private keys.
- Deployment scripts validate that the source tree is clean or record the intentional source commit,
  build with Node 22, migrate before traffic, give the worker egress, and fail if required runtime
  configuration is absent.

## 5. Minimal verification required in this phase

Do not build a large new test matrix. Add only focused regression coverage for behavior that would
otherwise be easy to break:

1. canonical Privy policy permits the exact envelope and denies wrong chain, destination, value, and
   method;
2. signing-state recovery reuses the same Privy idempotency key;
3. Graph filters are server-side and question pagination stops at 100 with `partial` set correctly;
4. indexed records replace pending overlays without duplication;
5. Ask the Record renders a trusted citation and preserves deterministic fallback behavior;
6. production configuration rejects missing/invalid public addresses and mismatched signer fields;
7. one mocked browser test completes setup states, 40 execution, 70 refusal, indexing transition, and
   citation opening.

Completion checks:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
forge test --root contracts
pnpm --filter @gol/subgraph codegen
pnpm --filter @gol/subgraph build
pnpm --filter @gol/web test:e2e
docker compose -f deploy/docker-compose.yml config -q
```

Run these with Node 22 and pnpm 11.17.0. Existing contract and mapping tests are sufficient unless an
implementation change touches those components.

## 6. Pre-integration definition of done

This phase is complete when:

- the production image receives public client configuration safely at runtime;
- the worker has outbound provider access while PostgreSQL remains private;
- the owner can see and resume every setup step, including separate agent gas funding;
- a mocked provider flow exercises the same UI states as a live payment;
- a confirmed result survives Graph delay and becomes one indexed record;
- the timeline filters correctly beyond the first raw page;
- Ask the Record visibly exposes its citation and indexing metadata;
- a lost Privy response cannot cause a new transaction or an unrecoverable signing state;
- deployment/subgraph/preflight commands are ready to accept real values without source edits;
- all focused checks above pass on the pinned toolchain;
- the repository still truthfully reports contracts, subgraph, and production as not deployed.

Passing this definition does **not** mean the demo is live or recordable. It means no known local
implementation work remains before the external integration sequence.

## 7. External integration handoff

After this specification is implemented, the remaining work is deliberately operational:

1. Configure one Privy app, its allowed origin, verification key, authorization key/quorum, and
   matching private authorization key.
2. Confirm the installed Privy flow can create the user-owned agent wallet and broadcast a policy-
   permitted transaction on `eip155:5042002`.
3. Obtain an OpenAI API key and verify access to `gpt-5.5-2026-04-23` with the existing strict
   Responses schema.
4. Deploy and verify the factory/account on Arc, record their actual metadata, and fund owner,
   account, agent, and rehearsal balances.
5. Deploy the generated subgraph through Studio and configure its real query endpoint/key.
6. Provision or identify the production host, domain, TLS, persistent PostgreSQL storage, and backup
   destination.
7. Run provider preflight, policy probe, health check, restart recovery, and live acceptance.
8. Rehearse once from a clean browser, then record the human-narrated video.

No external integration is accepted from configuration presence alone. The final gate is the real
100/40/70 flow with matching Arc receipts, Graph records, and visible answer citations.
