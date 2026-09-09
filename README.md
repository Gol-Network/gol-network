<p align="center">
  <img src="assets/gol-logo.png" width="112" alt="GOL logo" />
</p>

# GOL

**An agent payment account that enforces spending limits and explains refusals on-chain.**

![GOL cover](assets/gol-cover-640x360.png)

GOL lets a small business owner authorize a separate AI operations agent to pay one approved contractor in USDC on Arc testnet. The owner signs a mandate with a per-payment cap, cumulative cap, allowlist, and expiry. The immutable account contract is the final authority: it transfers an allowed payment or persists a policy refusal without moving funds. The Graph supplies the evidence used for activity and cited natural-language explanations.

The acceptance story is deliberately narrow: fund 100 USDC, pay 40 USDC, then request 70 USDC. The first request executes. The second is recorded as `CUMULATIVE_CAP` with 60 USDC headroom.

> Deployment status: local implementation complete, external deployment not performed. [The deployment manifest](deployments/arc-testnet.json) intentionally contains `not_deployed` placeholders until real addresses and receipts exist. Without provider configuration the interface runs an explicitly labeled fixture mode: a mocked provider walkthrough that drives the same interface states as a live payment and is never evidence.

## Why the controls matter

GOL uses three separate control planes:

- Privy authenticates the owner and provisions a separate agent wallet with a backend signer limited to Arc chain ID `5042002`, the linked GOL account, and zero native value. The policy constrains the transaction envelope only; it is not an ABI-level allowlist and is never described as one.
- `GolAccount` enforces recipient, amount, cumulative budget, expiry, revocation, replay, and caller rules on-chain. The agent and model cannot change these rules.
- The Graph indexes `Executed` and `Refused` events. The question layer cites those records and reports freshness instead of inventing missing evidence.

Owner actions run directly in the browser wallet. The backend never receives an owner signing credential. The model only parses a bounded instruction or phrases a read-only explanation. It never supplies a request ID, signs, chooses transaction status, or decides policy.

![GOL architecture](assets/architecture.png)

See [ARCHITECTURE.md](ARCHITECTURE.md) for trust boundaries, failure semantics, and recovery behavior.

## Repository map

| Path                 | Purpose                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `contracts/`         | Foundry contracts, deployment script, behavior tests, invariant tests                     |
| `packages/protocol/` | Shared ABI, Arc constants, exact USDC parsing, API types                                  |
| `agent/`             | Durable PostgreSQL journal, strict model adapter, Privy signer, chain reconciliation, CLI |
| `subgraph/`          | Factory template, account event mappings, GraphQL schema and queries                      |
| `web/`               | One-page Next.js owner workflow and authenticated API routes                              |
| `deploy/`            | Pinned Docker Compose stack, TLS proxy, migration, backup, restore, release scripts       |
| `scripts/`           | Redacted provider preflight, subgraph preparation, and the live 40/70 acceptance runner   |
| `spec/`              | Product, architecture, implementation, Studio, evidence, prompts, and submission records  |

## Local review

Requirements: Node.js 22, pnpm 11.17.0, Foundry 1.5.1 or compatible, and Docker Compose for database integration.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
(cd contracts && forge test)
```

Start the labeled fixture walkthrough:

```bash
pnpm --filter @gol/web dev
```

Open `http://127.0.0.1:3000`. With no `PRIVY_APP_ID` and no `FACTORY_ADDRESS`, the page shows a persistent `FIXTURE MODE` banner and runs a mocked provider flow: the resumable owner checklist, a 40 USDC execution, a 70 USDC on-chain refusal, the `On-chain; indexing pending` transition, and a grounded answer with citations. Nothing touches a chain, a signer, or a paid model, and the results are never presented as provider evidence.

The browser-facing configuration is read on the server at request time and passed to client components as typed props, so the same production image can be pointed at different Privy, Arc, explorer, and factory values without rebuilding. There are no build-time `NEXT_PUBLIC_*` values.

For database integration tests, start a disposable PostgreSQL 17 instance and set `TEST_DATABASE_URL`. Tests skip cleanly when it is absent.

```bash
TEST_DATABASE_URL=postgresql://gol_runtime:password@127.0.0.1:5432/gol \
  pnpm --filter @gol/agent test
```

## Live configuration order

External accounts and credentials are intentionally not embedded in this repository.

1. Deploy `GolAccountFactory` on Arc testnet using [contracts/script/Deploy.s.sol](contracts/script/Deploy.s.sol). The script rejects any other chain and fixes official Arc USDC at `0x3600000000000000000000000000000000000000`.
2. Replace only the deployment fields in [deployments/arc-testnet.json](deployments/arc-testnet.json) with actual addresses, block, bytecode hash, source commit, and verification references.
3. Run `pnpm subgraph:prepare` to write the recorded factory address and start block into [subgraph/subgraph.yaml](subgraph/subgraph.yaml), then follow [spec/studio-setup.md](spec/studio-setup.md). The command refuses a manifest that still reports `not_deployed`, a null factory, or a null start block, so the placeholder address cannot be deployed. Record the real deployment ID and query endpoint without committing its API key.
4. Create a dedicated Privy app, verification key, and authorization key quorum. One canonical `PRIVY_APP_ID` serves authentication, provisioning, the worker, and the public app ID handed to the browser. Configure the production environment from [deploy/.env.example](deploy/.env.example).
5. Verify the existing `gol-production` EC2 target, DNS, encrypted storage, and backup role, then follow [deploy/README.md](deploy/README.md). The scripts do not create infrastructure.
6. Run `pnpm preflight` and, with `GOL_POLICY_PROBE=1`, `pnpm policy:probe` before any rehearsal. Both print booleans, public identifiers, and error codes only.
7. Sign in as the owner and work through the setup checklist: owner gas, GOL account, restricted agent wallet, agent gas reserve, exactly the required account balance, and the reviewed seven-day mandate. The checklist derives completed steps from the chain on every load, so it resumes rather than repeating work.

Do not send other tokens to the account. With Arc's stablecoin-native balance model, do not add the native and ERC-20 views as if they were separate funds.

## Repeatable live acceptance

After deployment and owner setup, use a fresh 100 USDC mandate and an address-book label. The runner generates two cryptographically random request IDs, checks the initial account state, waits for terminal journal states, waits for real indexed records, and asks the grounded question.

```bash
export GOL_API_URL=https://your-gol-host.example
export GOL_DEV_TOKEN=local-secret-from-production-host
export GOL_DEMO_MANDATE_ID=1
export GOL_DEMO_RECIPIENT_LABEL='Design contractor'
pnpm demo:acceptance
```

It exits nonzero unless the first result is `executed`, the second is `refused` with `CUMULATIVE_CAP`, both transaction hashes exist, and both request IDs appear in The Graph activity. Its output records the deployed source commit, the public application URL, the Privy policy ID, both indexed action IDs, and the answer citations. This is a live acceptance tool, not a fixture generator.

## Pre-integration tooling

These commands accept real values without any source edit.

| Command                 | Purpose                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm preflight`        | Redacted provider preflight: configuration presence, Arc chain ID, Privy app and signer quorum, OpenAI model access, Graph `_meta`, deployed bytecode, account ownership      |
| `pnpm policy:probe`     | Sends one allowed GOL call and one wrong-destination request that Privy must deny before broadcast. Requires `GOL_POLICY_PROBE=1` because the allowed call consumes agent gas |
| `pnpm subgraph:prepare` | Writes the verified factory address and start block into the subgraph manifest, or refuses an undeployed record                                                               |
| `pnpm demo:acceptance`  | The final live 40/70 gate                                                                                                                                                     |

None of them print a token, private key, or provider error body.

## Production operations

The production topology is Next.js, one persistent payment worker, private PostgreSQL, and Caddy on the existing `gol-production` host. Subgraph Studio remains external. The release script backs up first, drains workers, builds pinned images, applies an idempotent schema, activates services, and checks `/api/health`.

```bash
cp deploy/.env.example deploy/.env.production
chmod 600 deploy/.env.production
export RELEASE_COMMIT="$(git rev-parse HEAD)"
export GOL_BACKUP_BUCKET=private-gol-backups
export GOL_BACKUP_KMS_KEY_ID=alias/gol-backups
./deploy/deploy.sh
```

Read [deploy/README.md](deploy/README.md) before running this on a host. Database passwords must be URL-safe because the runtime password is used in a connection URL.

## Security and product limits

- Arc testnet only. This code is not audited and is not represented as mainnet-ready.
- GOL verifies payment execution and policy outcomes. It does not verify invoices, identity, work delivery, or off-chain recipient intent.
- Policy refusals persist only when the direct `pay` transaction itself completes successfully. Malformed calls, unauthorized callers, insufficient funds, token failures, and reverted outer calls remain technical failures.
- A Privy signer rejection occurs before Arc submission and therefore has no on-chain refusal receipt.
- Same-ID retries with the same payload are idempotent. A changed payload under the same ID reverts. New request IDs remain new business attempts.
- Owner revocation is the definitive account kill switch. Removing the additional signer is a separate defense-in-depth action.

## Hackathon records

GOL is documented as an ETHOnline 2026 Start Fresh build. AI-assisted implementation and prompts are disclosed in [spec/prompts](spec/prompts). Public dependencies and generated-asset provenance are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Actual human feedback belongs in [FEEDBACK.md](FEEDBACK.md), which currently states that none has been collected. The final registration, track selection, narration, dashboard checks, and submission remain human actions.

See [spec/submission-checklist.md](spec/submission-checklist.md) and [spec/submission-copy.md](spec/submission-copy.md) for the honest release handoff.
