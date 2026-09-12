# GOL landing page visual redesign final verification

**Reviewed:** 11 September 2026, Asia/Ho_Chi_Minh
**Scope:** current uncommitted public `/` redesign
**Verdict:** visually ready for implementation review; not deployed and not committed

## Executive result

The redesign passes the frozen **Consequence Line** strategy and the relevant PRD requirements. It
no longer reads as a wall of text: the final desktop has 465 visible words, 47 paragraphs, 10
meaningful visual primitives, 13 repeated-surface proxies, and 4.28 viewport lengths. The final
390 px mobile layout has 461 words, the same 10 visuals, no horizontal overflow, and 8.36 viewport
lengths. Six different beats now carry the explanation through a request gate, enforcement rail,
asymmetric mandate controls, outcome-record stack, adapter topology, and compact status ledger.

This review corrected an ambiguous in-flight result, repeated status qualifiers, the status heading,
mobile/footer repetition, reduced-motion interaction timing, two light-theme contrast tokens, title
punctuation, and client-island icon ownership. It also extended tests to 640 px reflow and forced
colors. All final type, unit, production-build, focused-browser, full-browser, formatting, diff,
secret, import, bundle, metadata, and network checks pass.

## Before and after density

The baseline is the machine-audited v1 page in
`/Users/nathan/Downloads/Gol Network Login Flow/ref-landing-for-gol/research-v2/baseline.json` and
the four baseline screenshots in
`/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/`. The final values use the
same rendered-DOM proxies in Chromium and the regenerated production captures.

| Measure | Before | Final | Change | Assessment |
| --- | ---: | ---: | ---: | --- |
| Visible words | 891 | 465 desktop / 461 mobile | -47.8% / -48.3% | Below the 500-word target |
| Visible paragraphs | 64 | 47 | -26.6% | Short labels and values replace explanatory prose |
| Rounded-card repetition proxy | 27 | 13 | -51.9% | Below the 16-surface target |
| Main sections | 7 | 6 | -14.3% | One coherent six-beat narrative |
| Meaningful visual primitives | 2 | 10 | +400% | Every core claim has visual proof |
| Words per visual | 445.5 | 46.5 desktop / 46.1 mobile | about -89.6% | Visual-to-text balance is reversed |
| Desktop full-page height, 1440 x 900 | 7,010 px / 7.79 viewports | 3,854 px / 4.28 | -45.0% | Strong alternating rhythm |
| Mobile full-page height, 390 x 844 | 12,211 px / 14.47 viewports | 7,054 px / 8.36 | -42.2% | Within the 9-viewport target |
| `prototype` occurrences | 10 | 2 | -80% | Used at the current-product doors only |
| `design target` occurrences | 5 | 3 | -40% | Applied at group boundaries rather than every item |

At 1440 x 900, meaningful visuals intersect viewport bands 0 through 3 at counts 2, 5, 5, and 2.
At 390 x 844, they are distributed 1, 2, 2, 5, 3, 1, 1, and 1 across bands 0 through 7. The footer
can occupy a trailing partial band without another diagram. This keeps visual evidence present
through the narrative instead of front-loading one decorative hero.

The final responsive measurements are:

| Viewport | Words | Paragraphs | Visuals | Surfaces | Page height | Viewports | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1440 x 900 | 465 | 47 | 10 | 13 | 3,854 px | 4.28 | None |
| 768 x 1024 | 461 | 47 | 10 | 13 | 5,843 px | 5.71 | None |
| 390 x 844 | 461 | 47 | 10 | 13 | 7,054 px | 8.36 | None |
| 320 x 800 | 461 | 47 | 10 | 13 | 7,369 px | 9.21 | None |

The 320 px value is not compared with the plan's 390 px maximum-height gate; it is the narrower
overflow and readable-label stress case. Reflow at 640 px provides the practical 200% zoom proxy.

## Visual and interaction audit

| Beat | Visual identity and proof | Final audit |
| --- | --- | --- |
| Hero and mandate gate | Large typographic interruption beside a request to account-policy consequence line | Distinct first-screen composition; fixed `$100` and `$101` controls are keyboard operable; pending, allowed, and refused states are unambiguous |
| Enforcement rail | Full-width inverse strip in which prompt, framework, and server stop before the account check | Does not repeat the hero card shape; exact resilience claim remains textually available |
| Mandate controls | Asymmetric bento with one dominant amount boundary and three compact control families | Mobile becomes a clean ordered stack; owner and agent lanes remain explicit |
| Outcome records | Offset Promised, Actual, and Refused documents with definition lists | Depth does not hide values at mobile or zoom; refusal remains visible without color |
| Adapter topology | Account to bounded adapters to generic endpoint categories | Diagram communicates expansion while the exact venue boundary remains beside it |
| Status and exit | Inverse two-column ledger and large three-line exit statement | Current Arc scope and broader design target are visibly separated; detailed caveats stay in native disclosure |

The only client component is `MandateGateDemo`. It performs an immutable lookup over two local
illustrative records and makes no policy decision, wallet call, storage write, API request, RPC call,
or cross-origin request. Lucide elements are constructed by the server parent and passed as
rendered slots, leaving the island responsible only for selection, replay timing, focus-safe state,
and its polite result announcement.

The normal-motion pending state now reads `Checking mandate…` with `Fixed illustrative lookup`;
it no longer displays the previous refusal while evaluating the `$100` sample. Under
`prefers-reduced-motion: reduce`, the fixed timer resolves with zero delay and all marked animation
and transition durations compute to no more than 0.01 ms. The server-rendered no-JavaScript state
contains the complete refusal and disables the sample controls rather than presenting broken
interaction.

Keyboard inspection confirmed skip navigation, real anchor targets, native disclosure, amount
selection, replay, and all CTAs. Mobile targets are at least 44 px tall. Forced-colors testing keeps
the headline, result, focus, selection, and allowed outcome available. A computed contrast audit of
124 to 125 text runs per sampled light/dark state found zero WCAG failures after changing light muted text to
`#646d7a` and success text to `#087e5a`; the lowest observed normal-text ratios were 4.54:1 in light
and 4.60:1 in dark.

## PRD traceability

This checklist covers each PRD concern that belongs on a public landing page. Detailed architecture,
competitive research, version sequencing, and open-question inventories remain in the PRD and
technical specs instead of being turned into unsupported marketing copy.

| PRD source | Required truth | Final expression | Verdict |
| --- | --- | --- | --- |
| §1 | One account with owner-set boundaries and an agent inside them | Seven-word hero, account-policy gate, owner/agent explanation | Pass |
| §2 | Prompt, framework, and server are not final enforcement | Failure rail ends at the account-policy check | Pass |
| §3.4, §11 | Account/mandate enforcement is mandatory and owner control is preserved | Mandate bento plus explicit lanes and authority sentence | Pass |
| §3.5 | The thesis is broader than today's shipped product | Visible hero disclosure and status ledger | Pass |
| §4 | Owner, agent, and venue are different roles | Owner/agent lanes and separate endpoint topology | Pass |
| §4a, §6, §8.1 | Account and mandate are the shared substrate | Boundary persists through the six-beat page; amount, destination, execution, and lifecycle controls appear | Pass |
| §8.2 | Agent authority is scoped and unavailable checks fail closed | Agent lane says scoped, checked, fail-closed; owner lane is distinct | Pass |
| §8.3 | Lead with the refusal record, including reason and headroom | Default `$101` request produces `PER_TX_CAP` and `$100` headroom in hero and record stack | Pass |
| §8.3a | Promised, actual, and refused outcomes are designed together | Three semantic record sheets expose the illustrative verification fields | Pass |
| §8.4 | Planner/routing is not final authority and GOL is not a venue | Gate-first adapter topology and exact venue sentence | Pass |
| §8.5 | Show market breadth without implying live support | Eight generic endpoint categories under one design-target label | Pass |
| §8.6 | Growth may read evidence but may not write mandates | Exact read-trace/no-write-mandate statement | Pass |
| §8.7 | Owners approve understandable outcomes, not opaque transaction sequences | Concise outcome-record caption | Pass |
| §9 | The winning example is a `$100` limit and `$101` refusal independent of server control | Fixed, replayable hero gate plus enforcement-invariant strip | Pass |
| §10 | Licensed/regulated providers occupy adapter slots; GOL does not claim their role | Generic adapters only, with no provider logos or partner claims | Pass |
| §11, §11a | A signer may refuse; only account policy may permit an agent payment | Exact authority statement retained | Pass |
| §11b, §12 | Rent execution edges; do not become venue or custodian | Account-to-adapter topology and boundary sentence | Pass |
| §13, §13.5 | Separate current Arc behavior, broader design, and pending evidence | Current/design columns plus pending real-user KMS acceptance line | Pass |
| §14 | Venues and aggregators are edges, not the product | Generic topology; no named competitive or partnership claim | Pass |
| §16, §17 | Do not imply universal support, audit, production readiness, or certainty | Banned-claim tests and compact status disclosure | Pass |
| §18 | Provide an honest door to the current experience | Primary links identify the Arc testnet prototype and resolve to isolated `/app` | Pass |
| §19, §20 | Preserve the concise model while distinguishing blueprint from evidence | Six-beat summary and proposed/current labels | Pass |

The page deliberately omits PRD version-ladder detail, the seven-layer taxonomy as prose,
competitive matrices, team history, and detailed open questions. Those omissions reduce density
without removing product truth.

## Trust, metadata, and provenance

### Route and runtime boundary

`/` remains statically prerendered. Landing source imports no `@/server`, `@/client`, `@/wallet`,
Privy, viem, `@gol/agent`, `@gol/protocol`, Three.js, React Three Fiber, or Motion dependency. Only
one source file contains `use client`. A clean production navigation observed 17 successful local
responses, zero remote origins, zero `/api/` requests, and zero failed responses. Four local fetches
were Next RSC prefetches for `/` and `/app`, not product-runtime calls.

### Public-origin decision

The canonical origin remains the checked-in constant `https://gol.network`. This is justified by
the repository's dated operational source of truth, `spec/deployment-status.md`, last reviewed
10 September 2026, which explicitly records the live public application at that HTTPS origin.
`README.md` and `deploy/README.md` independently name the same public origin.

Canonical, `og:url`, Open Graph image, Twitter image, robots Host/Sitemap, and sitemap locations all
resolve through `web/src/content/site.ts`; none of the metadata modules embeds the string directly.
The constant is public metadata-only configuration and does not import or expose product runtime
configuration. This resolves the earlier plan/report mismatch: dated repository evidence satisfies
the plan's confirmation gate, so removing the origin or coupling it to product server configuration
would be less accurate. Production output was checked directly and returned the expected canonical,
social, robots, and sitemap URLs.

### Originality and licensing

No downloaded archive or 21st.dev code, asset, SVG geometry, stylesheet, font, or dependency is in
the landing implementation. A machine comparison of material trimmed lines at least 40 characters
long found zero exact matches between landing source and all 10 locally shortlisted sources. Their
recorded SHA-256 values still match the audit. No package manifest or lockfile changed for the
redesign, no remote asset is imported, and the only brand image is the repository's existing
`web/public/gol-mark-blue.svg`.

The pattern-level local inspirations used are recorded exactly in
`research-v2/local-shortlist.json`:

| Pattern | Provenance | Source and SHA-256 | Use |
| --- | --- | --- | --- |
| Scroll-powered SVG stroke | channel `1048241543477215275`, message `1447082987219976333`, attachment `1447082986943025162` | `codegrid-scroll-powered-svg-stroke-nextjs/src/app/page.js`, `6aadd25666f93ebe2de92b6bc97a61eb7d7d04a6cb8b00576fc2d866b78ed80e` | Original causal line only; no path/code copied |
| MissionStack | channel `1112149715237228635`, message `1543398527626125334`, attachment `1543398527277858866` | `CGMWTAUGUST2026/oreana/src/components/MissionStack/MissionStack.jsx`, `cffec4ee694d5df7f474dab0977f999f27f62c5547278cbea7840b95885d463a` | Semantic receipt depth only; no GSAP or hidden mobile proof |
| MissionFeatures | same channel/message/attachment as MissionStack | `CGMWTAUGUST2026/oreana/src/components/MissionFeatures/MissionFeatures.jsx`, `d0c05dfd039c044f11419e544e71fd5738fe1a42b6b119c953191b568bda4824` | Unequal control hierarchy only |
| FeaturedCards | channel `1112149715237228635`, message `1487358199756750868`, attachment `1487358199416750161` | `CGMWTMARCH2026/house-of-epochs/src/components/FeaturedCards/FeaturedCards.jsx`, `3cb20f725ec6321315161f8894bbffd2ab2518b22b606f8a7d6d454d06c4bc03` | Grouped content rhythm only |
| Salle Blanche CTA | channel `1112149715237228635`, message `1475942672123302100`, attachment `1475942671691415634` | `CGMWTFEB2026/salle-blanche/src/components/CTA/CTA.jsx`, `08de51b460c93c9046bb95572fb6072cfea4356e68eaf746330695ac79cc88e7` | Large exit cadence only |
| Orbit Matter Observatory | channel `1112149715237228635`, message `1443863279280721981`, attachment `1443863279054094456` | `CGMWTNOV2025/orbit-matter/observatory.html`, `8a583a8cff22cdee67e65f6fd75180467afccc7624ca2b12683ec1675e771c14` | Hub/edge idea only; orbit spectacle rejected |

21st.dev influenced generic composition only. The closest reviewed patterns were
[Animated Beam](https://21st.dev/@dillionverma/components/animated-beam),
[Agent Trace](https://21st.dev/@n1m4mz/components/agent-trace),
[Feature Bento](https://21st.dev/@uilayout.contact/components/feature-bento),
[Cards Stack](https://21st.dev/@youcefbnm/components/cards-stack),
[Scroll Reveal Content A](https://21st.dev/@abui/components/scroll-reveal-content-a),
[Integration Showcase](https://21st.dev/@ravikatiyar162/components/integration-showcase),
[Animated Card Diagram](https://21st.dev/@badtzx0/components/animated-card-diagram),
[Incident Status Timeline](https://21st.dev/@cnippet-dev/components/incident-status-timeline), and
[Audit Log](https://21st.dev/@corr/components/audit-log). Some Info panels reported MIT and some
showed no license field. No source or asset was copied from either group, so unclear licensing did
not enter the product.

## Performance and SEO

The final production build reports `/` as static. The only landing-specific client entry is
`2gkezmnla1jsd.js` at 18,516 raw bytes and 6,861 bytes at gzip level 9. The 29,837 raw / 9,660 gzip
Lucide and Link chunk is shared with `/app`; including it gives a conservative non-Next route sum of
48,353 raw / 16,521 gzip bytes, still below the plan's 20 KiB stretch budget. The 14,443-byte raw /
3,709-byte gzip Next runtime is excluded from that route-specific comparison.

No video, canvas, WebGL, remote image, large raster, scroll listener, observer, or animation library
was added. CSS animations are bounded transform/opacity effects, and static end states remain the
source of meaning. Lighthouse is not installed in this repository and was not added during review;
the production build, bundle manifest, local-only response audit, full screenshots, and DOM/layout
budgets are the non-invasive performance evidence.

SEO output includes one descriptive H1, six semantic regions, relative page canonical metadata,
route-specific social copy, generated OG/Twitter images, robots exclusions for APIs and non-public
demo routes, and a three-route sitemap. The built page title is
`Gol | On-chain limits for AI agents`; its description avoids claims beyond the page evidence.

## Visual evidence

All captures came from the production Playwright server after the final corrections and were
inspected. Orca's embedded browser independently verified the desktop and emulated 390 x 844 mobile
accessibility trees, full-page rhythm, default result, live pending-to-allowed transition, dark
class behavior, focus, and absence of horizontal overflow.

| Evidence | Dimensions | SHA-256 |
| --- | --- | --- |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-light.png` | 1440 x 3854 | `5cecdf7567a375e0552c0cca657344a889faad6bad7b06000d83c0d6ffadd064` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-dark.png` | 1440 x 3854 | `016394a3a3fabae1181aebde898263396d8535796a324b1d22aa1f0219a24419` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/tablet-light.png` | 768 x 5843 | `b395a57a1698e6ba81c478db0b6e3082f284c180832ba37972b6701eca352f3b` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/mobile-light.png` | 390 x 7054 | `a0c84112ca81350e58bb2638e41ae11121e7e7b0f6873f1737b2d522e55bd9e5` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/mobile-dark.png` | 390 x 7054 | `64158bdd916e83c77f9a057ca0689e08efeaf63a7805c24149cf676c38aef787` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-checking.png` | 1440 x 900 | `4e0789fde4cca6ac17424eeed18718c83aba9a7827d6e696489cbbbe8302fae2` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/desktop-allowed.png` | 1440 x 900 | `4c8d2c1e4bd728e727e3bb8a108bcf2a497381add6d8af44e75aa8286295e731` |
| `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-final-2026-09-11/mobile-reduced-allowed-focus.png` | 390 x 844 | `f5a3354b69054e9f52f34d9f1db6d7622fe5a15b3ab2078ae9f75c5cabe14694` |

## Commands and results

Environment: Node `v22.23.1`, pnpm `11.17.0`.

| Command or check | Result |
| --- | --- |
| `pnpm --filter @gol/web typecheck` | Pass |
| `pnpm --filter @gol/web test` | Pass: 10 files, 63 tests |
| `pnpm --filter @gol/web build` | Pass: 20 routes; `/` static |
| `pnpm --filter @gol/web exec playwright test tests/e2e/landing.spec.ts` | Pass: 12/12 |
| `pnpm --filter @gol/web test:e2e` | Pass: 25 passed, 2 opt-in captures skipped |
| Opt-in final landing capture | Pass: 1 capture test, 8 images |
| 320/390/640/768/1024/1440 layout matrix | Pass: no horizontal overflow; key content has non-zero boxes |
| No-JS, reduced motion, forced colors, touch size, anchors, focus, disclosure | Pass |
| Playwright computed light/dark contrast audit | Pass: zero failures among 124 to 125 text runs per settled theme/state |
| Production response-origin/API audit | Pass: 17 local 200 responses, zero remote, zero API, zero failures |
| Metadata, robots, and sitemap `curl` inspection | Pass; all use the confirmed origin |
| Client-reference manifest and gzip size audit | Pass: 6,861-byte landing-only gzip entry |
| Landing runtime/import scan | Pass: one client island; no protected runtime imports or network APIs |
| Material exact-line comparison against all 10 local shortlist sources | Pass: zero matches |
| `gitleaks dir` on app, landing components/content, tests, and specs | Pass: no leaks found |
| `pnpm format:check` | Pass after formatting one corrected component |
| `git diff --check` | Pass |

## Corrective files in this review

- `web/app/globals.css`
- `web/app/layout.tsx`
- `web/app/page.tsx`
- `web/src/content/landing.ts`
- `web/src/components/landing/landing-header.tsx`
- `web/src/components/landing/landing-footer.tsx`
- `web/src/components/landing/landing-hero.tsx`
- `web/src/components/landing/mandate-gate-demo.tsx`
- `web/src/components/landing/policy-gate.tsx`
- `web/src/components/landing/receipt-model.tsx`
- `web/src/components/landing/market-vision.tsx`
- `web/src/components/landing/product-status.tsx`
- `web/tests/landing-content.test.ts`
- `web/tests/e2e/landing.spec.ts`
- `web/tests/e2e/landing-capture.spec.ts`
- `spec/landing-page-visual-redesign-implementation-report.md`
- `spec/landing-page-visual-redesign-final-verification.md`
- the eight external evidence PNGs listed above

Unrelated pre-existing user/worker changes were preserved. No commit or deployment was performed.

## Remaining risks

- Automated semantics, contrast, keyboard, and forced-colors checks do not replace manual VoiceOver,
  NVDA, and other target assistive-technology sessions.
- Lighthouse was unavailable locally, so field performance and Core Web Vitals remain release-time
  observations rather than claims in this report.
- The broader multi-market/multi-chain GOL model remains a design target. Independent security audit,
  universal provider support, and production readiness are not established.
- Mandatory real-user browser acceptance under the current KMS-backed signer is still pending. The
  page says so and does not turn current deployment evidence into a claim that this acceptance ran.

Subject to those explicitly retained release gates, the public landing is visually ready for code
review and merge consideration. It is not represented here as deployed.
