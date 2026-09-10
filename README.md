<p align="center">
  <a href="https://gol.network">
    <img src="web/public/gol-mark-blue.svg" width="88" alt="GOL logo" />
  </a>
</p>

<h1 align="center">GOL</h1>

<p align="center">
  <strong>Owner-controlled accounts for safe, auditable agent payments.</strong>
</p>

<p align="center">
  <a href="https://gol.network">Live application</a> ·
  <a href="ARCHITECTURE.md">Architecture</a> ·
  <a href="spec/deployment-status.md">Deployment status</a> ·
  <a href="deploy/README.md">Operations</a>
</p>

GOL is an account and execution system for AI agents on Arc testnet. An owner defines a mandate—
approved recipients, payment limits, cumulative budget, and expiry—and a separate agent can act only
inside those rules. The `GolAccount` smart contract is the final authority: an allowed payment moves
USDC, while a policy violation is recorded as an on-chain refusal without transferring funds.

The application combines an owner dashboard, a streaming AG-UI/LangGraph assistant, Aave MCP tools,
a durable payment journal, and indexed evidence from The Graph. Read-only and simulation tools may
run automatically; every wallet write is prepared for explicit human review.

> **Project status:** the application, verified Arc testnet factory, and subgraph are live. The latest
> operational evidence and remaining acceptance work are tracked in
> [spec/deployment-status.md](spec/deployment-status.md). Arc testnet does not currently have an
> official Aave deployment; the repository's Aave-compatible Arc sandbox has been simulated but has
> not been broadcast. Never treat fixture data or that sandbox as an official Aave market.

## What GOL provides

- **Contract-enforced mandates** — recipient allowlists, per-payment caps, cumulative limits,
  expiration, revocation, replay protection, and deterministic refusal reasons.
- **Owner-controlled custody** — account creation, deposits, withdrawals, mandates, and prepared
  protocol actions remain in the connected owner wallet.
- **Restricted agent execution** — production supports a non-exportable AWS KMS signer; Privy-backed
  restricted signers remain available as an alternative.
- **Streaming agent interface** — a separate LangGraph service streams AG-UI text, tool lifecycle
  events, and structured results through a same-origin Next.js proxy.
- **Aave MCP integration** — the agent discovers allowlisted Aave tools, reads live protocol data,
  simulates actions, and returns unsigned transactions for review.
- **Durable and explainable outcomes** — PostgreSQL preserves execution state, while The Graph
  indexes contract events used by activity views and cited answers.
- **Fail-closed boundaries** — malformed model output, signer mismatch, stale evidence, missing
  provider configuration, and unsupported transaction shapes do not become successful actions.

## System design

```mermaid
flowchart TB
  subgraph CLIENT["Owner device — no server signing credentials"]
    direction LR
    OWNER["Owner"]
    UI["Next.js client<br/>Dashboard · Activity · Rules · Agent chat"]
    REVIEW["Human review<br/>Account · Mandate · Payment · Aave transaction"]
    WALLET["Privy embedded wallet<br/>or linked EOA"]

    OWNER --> UI
    UI --> REVIEW
    OWNER --> WALLET
    REVIEW -->|"explicit approval"| WALLET
  end

  subgraph EDGE["Public application boundary"]
    direction LR
    CADDY["Caddy<br/>TLS ingress"]
    NEXT["Next.js server<br/>runtime config · validation · auth"]
    ACCOUNT_API["Account and payment APIs"]
    AGENT_PROXY["AG-UI proxy<br/>validated SSE passthrough"]
    QUERY_API["Activity and question APIs"]

    CADDY --> NEXT
    NEXT --> ACCOUNT_API
    NEXT --> AGENT_PROXY
    NEXT --> QUERY_API
  end

  subgraph IDENTITY["Identity provider"]
    PRIVY_AUTH["Privy authentication<br/>session verification · owner wallet"]
  end

  subgraph AGENT_PLANE["Private conversational-agent boundary — no wallet or database credential"]
    direction LR
    LANGGRAPH["LangGraph + FastAPI<br/>run state · tool iteration · AG-UI events"]
    TOOL_ROUTER["Allowlisted tool registry<br/>40 Aave + 12 GOL tools"]
    OPENAI_AGENT["OpenAI model<br/>tool selection and response text"]
    AAVE_MCP["Aave MCP<br/>read · simulate · prepare unsigned transaction"]
    GOL_HANDOFF["Typed GOL client handoff<br/>never signs or submits"]

    LANGGRAPH <--> OPENAI_AGENT
    LANGGRAPH --> TOOL_ROUTER
    TOOL_ROUTER <--> AAVE_MCP
    TOOL_ROUTER --> GOL_HANDOFF
  end

  subgraph PAYMENT_PLANE["Private durable-execution boundary"]
    direction LR
    JOURNAL[("PostgreSQL journal<br/>idempotency · leases · recovery")]
    WORKER["Persistent payment worker<br/>claim · parse · reconcile"]
    ENVELOPE["Transaction envelope validator<br/>chain · account · value · gas ceilings"]
    SIGNER["Restricted agent signer<br/>AWS KMS or Privy"]
    OPENAI_PARSE["Bounded model adapter<br/>recipient + exact USDC amount"]

    JOURNAL -->|"leased request"| WORKER
    WORKER <--> OPENAI_PARSE
    WORKER --> ENVELOPE
    ENVELOPE --> SIGNER
    SIGNER -->|"signed raw transaction"| WORKER
    WORKER -->|"persist before broadcast"| JOURNAL
  end

  subgraph ARC["Arc testnet — authoritative execution"]
    direction LR
    RPC["Arc RPC"]
    FACTORY["GolAccountFactory"]
    ACCOUNT["GolAccount<br/>owner · mandate · replay protection"]
    USDC["Official Arc USDC"]

    RPC --> FACTORY
    FACTORY -->|"one account per owner"| ACCOUNT
    RPC --> ACCOUNT
    ACCOUNT -->|"allowed transfer"| USDC
    USDC -->|"balance and transfer result"| ACCOUNT
  end

  subgraph EVIDENCE["Indexed evidence boundary"]
    direction LR
    EVENTS["Executed · Refused<br/>Mandate · Revocation events"]
    GRAPH["The Graph subgraph<br/>deterministic event indexing"]
    GRAPH_API["GraphQL provider<br/>records · indexed block · freshness"]

    EVENTS --> GRAPH
    GRAPH --> GRAPH_API
  end

  UI <-->|"HTTPS"| CADDY
  NEXT <-->|"verify session"| PRIVY_AUTH
  AGENT_PROXY <-->|"authenticated AG-UI stream"| LANGGRAPH
  GOL_HANDOFF -->|"open owner review"| AGENT_PROXY
  AAVE_MCP -->|"structured result or unsigned tx"| LANGGRAPH
  ACCOUNT_API -->|"queue instruction"| JOURNAL
  WORKER -->|"broadcast stored bytes"| RPC
  WALLET -->|"owner-signed setup and reviewed writes"| RPC
  ACCOUNT --> EVENTS
  GRAPH_API --> QUERY_API
  QUERY_API -->|"scoped records + citations"| UI
```

### Payment execution lifecycle

```mermaid
stateDiagram-v2
  [*] --> queued: authenticated instruction
  queued --> needs_clarification: recipient or amount is ambiguous
  queued --> signing_prepared: intent validated and nonce reserved
  signing_prepared --> signed: exact raw transaction persisted
  signed --> submitted: broadcast attempted
  submitted --> pending: transaction visible, receipt pending
  pending --> executed: contract transferred USDC
  pending --> refused: contract recorded a policy refusal

  queued --> signer_blocked: setup, mandate, signer, or gas guard fails
  signing_prepared --> signer_blocked: envelope or signer rejects
  submitted --> unknown: submission cannot yet be proven
  pending --> unknown: final outcome cannot yet be proven
  queued --> technical_failure: deterministic runtime or provider failure

  executed --> [*]
  refused --> [*]
  needs_clarification --> [*]
  signer_blocked --> [*]
  technical_failure --> [*]
  unknown --> [*]
```

The owner-signed and automated payment-authority paths converge at the contract. Owner setup actions
and reviewed Aave transactions are signed in the browser. Automated GOL payments travel through the
durable journal, the envelope validator, and the restricted signer before reaching Arc. Signed bytes
are persisted before broadcast, so recovery reuses the same transaction instead of signing a
replacement.

`GolAccount` is the payment-policy authority. It checks the active agent, expiry, recipient,
per-payment cap, cumulative cap, revocation, and request replay before moving USDC. A valid policy
denial emits `Refused` and moves no funds; malformed calls and technical reverts are not mislabeled as
policy decisions.

The evidence path remains separate from execution. Confirmed receipts appear immediately as
"on-chain, indexing pending" records, then The Graph replaces them with indexed events carrying block
and transaction provenance. Query APIs preserve current, catching-up, stale, partial, unavailable,
and integrity-error states rather than converting missing evidence into a successful result.

The model never receives signing credentials, selects request IDs, decides transaction outcomes, or
bypasses wallet review. GOL-native LangGraph tools return typed client handoffs instead of mutating
account state. See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete trust boundaries, journal state
machine, recovery behavior, and failure semantics.

## Technology

| Layer                | Implementation                                                                |
| -------------------- | ----------------------------------------------------------------------------- |
| Smart accounts       | Solidity, Foundry, OpenZeppelin, official Arc testnet USDC                    |
| Shared protocol      | TypeScript ABIs, constants, validation, exact integer amount types            |
| Agent runtime        | Node.js worker, PostgreSQL journal, OpenAI Responses, AWS KMS or Privy signer |
| Conversational agent | Python, LangGraph, FastAPI, AG-UI, Aave MCP                                   |
| Indexing             | The Graph subgraph and GraphQL queries                                        |
| Application          | Next.js, React, Tailwind CSS, shadcn/ui, Privy                                |
| Operations           | Docker Compose, Caddy, PostgreSQL 17, encrypted off-host backups              |

## Repository layout

| Path                 | Responsibility                                                                         |
| -------------------- | -------------------------------------------------------------------------------------- |
| `contracts/`         | `GolAccount`, factory, deployment scripts, unit/fuzz/invariant tests, Arc Aave sandbox |
| `packages/protocol/` | Shared ABI, Arc constants, exact USDC parsing, validation, and API types               |
| `agent/`             | Journal, model adapter, signer providers, reconciliation worker, and operator CLI      |
| `langgraph-agent/`   | Independent streaming agent server and bounded Aave/GOL tool catalogue                 |
| `subgraph/`          | Event schema, mappings, queries, and Matchstick tests                                  |
| `web/`               | Next.js owner experience, API routes, AG-UI client, and wallet review surfaces         |
| `deploy/`            | Production Compose stack, release, migration, backup, and restore tooling              |
| `deployments/`       | Checked-in public deployment manifests and verification references                     |
| `scripts/`           | Preflight, policy probe, subgraph preparation, and live acceptance tooling             |
| `spec/`              | Product specifications, architecture decisions, evidence, and release checklists       |

## Local development

### Prerequisites

- Node.js 22
- pnpm 11.17.0
- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- Foundry 1.5.1 or compatible
- Docker with Compose v2 for PostgreSQL and production-stack validation

Install the pinned workspace dependencies and initialize Solidity submodules:

```bash
pnpm install --frozen-lockfile
git submodule update --init --recursive
```

Start the web application and LangGraph service:

```bash
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Without provider credentials, development
runs in an explicitly labeled fixture mode. Fixture mode exercises the same review states without
touching a chain, signer, paid model, or external provider; its output is not deployment evidence.

For live local integrations, create `web/.env.local` from the field definitions in
[deploy/.env.example](deploy/.env.example). Keep it untracked. `pnpm dev` starts the payment worker
automatically when both `DATABASE_URL` and `ARC_RPC_URL` are present. The same local file is loaded by
the web and LangGraph services, so server-only credentials do not need to be duplicated.

### Validation

Run the workspace checks:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Run the contract, subgraph, and browser suites when changing their respective boundaries:

```bash
forge test --root contracts -vvv
pnpm --filter @gol/subgraph codegen
pnpm --filter @gol/subgraph build
pnpm --filter @gol/web test:e2e
docker compose -f deploy/docker-compose.yml config -q
```

PostgreSQL integration tests require a disposable database and otherwise skip cleanly:

```bash
TEST_DATABASE_URL=postgresql://gol_runtime:password@127.0.0.1:5432/gol \
  pnpm --filter @gol/agent test
```

## Runtime configuration

Configuration is parsed and validated on the server when the application starts. Public values are
passed to client components as typed props; secrets never enter browser bundles, and production does
not rely on build-time `NEXT_PUBLIC_*` variables.

The authoritative field list is [deploy/.env.example](deploy/.env.example). Major groups are:

- Arc RPC, explorer, chain ID, and deployed GOL addresses
- Privy owner authentication and optional Privy restricted-signer credentials
- AWS KMS signer identity, region, address, fee ceilings, and gas policy
- PostgreSQL, The Graph, OpenAI, LangGraph shared authentication, and Aave MCP
- Operator-only preflight and acceptance-runner configuration

Never commit a filled environment file, private key, API token, database password, or provider error
body.

## Deployment and operations

Production runs Caddy, Next.js, the private LangGraph service, one persistent payment worker, and
PostgreSQL in Docker Compose. Only Caddy exposes a public port. LangGraph receives no wallet, AWS, or
database credential; only the worker has payment-signing authority.

Before a release, read [deploy/README.md](deploy/README.md), review the current
[deployment status](spec/deployment-status.md), and run the redacted preflight:

```bash
pnpm preflight
docker compose -f deploy/docker-compose.yml config -q
```

The release script requires an explicit source commit, creates an encrypted backup, drains workers,
builds pinned images, applies the idempotent schema, activates services, and checks health:

```bash
export RELEASE_COMMIT="$(git rev-parse HEAD)"
export GOL_BACKUP_BUCKET=private-gol-backups
export GOL_BACKUP_KMS_KEY_ID=alias/gol-backups
./deploy/deploy.sh
```

Provider configuration is not acceptance. A production claim requires the dated receipts, indexed
events, health result, and browser evidence defined in
[spec/deployment-status.md](spec/deployment-status.md).

## Security model and limitations

- GOL is Arc testnet software, has not been audited, and is not represented as mainnet-ready.
- The contract verifies mandate and payment rules; it does not verify invoices, identity, work
  delivery, or off-chain recipient intent.
- Owner revocation is the definitive payment-authority kill switch.
- A contract policy refusal is an on-chain outcome. A signer denial happens before submission and
  therefore has no refusal receipt.
- Identical retries are idempotent. Reusing a request ID with a changed payload reverts.
- Confirmed chain results and indexed results remain distinct until The Graph catches up.
- Aave preparation produces unsigned transactions only. The connected owner must review and sign,
  and its address must match the prepared sender.
- The Arc Aave-compatible sandbox is isolated test infrastructure, not an Aave DAO deployment,
  production oracle, official market, or eligibility claim.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Production operations](deploy/README.md)
- [Current deployment status](spec/deployment-status.md)
- [AG-UI and LangGraph design](spec/agui-langgraph-agent.md)
- [Arc Aave-compatible sandbox](spec/arc-aave-sandbox.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

GOL was developed as an ETHOnline 2026 Start Fresh project. AI-assisted implementation records and
public dependency provenance are retained under `spec/` and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
