# Repository Guidelines

## Repository Map & Sources of Truth

GOL is a pnpm monorepo. `contracts/` contains Solidity accounts, Foundry tests, and deployment scripts. Shared ABIs, constants, validation, and types live in `packages/protocol/`. `agent/` implements the PostgreSQL journal, model adapter, Privy signer, payment worker, and CLI. `subgraph/` holds The Graph schema, mappings, queries, and Matchstick tests. The Next.js application and API routes are in `web/`; follow the additional instructions in `web/AGENTS.md` when editing that package. Operator tooling lives in `scripts/`: the redacted provider preflight, subgraph preparation, and the live acceptance runner. Operational assets live in `deploy/` and `deployments/`, while product specifications and evidence are under `spec/`. Static images belong in `assets/`.

Source dependencies flow from Solidity contracts into `@gol/protocol`, then into the agent and web packages. The subgraph indexes contract events and the web application combines indexed activity with agent-owned journal data. When a contract interface or event changes, update the Solidity source, protocol ABI/types, subgraph manifest/mappings, and affected agent/web consumers together.

Treat `node_modules/`, `.next/`, `dist/`, `out/`, `cache/`, `broadcast/`, `subgraph/build/`, and `subgraph/generated/` as generated artifacts. Do not hand-edit or use them as architectural sources. Deployment addresses belong in `deployments/`; distinguish checked-in configuration from independently verified live state.

## Deployment Wallet

Use the Foundry keystore account named `gol-deployer`
(`0xD2DA4968B09401DB75517EF9AcF6A30CdC7dF26F`) for GOL contract deployments. Keep the private key,
keystore password, and RPC credentials outside the repository; never print, log, or commit them.

## Build, Test, and Development Commands

Use Node 22 and pnpm 11.17.0.

- `pnpm install --frozen-lockfile` installs the pinned workspace dependencies.
- `pnpm typecheck && pnpm test && pnpm build` validates all packages that expose those scripts.
- `pnpm --filter @gol/web dev` starts the local Next.js preview at `127.0.0.1:3000`.
- `forge test --root contracts -vvv` runs contract unit, fuzz, and invariant tests.
- `pnpm --filter @gol/subgraph codegen && pnpm --filter @gol/subgraph build` regenerates and validates subgraph types.
- `pnpm --filter @gol/web test:e2e` runs Playwright browser tests.
- `pnpm format:check` checks formatting; use `pnpm format` to apply Prettier.
- `docker compose -f deploy/docker-compose.yml config -q` validates the production stack.
- `pnpm preflight`, `pnpm policy:probe`, and `pnpm subgraph:prepare` are operator commands that need real configuration; they print booleans, public identifiers, and error codes only.

## Coding Style & Naming Conventions

TypeScript is ESM and uses two-space indentation, single quotes, semicolons, trailing commas, and a 100-column Prettier limit. Use `camelCase` for values/functions, `PascalCase` for types/components, and kebab-case filenames such as `submit-payment.ts`. Solidity uses four spaces and `forge fmt`; contracts and tests use `PascalCase`, while functions use `camelCase`. Keep shared chain data and API types in `@gol/protocol` rather than duplicating them.

## Testing Guidelines

Place Vitest files in package `test/` or `tests/` directories with `*.test.ts`; name Foundry tests `*.t.sol`. Add regression coverage for policy decisions, idempotency, journal recovery, and API boundary changes. PostgreSQL integration tests require `TEST_DATABASE_URL` and otherwise skip. No numeric coverage threshold is enforced, but CI runs type checks, all workspace tests, web/subgraph builds, contract fuzz/invariant suites, and ARM64 image builds.

Use the narrowest relevant check while iterating, then run all checks affected by the dependency path. Protocol or ABI changes normally require protocol tests plus affected agent, web, contract, and subgraph validation. Documentation-only changes require `pnpm format:check` and `git diff --check`; deployment documentation or Compose changes also require the Compose configuration check.

## Trust Boundaries

Enforce owner mandates before signing or moving value. Preserve refusal and journal records, idempotent payment behavior, exact integer token amounts, and owner revocation. Validate untrusted model, API, database, chain, and environment input at its boundary. Keep server credentials and signing material out of browser bundles and operator output. Never describe proposed or locally tested behavior as deployed without dated operational evidence.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects with prefixes such as `feat:`, `fix:`, `docs:`, and `ops:`. Keep each commit focused. Pull requests should explain the behavior and trust-boundary impact, list verification commands, link relevant issues/specs, and include screenshots for UI changes. Never commit secrets or real API keys; update `deploy/.env.example` for new configuration and keep deployment placeholders honest until independently verified. Browser configuration is read on the server at runtime and passed to client components as typed props, so do not reintroduce build-time `NEXT_PUBLIC_*` values.
