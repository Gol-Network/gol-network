# Operator Script Guidelines

Scripts are explicit operator entry points, not reusable domain modules. Move reusable behavior into the owning workspace package and keep scripts focused on configuration, orchestration, redacted reporting, and exit status.

## Existing Commands

- `preflight.ts` validates configured providers and reports only safe readiness signals.
- `prepare-subgraph.ts` prepares deployment-specific subgraph inputs.
- `demo.ts` runs live acceptance behavior and must distinguish fixtures from real integrations.

Require real configuration explicitly; do not guess networks, contracts, accounts, or providers. Preserve non-interactive behavior and stable exit codes. Output only booleans, public identifiers, transaction hashes, and sanitized error codes. Never print credentials, authorization headers, private keys, keystore passwords, RPC URLs containing secrets, or full provider payloads.

New state-changing operations should be idempotent where possible and expose a dry-run or explicit confirmation boundary. A successful script run is operational evidence only for the exact configuration and timestamp tested; record durable evidence under `spec/evidence/` when required.

Invoke scripts through the root package commands so workspace dependencies resolve consistently: `pnpm preflight`, `pnpm subgraph:prepare`, and `pnpm demo:acceptance`.
