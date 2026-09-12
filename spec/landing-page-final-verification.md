# GOL landing page final verification

Date: 11 September 2026
Scope: final review of the uncommitted landing-page implementation
Deployment status: not deployed by this review

## Verdict

**Ready for code review and release-candidate evaluation.** The landing implementation satisfies the
relevant PRD and implementation-plan requirements after the focused corrections below. It is **not**
evidence that the new landing is deployed, that the complete Gol product exists, or that the pending
real-user KMS-signer acceptance has passed.

## Corrections made during final review

1. Centralized the confirmed public origin in `web/src/content/site.ts` and made root metadata,
   canonical URLs, robots, sitemap, and route-specific Open Graph metadata consume that one constant.
   This removes drift without coupling the public landing to product runtime configuration.
2. Moved landing-specific Open Graph and Twitter copy out of the root layout. `/app` now has accurate
   prototype-specific social metadata instead of inheriting the broader proposed-product copy.
3. Added a dedicated Twitter image route that reuses the checked-in Open Graph composition, and
   visually verified both generated 1200 × 630 PNGs are identical and complete.
4. Added `noindex, nofollow` metadata to `/preview` and the explicitly mocked `/tokenized-stocks`
   route, consistent with the crawl exclusions already planned for those surfaces.
5. Added the two missing “not established” disclosures: production readiness/independent audit/
   universal venue support, and mandatory real-user browser acceptance under the KMS-backed signer.
6. Raised mobile header and footer link targets to at least 44 px and corrected light/dark semantic
   color tokens that fell below WCAG AA contrast for normal text.
7. Extended automated coverage for the origin boundary, route metadata, robots/sitemap output,
   Twitter image metadata, JavaScript-disabled rendering, absence of runtime/API requests, pending
   acceptance disclosure, and the mobile CTA target size.
8. Replaced an improvised Open Graph initial tile with a text wordmark. No third-party or unverified
   brand asset is embedded in the generated image.

## Public-origin decision

The checked-in public origin remains **`https://gol.network`**. This is not an inference from the
landing code:

- `spec/deployment-status.md`, last reviewed 10 September 2026, states that the application is served
  at that HTTPS origin and records the Cloudflare DNS-only A record and Caddy Let's Encrypt
  certificate.
- `deploy/README.md` names the same HTTPS origin as the selected production target.
- `README.md` links that origin as the live application.

That dated repository evidence satisfies the plan's “confirm before canonicalizing” gate. The value
is deliberately checked-in public metadata in `web/src/content/site.ts`; it is neither secret nor a
`NEXT_PUBLIC_*` build-time product setting. The landing stays statically renderable and does not call
`publicConfigResult`, read `process.env`, initialize Privy, or import server/wallet modules. The root
canonical and `og:url` resolve to the confirmed origin, robots advertises the same sitemap/host, and
all sitemap entries derive from the same constant. Release review should still reconfirm the domain,
but there is no unresolved plan/report mismatch.

## PRD and plan traceability

| Requirement | Verified treatment | Status |
| --- | --- | --- |
| Exact consumer-first headline | Exact PRD headline is the sole H1 | Pass |
| Refusal record leads | Refusal lead and $100/$101 ledger precede market breadth | Pass |
| Nothing shipped as complete Gol | Hero, status section, and closing qualifier say so explicitly | Pass |
| Current prototype separated from vision | “Prototype today” and “Design target” columns are adjacent and balanced | Pass |
| Chain/region neutrality | Arc appears only as the bounded current prototype; no region/programme/partner names | Pass |
| Four enforcement layers | Prompt, framework, server, and on-chain mandate are explained in order | Pass |
| Server-off invariant | PRD shutdown test is visibly labeled a product design invariant | Pass |
| Three roles | Owner, Agent, and Venue role cards are present | Pass |
| Two authority lanes | Owner fail-open/direct control and agent fail-closed/bounded request lane are explicit | Pass |
| Mandate check in the architecture | Literal check is third in DOM and visual order, between request and execution | Pass |
| Signer is not the permission boundary | Copy says a signer may refuse and only account policy may permit | Pass |
| Aggregator, never venue | Architecture and market copy explicitly preserve this boundary | Pass |
| Growth cannot instruct the agent | Policy note says growth may read the trace but never write the mandate | Pass |
| Mandate control dimensions | Amount, destination, execution, and lifecycle matrices cover planned controls | Pass |
| Promised/actual/refused receipts | Ordered, illustrative, design-target receipt group is present | Pass |
| Outcome-first consumer language | Understandable-outcome line appears with receipts and markets | Pass |
| Market breadth as adapters | Generic categories carry a group-level design-target qualifier; no venue claims/logos | Pass |
| Illustrative values cannot be mistaken for evidence | Sample and illustrative labels plus explicit non-transaction disclaimer | Pass |
| Current repository-backed capabilities | Arc setup/payment flow, owner/agent separation, contract check, journal/activity | Pass |
| Pending production evidence disclosed | KMS browser acceptance, production readiness, and independent audit are not established | Pass |
| No token/launch/competitive overclaim | Content deny-list and manual diff audit pass | Pass |
| No custody/licence/KYC claim | Landing does not offer or imply regulated services | Pass |
| No launch date | None rendered | Pass |
| CTA behavior | Internal links only: policy, receipts, markets, status, tools, and `/app` | Pass |
| Static public boundary | Meaningful HTML without JavaScript; no config, API, wallet, auth, or remote request | Pass |
| Responsive behavior | No horizontal overflow at 320, 390, 768, or 1440 px | Pass |
| Reduced motion | Hero renders in final state with no transform; transitions collapse under the media query | Pass |
| Accessibility structure | Skip link, landmarks, one H1, sequential section/card headings, text-complete diagrams | Pass |
| SEO/discovery | Confirmed canonical, route-scoped social metadata, robots, sitemap, OG and Twitter images | Pass |
| Reference licensing | No archive source or asset copied; only original code and licensed existing dependencies | Pass |

The landing intentionally uses a CSS-only above-the-fold reveal rather than the plan's proposed
IntersectionObserver. This is a beneficial documented deviation: it removes landing JavaScript,
keeps below-the-fold content visible without hydration, and makes reduced-motion behavior simpler.

## Security, provenance, and performance audit

- No API, contract, protocol, agent, database, journal, signer, or owner-wallet implementation was
  changed. `/app` retains server-side runtime validation and contains the Privy/product provider
  boundary; `/` contains presentation and immutable public content only.
- Targeted secret scanning found no secret in the diff. Repository-wide matches were limited to
  expected examples, placeholders, and a deterministic unit-test key.
- All new landing and metadata files are text source. No archive binary, image, font, video, copied
  application, or executable was added. The only font change uses Next's supported font bundling for
  DM Sans and JetBrains Mono, whose OFL provenance is recorded in `THIRD_PARTY_NOTICES.md`.
- The optimized build classifies `/`, robots, sitemap, Open Graph image, and Twitter image as static;
  `/app` remains dynamic. The landing has no client component and the browser test observed only
  same-origin requests with no `/api/` request.
- The final contrast spot checks pass WCAG AA for normal text: light muted-on-muted 4.55:1, light
  destructive-on-background 4.88:1, light destructive button 5.15:1, dark primary button 5.16:1,
  dark destructive button 6.92:1, and dark muted-on-muted 6.21:1.
- The feature-file audit found no native interactive controls, hand-coded SVG, gradient, arbitrary
  feature color, arbitrary radius/shadow, decorative middle-dot separator, or copied reference code.

## Commands and results

Environment: Node `v22.23.1`; pnpm `11.17.0`.

| Command/check | Result |
| --- | --- |
| `pnpm --filter @gol/web typecheck` | Pass |
| `pnpm --filter @gol/web test` | Pass: 10 files, 61 tests |
| `pnpm --filter @gol/web build` | Pass; 20 static/dynamic route outputs generated as expected |
| Focused `playwright test tests/e2e/landing.spec.ts` | Pass: 10 tests |
| `pnpm --filter @gol/web test:e2e` | Pass: 23 tests, 1 intentionally skipped capture test |
| `pnpm format:check` | Pass |
| `git diff --check` | Pass |
| Landing import/config/claim/style audits with `rg` | Pass |
| Ad hoc WCAG contrast assertions | Pass: all six reviewed pairs ≥ 4.5:1 |
| Orca embedded-browser semantic snapshot and console review | Pass: complete landmarks/headings; no console messages |
| Light/dark desktop and mobile visual review | Pass |
| Generated OG/Twitter PNG dimensions and checksum comparison | Pass: 1200 × 630; byte-identical |

Playwright's web-server wrapper prints the existing warning that `next start` is not the preferred
launcher for `output: standalone`; the configured test server nevertheless started and all tests
passed. This review did not change the deployment launcher.

## Visual evidence

External evidence directory:
`/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence`

| Artifact | SHA-256 |
| --- | --- |
| `landing-desktop-light.png` | `53a70395c96ac478a76eca28e8bbc41bb94881fb71d2661094f28b0d21b66393` |
| `landing-desktop-dark.png` | `9af238ccc9426ab5c15093a95a8aa0a6f6a25d6e7d819fbfe1ccb6fecb4b2b45` |
| `landing-mobile-light.png` | `c735dcfca196e3ea2ff820b32c1354ece990d1973571961a5d4ed124917eca62` |
| `landing-mobile-dark.png` | `005116eb6a2476e004c4cbb74456b1bbe90122c099dd05b9b9d0a2b6091602e8` |
| `landing-opengraph.png` | `814c5115fd0262e59f24cbc0e55c5a2ed8055170287959329b5d2fd3882b9e60` |
| `landing-twitter.png` | `814c5115fd0262e59f24cbc0e55c5a2ed8055170287959329b5d2fd3882b9e60` |

Desktop was reviewed at 1440 × 900 and mobile at 390 × 844 in light and dark themes with reduced
motion active. The layouts retain hierarchy, readable status qualifiers, linear mobile policy order,
unclipped calls to action, and no horizontal overflow.

## Corrective files changed in this review

- `web/app/app/page.tsx`
- `web/app/globals.css`
- `web/app/layout.tsx`
- `web/app/opengraph-image.tsx`
- `web/app/page.tsx`
- `web/app/preview/page.tsx`
- `web/app/robots.ts`
- `web/app/sitemap.ts`
- `web/app/tokenized-stocks/page.tsx`
- `web/app/twitter-image.tsx`
- `web/src/components/landing/landing-footer.tsx`
- `web/src/components/landing/landing-header.tsx`
- `web/src/content/landing.ts`
- `web/src/content/site.ts`
- `web/tests/e2e/landing.spec.ts`
- `web/tests/landing-content.test.ts`
- `spec/landing-page-final-verification.md`

## Unresolved release risks

- Human VoiceOver/Safari, Chromium screen-reader, forced-colors, and 200% browser-zoom passes remain
  recommended before public rollout; the automated semantic, keyboard, contrast, responsive, and
  reduced-motion checks are not substitutes for assistive-technology review.
- A release-candidate Lighthouse/Web Vitals run on representative mobile hardware remains needed for
  the plan's field-performance gates. Source and network review found no landing-specific client
  runtime or external request hazard.
- Reconfirm the public origin, product name, and social-card copy immediately before release. The
  current decision is supported by repository evidence dated 10 September 2026.
- Mandatory production browser acceptance under the KMS-backed signer remains pending. The landing
  discloses this and must not be used to claim successful production agent payments.
- Deployment, commit, merge, and production evidence updates are separate authorized actions and
  were not performed here.
