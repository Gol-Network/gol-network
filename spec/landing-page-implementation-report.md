# GOL landing page implementation report

Date: 11 September 2026
Status: implemented and validated locally; not deployed

## Outcome

The public `/` route is now a static, config-independent landing page for the proposed GOL account
model. The existing Arc testnet product is available at `/app`, where its server-read runtime
configuration, Privy provider, owner/agent authority separation, and existing transaction behavior
remain isolated. The landing makes the narrower current prototype and the broader design target
explicit, including the exact PRD headline, refusal lead, on-chain enforcement model, mandate
controls, promised/actual/refused receipt model, market-adapter vision, and current-status section.

No contract, protocol, agent, API, signer, journal, deployment, or database behavior changed. No
third-party archive code or assets were copied; extracted references were used only as visual and
interaction-pattern evidence because the inventory records no verified license metadata.

## Implementation decisions

- Kept the root layout server-static and moved `publicConfigResult`, `Providers`, `TabNav`, and
  `GolApp` to the `/app` route. This prevents missing Privy or chain configuration from hiding the
  landing page and keeps credentials and runtime-only configuration out of the marketing surface.
- Built the page from small server components, typed local content, Tailwind v4 semantic tokens,
  shadcn `Button`/`Card`, and Lucide icons. The page has no client component, wallet call, API call,
  analytics call, or third-party runtime asset request.
- Used restrained CSS-only entrance motion for the hero and static hierarchy elsewhere. The global
  reduced-motion rule removes that motion and shortens existing transitions, while anchor scrolling
  remains native.
- Preserved direct, keyboard-visible navigation with a skip link, semantic headings/sections,
  descriptive labels, and a text-complete policy path whose DOM order matches the trust boundary.
- Replaced the remote Google Fonts stylesheet with `next/font` self-hosting for DM Sans and
  JetBrains Mono, and recorded both OFL licenses in `THIRD_PARTY_NOTICES.md`.
- Added canonical metadata, Open Graph/Twitter metadata, a code-generated social image, robots rules,
  and a sitemap. Marketing language says “proposed,” “design target,” and “prototype”; it does not
  claim deployment, production readiness, partners, traction, or completed real-user acceptance.
- Updated product E2E routes and back-links to use `/app`, while leaving demo and tool routes
  otherwise unchanged.

## Deviations from the plan and PRD

- The plan proposed an IntersectionObserver reveal helper. The final implementation uses one
  CSS-only, above-the-fold entrance instead, eliminating landing JavaScript and avoiding hidden
  below-the-fold content or observer timing in assistive technology and tests.
- The plan allowed architecture and external ecosystem links when confirmed. No public repository
  destination or endorsed venue links were established, so the page keeps only internal policy,
  receipt, market, status, tools, and prototype links.
- The PRD describes the complete future product. Capabilities beyond the checked-in Arc payment
  prototype are presented as design targets, not as operational features; no waitlist, partner,
  compliance, award, volume, launch-date, or “best route” claims were added.
- The Open Graph image uses the same code-native visual language rather than an archive image or the
  older hackathon cover, avoiding ambiguous provenance and stale positioning.

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @gol/web typecheck` | Passed |
| `pnpm --filter @gol/web test` | Passed: 10 files, 59 tests |
| `pnpm --filter @gol/web build` | Passed; `/` static, `/app` dynamic, metadata routes generated |
| Targeted landing Playwright suite | Passed: 7 tests |
| Targeted tokenized-stocks Playwright suite | Passed: 2 tests |
| `pnpm --filter @gol/web test:e2e` | Passed: 20 tests, 1 intentionally skipped capture test |
| Desktop visual review at 1440 × 900 | Passed |
| Mobile visual review at 390 × 844 | Passed |
| Responsive overflow tests | Passed at 320, 390, 768, and 1440 px widths |
| Reduced-motion Playwright assertion | Passed |

The focused content test also verifies the exact headline and refusal copy, design-target labels,
absence of prohibited shipping claims, and the static root import boundary. Full E2E coverage
re-runs the existing owner-action, agent, wallet, tools, mobile product, and tokenized-stock flows
after the route move.

## Remaining risks

- `https://gol.network` metadata and social previews should be rechecked in the actual release
  environment; this implementation does not claim that the new page is deployed.
- A human accessibility pass with VoiceOver and a release Lighthouse trace remain advisable even
  though semantic, keyboard, responsive, reduced-motion, build, and automated browser checks pass.
- The real-user browser acceptance item for the KMS-backed agent signer remains pending in the dated
  deployment evidence and is deliberately not implied by landing-page copy.
- If product naming, canonical domain, or supported-prototype scope changes before release, metadata
  and the current-status section must be reviewed together.
