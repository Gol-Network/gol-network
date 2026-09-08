# Repository Guidelines

## Project Structure & Module Organization

GOL is a pnpm monorepo. `contracts/` contains Solidity accounts, Foundry tests, and deployment scripts. Shared ABIs, constants, validation, and types live in `packages/protocol/`. `agent/` implements the PostgreSQL journal, model adapter, Privy signer, payment worker, and CLI. `subgraph/` holds The Graph schema, mappings, queries, and Matchstick tests. The Next.js application and API routes are in `web/`; follow the additional instructions in `web/AGENTS.md` when editing that package. Operational assets live in `deploy/` and `deployments/`, while product specifications and evidence are under `spec/`. Static images belong in `assets/`.

## Build, Test, and Development Commands

Use Node 22 and pnpm 11.17.0.

- `pnpm install --frozen-lockfile` installs the pinned workspace dependencies.
- `pnpm typecheck && pnpm test && pnpm build` validates all packages that expose those scripts.
- `pnpm --filter @gol/web dev` starts the local Next.js preview at `127.0.0.1:3000`.
- `forge test --root contracts -vvv` runs contract unit, fuzz, and invariant tests.
- `pnpm --filter @gol/subgraph codegen && pnpm --filter @gol/subgraph build` regenerates and validates subgraph types.
- `pnpm --filter @gol/web test:e2e` runs Playwright browser tests.
- `pnpm format:check` checks formatting; use `pnpm format` to apply Prettier.

## Coding Style & Naming Conventions

TypeScript is ESM and uses two-space indentation, single quotes, semicolons, trailing commas, and a 100-column Prettier limit. Use `camelCase` for values/functions, `PascalCase` for types/components, and kebab-case filenames such as `submit-payment.ts`. Solidity uses four spaces and `forge fmt`; contracts and tests use `PascalCase`, while functions use `camelCase`. Keep shared chain data and API types in `@gol/protocol` rather than duplicating them.

## Testing Guidelines

Place Vitest files in package `test/` or `tests/` directories with `*.test.ts`; name Foundry tests `*.t.sol`. Add regression coverage for policy decisions, idempotency, journal recovery, and API boundary changes. PostgreSQL integration tests require `TEST_DATABASE_URL` and otherwise skip. No numeric coverage threshold is enforced, but CI runs type checks, all workspace tests, web/subgraph builds, contract fuzz/invariant suites, and ARM64 image builds.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects with prefixes such as `feat:`, `fix:`, `docs:`, and `ops:`. Keep each commit focused. Pull requests should explain the behavior and trust-boundary impact, list verification commands, link relevant issues/specs, and include screenshots for UI changes. Never commit secrets or real API keys; update `deploy/.env.example` for new configuration and keep deployment placeholders honest until independently verified.
