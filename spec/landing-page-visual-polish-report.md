# GOL landing page visual polish report

**Reviewed:** 11 September 2026, Asia/Ho_Chi_Minh
**Scope:** post-verification visual polish for the uncommitted public `/` redesign
**Verdict:** pass; no commit or deployment performed

## Outcome

This pass strengthens the existing **Consequence Line** art direction without adding copy,
dependencies, network activity, or another client component.

- Added a restrained coordinate grid and boundary glow behind the hero.
- Connected the request, account policy, and result with a state-driven consequence beam.
- Turned the amount bar into a visible limit instrument with a `$101` breach marker.
- Added semantic top-edge hierarchy and hover depth to the three outcome records.
- Added a dotted topology field and bounded-account pulse to the adapter diagram.
- Kept every effect decorative, CSS-only, pointer-transparent, and covered by the global
  `prefers-reduced-motion` fallback.

The first browser capture found that the mobile beam pseudo-element intercepted the check button.
The decorative layer now has `pointer-events: none`, and the mobile touch-target test performs the
full `$100` selection and check interaction to prevent recurrence.

## Files changed in this pass

- `web/app/globals.css`
- `web/src/components/landing/landing-hero.tsx`
- `web/src/components/landing/mandate-gate-demo.tsx`
- `web/src/components/landing/policy-gate.tsx`
- `web/src/components/landing/receipt-model.tsx`
- `web/src/components/landing/market-vision.tsx`
- `web/tests/e2e/landing.spec.ts`
- `spec/landing-page-visual-polish-report.md`

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @gol/web typecheck` | Pass |
| `pnpm --filter @gol/web test` | Pass: 10 files, 63 tests |
| Focused landing Playwright suite | Pass: 12/12, including mobile hit-testing |
| Opt-in production screenshot capture | Pass: 1/1, eight images |
| Production build used by Playwright | Pass; `/` remains statically rendered |
| `pnpm format:check` | Pass |
| `git diff --check` | Pass |

## Evidence

The current captures are under
`/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-polish-2026-09-11/`.

| Capture | SHA-256 |
| --- | --- |
| `desktop-light.png` | `0a6ee1c16e8f4fc795ce3afb5701aa43bff873f5133ea68e8cc0fa00138dd310` |
| `desktop-dark.png` | `e5e057008ebc4211438e06f2ac5bac1e0e299cffd4ca804e338dee8859eb22ef` |
| `tablet-light.png` | `713a19206e61aa60a0d7661c77fa0d10052aa944f4149af42d71f002c090078e` |
| `mobile-light.png` | `56f54aadcdaa97d7cc83c3045602b51ebe1b70b951728b727ba4e6c461542458` |
| `mobile-dark.png` | `8618b77d229d28dcaae02e33f5a72be080f0d3637ff39e6fd099b82b08b53fe7` |
| `desktop-checking.png` | `a2123172ad3cdc83e89ad431c9f8e3671a247b0bdb07e86adc93b8645f49086f` |
| `desktop-allowed.png` | `6fbdac68a084fe12962ba69449ef1fe5913e4099b9120f4901ef257e0b466f95` |
| `mobile-reduced-allowed-focus.png` | `691cb2ce59890bf41e630749ff612b91c82bbecc1cde21bfb57b9e05f70824b0` |

The desktop and mobile light captures were inspected at original resolution. The added effects
improve spatial hierarchy while preserving the established density, responsive layout, and trust
boundary claims.
