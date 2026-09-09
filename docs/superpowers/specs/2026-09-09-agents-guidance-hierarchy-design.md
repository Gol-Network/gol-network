# AGENTS.md Guidance Hierarchy Design

## Goal

Make the repository easier for coding agents to navigate by placing durable, scoped guidance at
the boundaries where languages, responsibilities, trust assumptions, or validation commands
change. The hierarchy must help an agent locate authoritative code without duplicating guidance
or treating generated output as source.

## Hierarchy

The root `AGENTS.md` remains authoritative for repository-wide structure, security, style,
testing, commits, and deployment-wallet handling. It will gain a source-of-truth map, dependency
direction, generated-file exclusions, cross-package change rules, and a validation matrix.

Scoped guides will be maintained at these boundaries:

- `contracts/AGENTS.md`: account and factory invariants, Solidity source/test/script locations,
  deployment safety, and Foundry validation.
- `packages/protocol/AGENTS.md`: shared ABI/constants/schema ownership, public exports, downstream
  compatibility, and package validation.
- `agent/AGENTS.md`: journal, model, query, signing, payment-worker, and CLI boundaries; recovery,
  idempotency, policy, and secret-handling expectations.
- `subgraph/AGENTS.md`: manifest/schema/ABI/mapping/query relationships, generated artifacts, event
  consistency, and Graph validation.
- `web/AGENTS.md`: package-wide Next.js rules plus server/client boundaries, runtime
  configuration, API behavior, wallet actions, and web validation.
- `web/src/AGENTS.md`: the internal client/component/server/wallet layering and import/security
  constraints that do not apply to `web/app` or tests.
- `scripts/AGENTS.md`: operator-command contracts, redacted output, explicit live configuration,
  idempotence where practical, and focused invocation.
- `deploy/AGENTS.md`: production configuration ownership, secret placeholders, backup/restore and
  migration safety, image/platform concerns, and compose validation.
- `spec/AGENTS.md`: distinction among product intent, implementation plans, prompts, operational
  status, and evidence; historical claims must remain dated and evidence-bounded.

No guides will be added under generated or dependency directories such as `dist/`, `out/`,
`cache/`, `build/`, `generated/`, `.next/`, broadcasts, or `node_modules/`.

## Content Rules

Each child guide adds only facts local to its subtree and inherits root guidance implicitly. Each
guide should identify authoritative inputs, important entry points, invariants or trust boundaries,
generated files that must not be hand-edited, and the narrowest useful verification commands.
Guidance should describe stable architecture rather than transient implementation status.

The existing auto-generated Next.js block in `web/AGENTS.md` will be preserved exactly. New web
guidance will be placed outside its markers so `next dev` can continue managing that block.

## Safety and Scope

The change is documentation-only. It will not modify application code, generated output,
deployment configuration, or the unrelated untracked `deploy/docker-compose.fixture.yml`. It will
not expose deployment keys, passwords, RPC credentials, or provider secrets.

## Validation

Validation will confirm that every intended guide exists, parent/child scopes are coherent, all
referenced paths and package commands exist, the Next.js managed block is unchanged, formatting
passes for the edited Markdown, and the Git diff contains only the design and guidance files.
Application, contract, and end-to-end test suites are unnecessary because runtime behavior is not
changed.
