# Contract Guidelines

This guide applies to the Foundry project under `contracts/` and inherits the repository root instructions.

## Layout and Ownership

- `src/GolAccount.sol` owns account mandates, execution, refusals, and owner controls.
- `src/GolAccountFactory.sol` owns deterministic account creation and discovery events.
- `script/Deploy.s.sol` is the deployment entry point. `test/` contains unit, fuzz, and invariant coverage; reusable mocks stay under `test/mocks/`.
- `out/`, `cache/`, and `broadcast/` are generated. Never hand-edit them or treat broadcast output alone as proof of a live deployment.

## Contract Invariants

Authorization must be enforced on-chain before value moves; off-chain policy is defense in depth, not a substitute. Preserve owner-only administration, revocation, mandate limits, replay protection, exact token amounts, and refusal/event observability. Keep external-call state transitions safe against reentrancy and partial failure.

Contract events are consumed by `packages/protocol`, `subgraph`, `agent`, and `web`. When functions, errors, or events change, update those consumers and deployment evidence in the same change. Prefer explicit custom errors and deterministic behavior; avoid unbounded iteration over user-controlled collections.

## Deployment and Validation

Use only the root-documented `gol-deployer` keystore account for deployments. Load passwords and RPC URLs outside the repository and never pass secrets in logged command arguments.

- Format check: `forge fmt --root contracts --check`
- Tests: `forge test --root contracts -vvv`
- For invariant changes, confirm configured fuzz and invariant runs in `foundry.toml` remain meaningful.
