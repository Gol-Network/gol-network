# GOL landing page visual redesign implementation report

**Date:** 2026-09-11
**Scope:** public `/` route only
**Verdict:** ready for final review; not deployed

## Outcome

The public landing now follows the frozen **Consequence Line** strategy from
`research-v2/impression-strategy.md`. The default first-screen proof shows an illustrative `$101`
request reaching a `$100` account boundary, producing `Refused: PER_TX_CAP` and a recorded `$100`
headroom result. The rest of the page moves through six visually distinct beats: request gate,
enforcement durability, mandate bento, outcome-record stack, adapter topology, and an explicit
prototype/design-target handoff.

No downloaded archive or 21st.dev source, asset, SVG path, stylesheet, font, or dependency was
copied. Research influenced only high-level composition: a causal rail, unequal bento hierarchy,
fanned documents, and a hub/edge topology. All rendered geometry is original semantic HTML with
Tailwind utilities, Lucide icons, and the repository's maintained GOL mark.

## Key decisions

- Kept the page server-rendered except for one small `MandateGateDemo` client island. Its two
  outcomes are immutable local presentation records, not a browser policy evaluator.
- Used shadcn `Button` controls and added one server-safe disclosure primitive. With JavaScript
  disabled, the default refusal remains complete and the sample controls remain disabled.
- Used CSS transform/opacity motion only. Animations are bounded, do not loop, do not move focus,
  and resolve essentially instantly under `prefers-reduced-motion: reduce`.
- Consolidated repeated qualifiers into one hero disclosure, one category-level design-target
  label, and one compact status ledger. The full prototype and not-established inventories remain
  available in a keyboard-operable native disclosure.
- Left `/app`, all APIs, wallet/signing code, contracts, and product runtime configuration
  untouched. Landing imports contain no server, wallet, agent, Privy, RPC, telemetry, or environment
  dependencies, and browser interaction makes no API or cross-origin request.
- Left canonical, Open Graph, robots, and sitemap origin handling unchanged. The checked-in
  `publicOrigin` remains `https://gol.network`, backed by the dated repository evidence already
  documented in `spec/landing-page-final-verification.md`; it is not coupled to product runtime
  config or `NEXT_PUBLIC_*` values.

## PRD traceability

| PRD concern | Implemented expression | Verification |
| --- | --- | --- |
| §1 account and bounded agent | Short hero promise plus owner/agent/account-policy explanation | H1/copy assertions |
| §2 enforcement location | Prompt, framework and server rails break; account-policy rail reaches execution | Four exact labels and outcomes |
| §4 roles and lanes | Separate owner-signed fail-open and scoped fail-closed agent lanes | Content and visual checks |
| §6/§8.1 mandate | Amount, destination, execution and lifecycle bento | All four groups and every control term asserted |
| §8.3 refusal record | `$101`, `$100`, `PER_TX_CAP`, and recorded headroom in the hero and front receipt | Default/no-JS plus interaction tests |
| §8.3a outcome verification | Promised, Actual and Refused ordered record sheets with all illustrative fields | Render/content tests |
| §8.4/§10 adapters and venue boundary | Account → adapters → generic endpoint categories; exact `GOL is not the venue.` | No logos, partners, rates, balances or live-routing claims |
| §8.5 market breadth | Eight generic endpoint categories, labeled once as design targets | Eight-category unit assertion |
| §8.6 growth boundary | Read-trace/cannot-write-mandate statement beside the bento | Exact content assertion |
| §9 winning demo | Keyboard-replayable `$100` allowed and `$101` refused fixed examples | Playwright behavior and no-network test |
| §11 signer/account authority | Exact signer-may-refuse/account-may-permit statement | Content assertion |
| §13/§13.5 current truth | Visible Arc scope, broader unshipped state, full disclosure, pending KMS acceptance | Default/no-JS and unit checks |
| §17 claim risk | No production, partner, venue, token, performance or audit overclaim | Banned-claim tests and source review |
| §18 door | Every primary action says Arc testnet prototype and routes to isolated `/app` | Link and route-isolation test |

## Measured acceptance

Measurements used Chromium with the same DOM method as the v1 baseline and the final full-page
captures:

| Metric | v1 baseline | v2 result | Target | Result |
| --- | ---: | ---: | ---: | --- |
| Visible body words | 891 | 465 desktop / 461 mobile | ≤500 | Pass |
| Meaningful visual primitives | 2 | 10 | ≥6 | Pass |
| Words per visual proxy | 445.5 | 46.5 desktop / 46.1 mobile | ≤84 | Pass |
| Large rounded surfaces | 27 baseline card proxy | 13 | ≤16 | Pass |
| Desktop length, 1440×900 | 7.79 viewports | 4.28 (3,854 px) | ≤6.5 | Pass |
| Mobile length, 390×844 | 14.47 viewports | 8.36 (7,054 px) | ≤9 | Pass |
| Main narrative sections | 7 | 6 | ≤7 | Pass |
| Horizontal overflow | none | none at 320/390/768/1024/1440 | none | Pass |

The landing-only client entry is one route chunk totaling 18,516 raw bytes and 6,861 bytes at gzip
level 9. A second 29,837-byte raw / 9,660-byte gzip Lucide and Link chunk is also used by `/app`, so
it is shared rather than landing-specific. Even the conservative non-Next route sum is 48,353 raw /
16,521 gzip bytes and meets the plan's sub-20 kB stretch goal. `/` remains statically prerendered and
initiates no API or cross-origin request.

## Accessibility and interaction

- One H1 with monotonic section headings and semantic `section`, `figure`, `ol`, `dl`, `article`,
  `fieldset`, and native disclosure structure.
- Skip link focuses `#main-content`; header anchors resolve to real IDs; sample choices, replay,
  disclosures and CTAs are keyboard operable with visible focus.
- All visible mobile controls/links tested at a minimum 44 px height.
- The result is not conveyed by color alone. Allowed/refused text, rule, limit, requested amount and
  headroom remain selectable text.
- No-JS output contains the complete default refusal, venue boundary, product status, and prototype
  CTA. Sample controls are server-rendered disabled until hydration.
- Reduced motion collapses all marked animation and transition durations to at most 0.01 ms while
  retaining the final state.

## Files changed

- `web/app/globals.css`: named causal-motion keyframes and the existing global reduced-motion
  fallback.
- `web/src/content/landing.ts`: concise claim-safe copy, fixed samples, boundary statements, and
  retained capability/status inventories.
- `web/src/components/landing/landing-page.tsx`, `landing-hero.tsx`,
  `mandate-gate-demo.tsx`, `enforcement-layers.tsx`, `policy-gate.tsx`, `receipt-model.tsx`,
  `market-vision.tsx`, `product-status.tsx`, `landing-footer.tsx`, and
  `landing-primitives.tsx`: six-beat public composition. The former standalone
  `mandate-controls.tsx` was folded into the bento and removed.
- `web/src/components/ui/disclosure.tsx`: reusable server-safe disclosure primitive.
- `web/tests/landing-content.test.ts`, `web/tests/e2e/landing.spec.ts`,
  `web/tests/e2e/landing-capture.spec.ts`, and `web/tests/e2e/capture.spec.ts`: content/trust,
  interaction, no-JS, motion, responsive, performance-proxy, route-isolation and evidence checks.
- `spec/landing-page-visual-redesign-implementation-report.md`: this report.

## Visual review evidence

Captured from the production Playwright server and then inspected at original resolution. Orca's
embedded browser was also used to inspect the live page, its accessibility snapshot, the causal
hero, and responsive content order.

| Capture | Dimensions | SHA-256 |
| --- | --- | --- |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-light.png` | 1440×3854 | `5cecdf7567a375e0552c0cca657344a889faad6bad7b06000d83c0d6ffadd064` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-dark.png` | 1440×3854 | `016394a3a3fabae1181aebde898263396d8535796a324b1d22aa1f0219a24419` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/tablet-light.png` | 768×5843 | `b395a57a1698e6ba81c478db0b6e3082f284c180832ba37972b6701eca352f3b` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/mobile-light.png` | 390×7054 | `a0c84112ca81350e58bb2638e41ae11121e7e7b0f6873f1737b2d522e55bd9e5` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/mobile-dark.png` | 390×7054 | `64158bdd916e83c77f9a057ca0689e08efeaf63a7805c24149cf676c38aef787` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-checking.png` | 1440×900 | `4e0789fde4cca6ac17424eeed18718c83aba9a7827d6e696489cbbbe8302fae2` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-allowed.png` | 1440×900 | `4c8d2c1e4bd728e727e3bb8a108bcf2a497381add6d8af44e75aa8286295e731` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/mobile-reduced-allowed-focus.png` | 390×844 | `f5a3354b69054e9f52f34d9f1db6d7622fe5a15b3ab2078ae9f75c5cabe14694` |

The review confirmed the `$100/$101` consequence within the required early mobile range, clean
single-column transformation, readable receipt values, visible network ordering, distinct light
and dark contrast, and no clipped horizontal content. The desktop amount boundary deliberately
uses open space to make the dominant owner-set ceiling visually outweigh the three secondary
control cells.

## Commands and results

- `pnpm --filter @gol/web typecheck` — pass.
- `pnpm --filter @gol/web test` — pass, 10 files and 63 tests.
- `pnpm --filter @gol/web build` — pass; 20 routes generated and `/` reported static.
- `pnpm --filter @gol/web exec playwright test tests/e2e/landing.spec.ts` — pass, 12/12.
- `pnpm --filter @gol/web test:e2e` — pass, 25 passed and 2 opt-in capture tests skipped.
- `GOL_LANDING_CAPTURE=1 GOL_LANDING_CAPTURE_DIR=... pnpm --filter @gol/web exec playwright test tests/e2e/landing-capture.spec.ts` — pass, eight captures.
- `pnpm format:check` — pass.
- `git diff --check` — pass.
- Secret/runtime-import scan across landing source/tests — no matches.

An initial `corepack pnpm --filter @gol/web build` attempt failed before compilation because the
machine's Corepack shim exposed pnpm 11.15.1 while the repository requires 11.17.0. Direct `pnpm`
resolved to the repository-selected 11.17.0 and every reported build/test result above uses that
correct version.

## Deviations and remaining risks

- The plan allowed Tabs or Buttons; the implementation uses existing shadcn Buttons because two
  fixed monetary examples read more directly as independent sample requests.
- The optional initial auto-run was omitted. The honest refused end state is in server HTML, while
  motion occurs only after an explicit replay and never competes with first reading.
- Receipt sheets use restrained offsets/rotation rather than sticky stacking or overlap that could
  obscure text at zoom. This preserves the layered-ledger metaphor with lower accessibility cost.
- Browser automation cannot substitute for manual assistive-technology review on each target OS.
- The broader GOL model is still unshipped, production readiness and independent security audit are
  not established, and mandatory real-user KMS-backed signer acceptance remains pending.
- This report proves local implementation and verification only. No deployment or commit was made.
