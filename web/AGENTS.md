<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Web Package Guidelines

These rules apply to `web/` in addition to the repository root guide. Keep the managed Next.js block above unchanged; `next dev` may regenerate it.

## Architecture

- `app/` owns routes, route handlers, layouts, providers, and global CSS.
- `src/server/` owns privileged orchestration, chain reads, journal access, and runtime environment parsing.
- `src/client/` owns browser-safe backend adapters and view models; `src/components/` owns React UI.
- `src/wallet/` owns owner-authorized browser wallet actions.
- `tests/` contains Vitest boundary tests and Playwright flows. `.next/`, test output, and package `node_modules/` are generated.

Read browser configuration on the server at runtime and pass it to client components as typed, serializable props. Do not add `NEXT_PUBLIC_*` build-time configuration. Keep secrets, database access, Privy server APIs, and privileged chain operations behind server-only modules and route handlers. Validate request bodies, query parameters, chain IDs, addresses, and upstream responses at API boundaries.

Owner wallet actions must remain distinct from agent execution. The browser may request signatures from the connected owner; it must not receive server signing credentials. Keep fixture and live backend paths behaviorally aligned without silently falling back from live mode to fixtures.

## Validation

- `pnpm --filter @gol/web typecheck`
- `pnpm --filter @gol/web test`
- `pnpm --filter @gol/web build`
- `pnpm --filter @gol/web test:e2e` for user-flow, routing, wallet, or visual changes.
