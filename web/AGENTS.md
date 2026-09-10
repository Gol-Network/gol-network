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
- `app/tokenized-stocks/` and `src/components/tokenized-stocks/` own the Base hackathon's mocked
  Tokenized Stocks experience. Keep it clearly identified as mock data until a live market adapter lands.
- `tests/` contains Vitest boundary tests and Playwright flows. `.next/`, test output, and package `node_modules/` are generated.

Read browser configuration on the server at runtime and pass it to client components as typed, serializable props. Do not add `NEXT_PUBLIC_*` build-time configuration. Keep secrets, database access, Privy server APIs, and privileged chain operations behind server-only modules and route handlers. Validate request bodies, query parameters, chain IDs, addresses, and upstream responses at API boundaries.

Owner wallet actions must remain distinct from agent execution. The browser may request signatures from the connected owner; it must not receive server signing credentials. Keep fixture and live backend paths behaviorally aligned without silently falling back from live mode to fixtures.

## UI Implementation Rules

These rules are mandatory for every new UI and every UI file touched by a change:

- Use shadcn components for all interactive controls and surface primitives. Feature components must not render native `button`, `input`, `textarea`, `select`, dialog, tab, card, or drawer elements directly. Native DOM controls may appear only inside their corresponding reusable shadcn primitive in `src/components/ui/`.
- Use Tailwind CSS v4 utilities for component styling. Do not add component selectors, page selectors, CSS modules, inline style objects for static presentation, or handwritten CSS declarations outside the Tailwind theme and base layers.
- Define reusable visual values in `app/globals.css` as Tailwind v4 and shadcn semantic tokens. Colors, borders, radii, shadows, font families, and line heights must use tokens such as `background`, `foreground`, `card`, `muted`, `primary`, `border`, `ring`, `radius`, and `shadow` instead of repeated literals or arbitrary values.
- Use semantic Tailwind classes such as `bg-card`, `text-muted-foreground`, `border-border`, `rounded-card`, and `shadow-panel`. Repeated hexadecimal colors, repeated arbitrary radii, and repeated arbitrary shadows are not allowed in feature components.
- Do not add generic AI-generated decoration. This includes decorative status dots, middle-dot separators, em-dash separators, gradients, glow effects, floating blobs, and decorative patterns without explicit product meaning.
- Use icons only when they communicate a concrete action, asset, protocol, status, or trust boundary. Do not use icons as filler.
- Use icons from the project's established icon packages, with `lucide-react` as the default. Do not hand-code SVG markup in feature components. Brand marks must come from a maintained official asset or package, never from traced or improvised SVG paths.
- Keep fixture labeling explicit and visually secondary. Fixture UI must never imply that Privy authenticated, a wallet signed, or a transaction executed on a live chain.
- When a reference image or reference implementation is provided, preserve its information hierarchy and spacing before introducing new visual patterns.

Before completing a UI change, audit touched feature files for direct native controls, hand-coded SVG, arbitrary color values, arbitrary radii, arbitrary shadows, gradients, middle dots, and em dashes. Run the visual flow in both themes and at desktop and mobile widths.

## Validation

- `pnpm --filter @gol/web typecheck`
- `pnpm --filter @gol/web test`
- `pnpm --filter @gol/web build`
- `pnpm --filter @gol/web test:e2e` for user-flow, routing, wallet, or visual changes.
