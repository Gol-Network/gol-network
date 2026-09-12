# GOL landing page implementation plan

Status: implemented locally, pending review
Prepared: 11 September 2026
Implementation status: completed locally on 11 September 2026; see
`spec/landing-page-implementation-report.md` for validation and deviations
Deployment status: this document makes no deployment claim

## 1. Purpose and decision

Build a public, consumer-first landing page at `/` that explains the proposed full GOL product
without presenting roadmap capabilities as shipped. Move the existing Arc testnet owner workflow to
`/app`, preserve its current trust boundaries, and make the landing page statically renderable without
Privy, chain, database, or agent configuration.

The page should lead with the refusal record, not with wallet infrastructure or chain parity:

> One account. Every market. An agent that can act inside limits you set, and a record of everything
> it was refused.

The supporting line is:

> Not just what happened. What was stopped.

The first status disclosure must appear in the hero viewport, before any broad market or agent claim:

> Gol is a proposed account model for bounded agents. An Arc testnet prototype exists, but the
> complete Gol product described here has not shipped.

This reconciles the PRD's requirement to say that nothing has shipped under the complete Gol vision
with the repository's documented Arc testnet prototype. It must not be shortened to “Gol is live,”
“production-ready,” or similar copy.

## 2. Inputs, workflow, and source precedence

The plan was derived from these sources, in descending order for this landing-page change:

1. Repository instructions: `AGENTS.md`, `web/AGENTS.md`, `web/src/AGENTS.md`, and
   `spec/AGENTS.md`.
2. Current code and tests under `web/app`, `web/src`, and `web/tests`.
3. Current architecture and operational truth in `ARCHITECTURE.md`,
   `spec/deployment-status.md`, `spec/hackathon-product-spec.md`, and
   `spec/implementation-plan.md`.
4. Product direction in the external `docs/Gol_Complete_PRD_v1.md`, version 2.0 dated
   8 September 2026.
5. Visual-pattern evidence in the external reference inventory and selected inert extracted sources.

When these disagree, current code defines current behavior, dated evidence defines what is verified,
and the PRD defines proposed direction. The PRD does not convert proposed behavior into current
behavior.

### Superpowers workflow availability

No installed or active local `superpowers` or `superpower` workflow was available. The commands
`command -v superpowers` and `command -v superpower` returned no executable, and no matching skill
was present in the active Codex/agent skill directories or this repository. An inactive marketplace
cache manifest exists at
`/Users/nathan/.codex/.tmp/plugins/plugins/superpowers/.codex-plugin/plugin.json` for version 6.3.0;
it is not an installed skill and was not invoked. The recorded Orca installation flow is `/plugins`,
search for `superpowers`, select it, and choose **Install Plugin**.

Because the workflow was unavailable, this plan uses the equivalent sequence: requirements
extraction, current-state audit, claim classification, reference-pattern triage, PRD-to-file
traceability, dependency-aware sequencing, and explicit validation/rollback criteria.

## 3. Pre-implementation state versus proposed state

| Concern | Current repository behavior | Proposed landing-page behavior |
| --- | --- | --- |
| `/` | Dynamically reads public runtime configuration and renders `GolApp` or `ConfigurationNotice`. | Static marketing page that reads no runtime configuration and makes no API call. |
| Authentication | The signed-out root shows `SignInGate`; successful authentication enters setup/dashboard. | Authentication remains in the product flow at `/app`; the landing CTA links there. |
| Root layout | `web/app/layout.tsx` forces dynamic rendering, gates all routes on config, wraps all routes in `Providers`, and renders `TabNav`. | Root layout owns document metadata/fonts only. Product providers and configuration gating move to the `/app` boundary. |
| Navigation | A product tab strip appears globally; its Arc tab links to `/`. | A marketing header appears only on `/`; product navigation uses `/app` for the Arc prototype. |
| Scope | The implemented product is an Arc testnet, fixed-token owner/agent payment prototype, plus separate demo/tool/mock routes. | The landing describes the larger chain-neutral GOL design, but labels it as a design target and separately discloses the narrower current prototype. |
| Authority | Owner transactions are signed in the browser; the worker alone holds agent signing access; `GolAccount` is the authoritative payment-policy boundary. | No authority moves. The landing contains no signer, wallet, bearer token, DB access, server action, or transaction action. |
| Evidence | Dated deployment evidence says the application is served, but mandatory real-user browser acceptance under the KMS agent signer remains pending. | The page says “Arc testnet prototype,” not “live payments” or “production-ready,” and does not imply that pending acceptance passed. |
| Styling | Tailwind v4 semantic tokens, DM Sans/JetBrains Mono loaded by a remote CSS import, shadcn controls, and a WebGL dither sign-in background. | Reuse semantic tokens and shadcn controls; remove runtime font CSS loading; do not place WebGL or decorative gradients on the landing page. |
| Motion | Product interactions use Framer Motion and Three.js where already implemented. | A tiny landing-only observer adds restrained CSS reveals; native scrolling remains untouched and reduced motion renders the final state immediately. |

The route move must not alter API routes, authentication validation, owner-key scoping, journal
semantics, signer custody, policy evaluation, or chain submission behavior.

## 4. Claim-state rules

Every substantive product claim belongs to one of these visible states:

- **Prototype today** — behavior present in the repository and supported by dated evidence. On this
  page, this is limited to the Arc testnet prototype, its owner-controlled mandate flow, and the
  current payment refusal/record model. Do not imply completion of the pending real-user acceptance.
- **Design target** — a PRD capability that the full GOL product intends to provide but which is not
  established as integrated. Markets, multi-chain operation, arbitrary agents, three-receipt outcome
  verification, recovery, and broad venue routing use this label.
- **Illustrative flow** — a static explanatory visualization, not fetched chain data and not proof of
  a transaction. Its accessible description must say so.
- **Verified evidence** — reserved for an exact dated artifact or explorer record that has been
  independently checked. Do not render this state in v1 unless the acceptance evidence is added and
  reviewed before implementation.

Keep the qualifiers adjacent to the claim. A footnote or footer disclaimer cannot repair an
unqualified hero, metric, market, or receipt claim.

## 5. Information architecture and approved content shape

### 5.1 Global header

- Left: existing GOL brand mark and text link to `/`.
- Center on desktop: in-page links to `#policy-gate`, `#receipts`, `#markets`, and `#status`.
- Right: shadcn `Button` rendered as a link, **Explore Arc testnet prototype**, to `/app`.
- Mobile: brand and CTA remain visible; omit the center links instead of adding a menu and client-side
  focus-management burden.
- Add a first-focus **Skip to content** link.

### 5.2 Hero: refusal is the product lead

- Eyebrow/status: the complete-product disclosure from section 1, visibly marked
  **Prototype + proposed vision**.
- H1: the PRD headline quoted in section 1.
- Supporting copy: “Not just what happened. What was stopped.” Follow with one short sentence:
  “The owner sets the mandate; an agent can ask, but the policy boundary decides where money moves.”
- Primary CTA: **Explore Arc testnet prototype** → `/app`.
- Secondary CTA: **See where enforcement lives** → `#policy-gate`.
- Right-side visual on large screens: an **Illustrative flow** ledger showing a $100 per-transaction
  limit, an agent request for $101, a refusal reason, and $100 remaining headroom. The visual is a
  read-only explanation; it has no wallet affordance, fake transaction hash, fake timestamp, or
  explorer link.
- On mobile, content precedes the ledger. Nothing essential is absolutely positioned or hidden.

The $100/$101 illustration follows the PRD concept. It is deliberately separate from the current
fixture acceptance path, which executes $40 and then demonstrates a cumulative-limit refusal with a
$70 request. Do not imply the illustration is a recording of that test.

### 5.3 Failure model: four possible enforcement layers

Explain in four concise rows why prompt rules, model output checks, and server checks can be bypassed
or turned off, while an on-chain mandate remains authoritative for agent payments. Use the PRD's
shutdown test as the closing line:

> Turn every Morca server off. Then try to exceed the limit. It still gets refused.

Present this as the design invariant, not as a new production test result. Avoid repeating the PRD's
Morse-code anecdote or citing a third-party security event until it is independently sourced.

### 5.4 Policy gate: one architecture, two lanes, three roles

Render an HTML/CSS architecture diagram and a linear text fallback:

1. Owner approves a mandate with a passkey or owner wallet.
2. Agent submits a request under scoped, short-lived, revocable authority.
3. **Mandate check** appears literally between the agent and the chain/execution edge.
4. Allowed execution proceeds through an adapter to a venue; GOL is never presented as the venue.
5. A human owner can still act directly through the owner lane.

Show role cards for Owner, Agent, and Venue. Owner is full-power and fail-open; agent is bounded and
fail-closed; venue supplies execution or liquidity. Do not imply that growth software, Morca, GOL, or
an adapter can override the owner's mandate.

### 5.5 Mandate controls

Use a compact control matrix—not an editable form—to show the intended dimensions: per transaction,
window, session, and lifetime caps; method, asset, chain, target, and recipient rules; slippage and
argument constraints; expiry, nonce, revocation, recovery, and gas policy. Mark the matrix
**Design target** because not every control exists in the current prototype.

Avoid tokenomics, custody, KYC, compliance-as-a-service, or licensing claims. Do not include regional,
local-programme, or partner names.

### 5.6 Three receipts and outcome verification

Use three side-by-side receipt cards on desktop and a semantic ordered list on mobile:

1. **Promised** — what the route predicted before execution.
2. **Actual** — balance changes and fees observed after execution.
3. **Refused** — attempted action, failed rule, and remaining headroom.

Label the group **Design target**. The current implementation has useful journal, chain receipt, and
refusal records, but the complete cross-market “promised versus actual” model is not established.
The visual may show field names from the PRD—goal, preferences, `mandate_ref`, promised outcome, plan,
actual outcome, recovery—but must use obvious sample values and an “Illustrative” label.

### 5.7 One account, every market

Present the breadth as adapter categories, not as integrations: trade, route, rebalance, pay,
borrow/lend, prediction, tokenized assets, and off-chain service/payment edges. Use one concise
consumer line: “You approve an understandable outcome, not an opaque sequence of transactions.”

Each category is tagged **Design target** unless a narrower current prototype fact is stated in the
status section. Do not show partner marks, venue logos, volume, coverage counts, or “best price”
claims. State that GOL is an aggregator/control plane and never the venue.

### 5.8 Current status: what exists and what does not

This section is mandatory and visually equal in weight to the vision sections.

**Prototype today**

- Arc testnet owner account setup and mandate-oriented payment flow.
- Browser-owned direct owner actions and a separately scoped agent signer path.
- An authoritative contract check for the implemented payment rules.
- Journal/activity surfaces and explicit fixture/mock labels where applicable.

**Not established as the complete GOL product**

- The multi-market, multi-chain account and adapter network.
- Full promised-versus-actual receipts, recovery engine, and generalized agent lane.
- Production-readiness, audit status, custody/compliance coverage, or universal venue support.
- Mandatory real-user acceptance under the current KMS-backed agent signer, until dated evidence says
  otherwise.

Link **Read the architecture** to the repository's public architecture URL only after that URL is
confirmed. Within the application, link **Open prototype** to `/app` and **Explore tools** to `/tools`.
Do not expose filesystem paths in rendered copy.

### 5.9 Closing CTA and footer

- Close with the PRD line “Set the limit. Send the agent. Keep the proof.”
- Primary CTA remains **Explore Arc testnet prototype**; no waitlist form is in scope.
- Footer links: `#policy-gate`, `#receipts`, `#status`, `/app`, and `/tools` only. Add legal/privacy
  links only when real destinations and approved content exist.
- Repeat the concise status qualifier next to the CTA. Do not add a launch date; the PRD has none.

## 6. PRD traceability

| PRD requirement | Landing treatment | Claim state | Primary files | Verification |
| --- | --- | --- | --- | --- |
| Core pitch and exact headline | Hero H1 and supporting line | Proposed product | `web/src/content/landing.ts`, `web/src/components/landing/landing-hero.tsx` | Content unit test and H1 E2E assertion |
| Refusal record leads externally | Hero ledger, failure model, receipt section | Illustrative/design target | `landing-hero.tsx`, `enforcement-layers.tsx`, `receipt-model.tsx` | Refusal appears before wallet/market copy in DOM |
| Honest “nothing has shipped as complete Gol” framing | Hero status disclosure and status section | Current/proposed split | `landing.ts`, `product-status.tsx` | Exact disclosure test; forbidden-claim test |
| Consumer-first account, not B2B | Second-person copy and prototype CTA | Proposed product | `landing.ts` | Editorial review; no enterprise lead form |
| Chain-neutral and region-neutral | No chain in headline; Arc appears only in current-prototype qualifier | Mixed | All landing content | Region/partner deny-list test and manual review |
| Four enforcement layers and shutdown test | Failure-model rows with on-chain boundary last | Design invariant | `enforcement-layers.tsx` | Heading/text E2E assertion |
| Owner, Agent, Venue roles | Three semantic role cards | Design target | `policy-gate.tsx` | DOM order and accessible headings |
| Owner fail-open; agent fail-closed | Explicit role copy | Design target/current invariant | `landing.ts` | Content unit test |
| Mandate check between agent and chain | Literal node in HTML diagram and text fallback | Design invariant | `policy-gate.tsx` | E2E checks diagram label order |
| GOL/aggregator is never the venue | Architecture and market copy | Design invariant | `policy-gate.tsx`, `market-vision.tsx` | Content unit test |
| Unified state model and intent fields | Three-receipt sample fields | Design target | `receipt-model.tsx` | Sample-data schema unit test |
| Partial failure and recovery | Recovery shown as a target field, not a shipped feature | Design target | `receipt-model.tsx` | Qualifier adjacency assertion |
| Per-transaction/window/session/lifetime and allow/block controls | Read-only mandate matrix | Design target | `mandate-controls.tsx` | All control groups render |
| Revocable, scoped authority for any agent | Agent role and mandate copy; no compatibility count | Design target | `policy-gate.tsx`, `landing.ts` | Content review |
| Execution brain, routing, simulation, and route badges | Summarized in market section; no “best route” proof claim | Design target | `market-vision.tsx` | Qualifier test |
| Three receipts and promised versus actual | Receipt section | Design target | `receipt-model.tsx` | Accessible ordered-list E2E assertion |
| Market breadth and venue adapters | Category grid with design-target badges | Design target | `market-vision.tsx` | No venue logos/names test |
| Growth never instructs the agent | One boundary note in policy-gate section | Design invariant | `landing.ts` | Exact boundary text test |
| App, mobile, terminal, MCP, CLI, SDK, API surfaces | Do not enumerate as available; mention only as future interfaces in optional detail | Design target | `landing.ts` | No availability wording |
| $100 allowed / $101 refused demo | Static, clearly illustrative hero ledger | Illustrative | `landing-hero.tsx` | Label and accessible description test |
| Licensed-service slot without custody/compliance claims | Omitted from v1 marketing page; architecture leaves a generic adapter edge | Not claimed | `policy-gate.tsx` | No regulated-service terms in landing copy |
| Absorption map is not a build schedule | No project-name history or schedule on landing | Not applicable to public copy | `landing.ts` | Editorial review |
| No token | No token sale, tokenomics, ticker, or token CTA | Not claimed | All landing content | Deny-list test |
| No regional/programme/partner names | None appear | Not claimed | All landing content | Deny-list test |
| Competitive claims require verification | No competitor table, awards, market counts, or “only” claim | Not claimed | All landing content | Deny-list/editorial review |
| No launch deadline exists | No countdown, date, or “coming on” promise | Not claimed | All landing content | Content review |

## 7. Route and component architecture

### 7.1 Route changes

1. Refactor `web/app/layout.tsx` into a configuration-independent document shell. Keep the existing
   `base:app_id` verification metadata, import global styles, and render children directly. Remove
   `dynamic = 'force-dynamic'`, `publicConfigResult`, `ConfigurationNotice`, `Providers`, and `TabNav`
   from this root boundary.
2. Replace `web/app/page.tsx` with the static landing page and page-specific metadata. It must not
   import anything from `web/src/server`, `web/src/client`, `web/src/wallet`, Privy, AG-UI, viem, or
   Three.js.
3. Add `web/app/app/page.tsx` containing the current root product behavior: force dynamic rendering,
   call `publicConfigResult()`, render `ConfigurationNotice` on invalid config, otherwise wrap
   `TabNav` and `GolApp` with `Providers` using the validated public config.
4. Change the Arc tab in `web/src/components/TabNav.tsx` from `/` to `/app` and label it
   **Arc testnet prototype**. Render `TabNav` inside both `web/app/app/page.tsx` and
   `web/app/tokenized-stocks/page.tsx` so those two experiences retain their switcher; do not put it
   back into the root layout or add it to `/tools` and `/preview`.
5. Update explicit “home” links in `web/app/preview/page.tsx` and
   `web/src/components/ToolDirectory.tsx` according to intent: **GOL home** goes to `/`, while
   **Arc prototype** goes to `/app`. Never use an ambiguous unlabeled `/` link.
6. Keep every `web/app/api/**` route unchanged. Do not redirect or proxy API traffic through the
   landing route.

The recommended route is `/app`, not a login modal in the landing page. This keeps the marketing
document server-rendered, prevents configuration failure from taking down public product
explanation, and preserves the existing authenticated flow as one coherent boundary.

### 7.2 New files

| File | Responsibility | Rendering boundary |
| --- | --- | --- |
| `web/src/content/landing.ts` | Typed immutable copy, status labels, nav items, mandate controls, receipt fields, and market categories. No JSX and no runtime config. | Server-safe module |
| `web/src/components/landing/landing-page.tsx` | Section composition and main landmark. | Server component |
| `web/src/components/landing/landing-header.tsx` | Skip link, brand, anchor navigation, `/app` CTA. | Server component |
| `web/src/components/landing/landing-hero.tsx` | Headline, status disclosure, CTAs, illustrative refusal ledger. | Server component |
| `web/src/components/landing/enforcement-layers.tsx` | Four-layer explanation and shutdown invariant. | Server component |
| `web/src/components/landing/policy-gate.tsx` | Two lanes, three roles, and semantic architecture diagram. | Server component |
| `web/src/components/landing/mandate-controls.tsx` | Read-only control matrix with design-target qualifier. | Server component |
| `web/src/components/landing/receipt-model.tsx` | Promised/actual/refused sample receipt cards. | Server component |
| `web/src/components/landing/market-vision.tsx` | Adapter categories and venue boundary. | Server component |
| `web/src/components/landing/product-status.tsx` | Side-by-side current versus proposed disclosure. | Server component |
| `web/src/components/landing/landing-footer.tsx` | Closing CTA and valid internal links. | Server component |
| `web/src/components/landing/landing-motion.tsx` | One small IntersectionObserver enhancement for `data-reveal` elements; no content ownership. | Client component |
| `web/app/opengraph-image.tsx` | Code-native 1200×630 social image with approved headline/status, if approved in phase 0. | Metadata image route |
| `web/app/robots.ts` | Public crawl policy. | Metadata route |
| `web/app/sitemap.ts` | Canonical public pages; omit API and fixture-only paths. | Metadata route |
| `web/tests/landing-content.test.ts` | Claim-state, required-copy, and prohibited-copy regression tests. | Vitest |
| `web/tests/e2e/landing.spec.ts` | Landing semantics, navigation, responsive, keyboard, and reduced-motion behavior. | Playwright |

Prefer shadcn `Button` for CTAs and existing `GolLogo`/`gol-mark-blue.svg` for branding. Create no
one-off button primitive. Use Lucide icons only where a familiar symbol materially aids scanning;
diagrams should use labeled boxes and CSS borders rather than hand-authored decorative SVGs.

## 8. Responsive layout specification

Use existing Tailwind breakpoints and a shared maximum content width aligned with the product's
current `max-w-[1440px]` shell. Do not add a separate breakpoint system.

- **320–639 px:** 16–20 px inline page padding, single-column sections, full-width CTAs, no sticky
  storytelling, no center nav, receipt and role cards in logical DOM order. The architecture diagram
  becomes a vertical ordered flow. Minimum tap target is 44×44 px.
- **640–1023 px:** 24–32 px padding, hero remains stacked, paired status/role cards may become two
  columns when each retains at least 280 px. Receipt cards remain horizontally scroll-free.
- **1024–1439 px:** 12-column composition; hero copy spans 7 columns and ledger spans 5. Policy
  narrative and diagram form a 5/7 split. Receipt cards use three equal columns.
- **1440 px and above:** content width is capped; type and whitespace stop growing. Decorative or
  functional lines remain within the content grid, not viewport edges.

Use `clamp()` only through named typography/spacing tokens in `web/app/globals.css`. Avoid fixed
`100vh` content sections; prefer intrinsic height and `min-h-[calc(100svh-...)]` only for the hero if
content still fits at 320×568 and 200% text zoom. Test long headings without clipping.

## 9. Visual system and typography

- Extend the existing semantic token system only where a reusable semantic role is missing, such as
  policy-allowed, policy-refused, and evidence-muted. Define tokens in both light and dark themes;
  do not scatter raw hex values or arbitrary Tailwind values through components.
- Use flat surfaces, hairline borders, clear type hierarchy, and ledger-like rows that communicate
  mandate state. Do not use generic gradients, glow, glass effects, background blobs, decorative
  card grids, noise, or pattern fills.
- Keep DM Sans for editorial/product copy and JetBrains Mono for field names, limits, reasons, and
  status labels. Replace the runtime Google Fonts `@import` with `next/font/google` in
  `web/app/layout.tsx`, using only required subsets/weights and CSS variables. Add the font license
  provenance to `THIRD_PARTY_NOTICES.md` and confirm that the production build can fetch/cache it.
  If builds must be network-independent, obtain approved font files and use `next/font/local`
  instead; do not take fonts from the reference archive.
- Retain the current theme semantics. The landing must remain legible in light, dark, and forced-color
  modes even if it does not expose a separate theme switch.

## 10. Motion and interaction

Motion must clarify causality: request → mandate check → allowed/refused record.

- `landing-motion.tsx` observes elements with `data-reveal` and adds a ready class once. CSS animates
  opacity and a maximum 12 px vertical offset for 180–360 ms with small, bounded section staggering.
- The illustrative refusal flow may emphasize its three already-visible rows in sequence when first
  entering the viewport. It must never hide the refusal result while JavaScript loads.
- Policy edges may change stroke emphasis on hover/focus of a role card. Keyboard and pointer behavior
  must match; no cursor-following interaction is permitted.
- Use native anchor scrolling. Do not add Lenis, GSAP, scroll hijacking, continuous marquees,
  preloaders, page transitions, pinned `125svh` scenes, parallax, WebGL, Three.js, or custom cursors.
- With `prefers-reduced-motion: reduce`, render all elements in their final state, remove scrolling
  behavior and transition delays, and stop any sequencing. Also stop motion when the document is
  hidden.
- Do not animate layout dimensions or large painted regions. Restrict enhancements to opacity and
  transform and avoid blanket `will-change`.

Framer Motion is already installed but should not be imported by the landing route unless the small
observer cannot satisfy a concrete requirement. Keeping it out of the landing chunk is the default.

## 11. Accessibility requirements

- One H1, sequential H2/H3 structure, and explicit `header`, `nav`, `main`, `section`, and `footer`
  landmarks. Every section referenced by an anchor has a stable ID and visible heading.
- Skip link is first in tab order. Focus indicators use existing semantic ring tokens and are never
  removed. Tab order follows DOM/reading order at every breakpoint.
- All CTAs are links, not buttons with navigation handlers. The illustrative ledger and architecture
  diagram have adjacent text descriptions; screen readers do not depend on line position or color.
- Refused/allowed states include text and an icon, never color alone. Decorative connector lines and
  icons are `aria-hidden`; meaningful icons have visible labels.
- Minimum WCAG 2.2 AA contrast: 4.5:1 for normal text, 3:1 for large text and UI graphics. Touch
  targets are at least 44×44 px and cards do not require hover.
- At 200% browser zoom and 320 CSS px, no text clipping, two-dimensional scrolling, or obscured focus.
- Text-reveal effects never split words/characters into inaccessible DOM fragments. The semantic text
  remains intact before and after hydration.
- Manual release review covers keyboard-only use, VoiceOver/Safari, one Chromium screen reader,
  forced colors, reduced motion, and high-contrast dark/light themes.

## 12. Performance budget and loading behavior

- The landing must produce meaningful HTML without JavaScript, public configuration, or upstream
  service availability.
- No runtime network requests are allowed before a user follows a CTA. This includes RPC, Privy,
  DiceBear, token icons, agent, database, analytics, and remote font CSS requests.
- Do not load Three.js, postprocessing, Privy, viem, AG-UI, or product dashboard code in the landing
  route chunk. Confirm with the Next build route output and a browser network trace.
- Initial landing JavaScript budget: no more than 35 kB compressed beyond the shared Next runtime.
  The observer should be the only intentional client island.
- Target field metrics at the 75th percentile on a mid-tier mobile profile: LCP ≤ 2.5 s, CLS ≤ 0.1,
  and INP ≤ 200 ms. Treat these as release gates, not claims to publish.
- Use the existing SVG brand asset inline or as a small static resource. If raster images are later
  approved, use `next/image`, explicit dimensions, modern formats, and responsive `sizes`; only the
  actual LCP asset may be eager.
- Avoid a service worker, client content fetch, carousel, video, or canvas in v1.

## 13. SEO and metadata

- Root metadata title: `Gol — On-chain limits for AI agents`.
- Description: `A proposed account model where owners set enforceable limits for agents and keep a
  record of allowed and refused actions. Explore the current Arc testnet prototype.`
- Give `/app` separate metadata: `Gol Arc testnet prototype` and an explicit prototype description.
- Keep the existing Base domain-verification meta tag in the root layout unless the operator removes
  it in a separately reviewed change.
- Set a canonical URL only after confirming `https://gol.network` remains the intended public origin
  at implementation time. The sitemap contains `/`, `/app`, and `/tools`; omit API routes,
  `/preview`, and mock-only pages unless product owners intentionally make them indexable.
- The code-native Open Graph image must use original GOL styling, the approved headline, and the
  prototype/proposed qualifier. Do not use archived reference assets. The existing generated cover
  may be substituted only after its recorded pending human review is completed and its older
  Arc-payment positioning still matches the page.
- Use descriptive Open Graph/Twitter alt text. Do not add structured data with availability, price,
  review, organization, or launch claims that cannot be verified.

## 14. Runtime configuration and trust boundaries

The landing is a pure public document. Its import graph must terminate in server-safe presentation
code and immutable content.

- `publicConfigResult()` remains server-only and is called at `/app`, not in the root layout or
  landing page.
- `Providers` and Privy initialize only under `/app`; visiting `/` must not start auth, request wallet
  permissions, or expose chain configuration.
- No landing component imports `web/src/server/**`, `web/src/client/**`, `web/src/wallet/**`,
  `@privy-io/**`, `viem`, `pg`, or agent packages.
- No environment variable is copied into landing content. Public-origin/canonical configuration, if
  introduced later, must be validated on the server and remain non-secret.
- Existing write-origin validation, bearer authentication, body-size/rate limits, owner-key scoping,
  journal lifecycle, chain policy, and signer boundaries remain unchanged.
- CTA navigation to `/app` crosses into the existing configuration gate. Invalid product config shows
  `ConfigurationNotice` there, without replacing or breaking the public landing page.
- The illustrative receipt data is a typed constant with an unmistakable sample identifier. It never
  comes from production, fixture APIs, or copied evidence.

## 15. Reference provenance and licensing decision

The verified external inventory contains 473 source ZIPs (439 from channel `1048241543477215275` and
34 from `1112149715237228635`), with all archives hash-verified, CRC-clean, and extracted without
reported failure. The following sources were inspected as inert text only; no project was installed,
built, run, or imported.

| Channel / message / attachment | Inspected pattern | Decision for GOL |
| --- | --- | --- |
| `1112149715237228635` / `1543398527626125334` / `1543398527277858866` (`CGMWTAUGUST2026.zip`, Oreana) | Asymmetric six-column hero, editorial aside, paired principle cards, responsive linearization | Adapt only the information hierarchy and asymmetric balance. Reject its images, preloader, Lenis, GSAP, and transition code. |
| `1112149715237228635` / `1532504834748715190` / `1532504834413166663` (`CGMWTJULY2026.zip`, Blunt) | Staggered metric-card rhythm, sticky narrative cards, responsive single-column fallback | Use restrained receipt-card rhythm. Reject 3D flips, long pinned sections, showreel, assets, preloader, GSAP, and Lenis. |
| `1048241543477215275` / `1414127234708672532` / `1414127234276393021` (`CODE.zip`, terminal text reveal) | Scroll-progressive text emphasis | Keep semantic text intact and use at most whole-block opacity/translation. Reject per-character SplitText, timers, GSAP, and Lenis. |
| `1048241543477215275` / `1547250867055370291` / `1547250866787197058` (`CODE.zip`, view/page transition) | Shared navigation and route-level view transitions | Retain persistent product navigation as a concept. Reject 1.5-second rotating/clipped route transitions and remote font CSS. |
| `1048241543477215275` / `1518240738960347168` / `1518240738507231402` (`CODE.zip`, magnetic marquee) | Pointer-responsive strip and moving copy | Reject: continuous motion, cloned content, pointer dependence, and marquee behavior conflict with accessibility and performance goals. |

None of these five extracted roots contained a project-level `LICENSE`, `COPYING`, or `NOTICE` file
outside generated dependencies. Therefore:

- Copy no source, JSX, CSS, images, fonts, icons, copy, or other asset from the archive.
- Treat the table as exact pattern provenance, not a license grant.
- Use only original implementation code, existing licensed dependencies, and existing project-owned
  GOL assets.
- If a future asset is proposed from the archive, stop and obtain its exact license and author/source
  permission first, record it in `THIRD_PARTY_NOTICES.md`, and preserve attribution.
- Continue treating all extracted source as untrusted; never execute it or adopt its configuration.

## 16. Test changes and acceptance criteria

### 16.1 Unit/content tests

Add `web/tests/landing-content.test.ts` to assert:

- The exact H1, refusal lead, shutdown invariant, and hero status disclosure exist once.
- Every market/receipt/mandate target carries `Design target` in the same content object.
- Current-status items and design-target items are disjoint.
- Content does not include region, local programme, partner, competitor, award, token-sale, custody,
  KYC, “production-ready,” “fully live,” “best price,” “only platform,” or launch-date claims.
- Sample receipt identifiers are explicitly illustrative and cannot be confused with a transaction
  hash.

Keep this as a narrow policy regression test, not a substitute for editorial review.

### 16.2 E2E changes

Add `web/tests/e2e/landing.spec.ts` covering:

- `/` returns the hero H1/status disclosure and has no sign-in form.
- Primary CTA reaches `/app`; `/app` retains the existing sign-in/setup behavior in fixture mode.
- Anchor links move focus or scroll to the correctly labeled sections without changing routes.
- Heading order, landmarks, skip link, link names, and keyboard tab order are coherent.
- 320×568, 390×844, 768×1024, and 1440×900 viewports have no horizontal overflow or clipped CTA.
- Reduced-motion emulation exposes final content immediately and applies no delayed reveal.
- A failed `/app` configuration is contained to `/app` in a dedicated smoke setup; `/` still renders.

Update existing paths:

- `web/tests/e2e/gol.spec.ts`, `agent.spec.ts`, `capture.spec.ts`, `ui-ux.spec.ts`, and
  `wallet-sidebar.spec.ts`: product-flow `page.goto('/')` calls become `page.goto('/app')`.
- `web/tests/e2e/tokenized-stocks.spec.ts`: the Arc navigation assertion targets `/app` and the new
  accessible label.
- Keep a new landing capture in `capture.spec.ts`; rename existing root sign-in captures to make the
  `/app` provenance clear.
- Do not weaken payment, refusal, agent, theme, mobile-drawer, or wallet assertions to accommodate the
  route move.

### 16.3 Acceptance criteria

- `/` renders meaningful content with JavaScript disabled and with no GOL runtime configuration.
- `/app` preserves the current fixture and live-mode code paths and all trust-boundary tests.
- The mandate gate is visually and textually between agent and execution/chain.
- Current and proposed capabilities are visibly distinguishable without reading the footer.
- No reference archive asset or code enters the repository.
- Landing network trace has no Privy, RPC, agent, DiceBear, token-icon, or Google CSS request.
- All focusable controls are keyboard reachable and visible; reduced motion is complete, not merely
  slower.
- Performance budgets in section 12 pass on the release candidate or the change does not ship.

## 17. Implementation sequence

1. **Claims gate.** Product/design/legal reviewers approve the hero disclosure, H1, current-status
   bullets, CTA wording, and forbidden-claim list. Recheck `spec/deployment-status.md` and domain state
   on the implementation date. Resolve name/trademark questions before public rollout.
2. **Route isolation.** Make the root layout configuration-independent, move current behavior to
   `/app`, update `TabNav`, and update existing E2E routes. Run the existing web tests before any visual
   work; rollback if product behavior changes beyond URLs/navigation.
3. **Typed content and semantic shell.** Add `landing.ts`, all server components, skip link, semantic
   diagram fallback, and status qualifiers. Add content tests first.
4. **Responsive visual system.** Extend semantic tokens, migrate font loading, implement layouts from
   320 px upward, and use existing shadcn/Lucide primitives.
5. **Progressive motion.** Add the isolated observer and CSS transitions only after the static page is
   complete. Verify no content depends on hydration and no product-only dependency enters the chunk.
6. **Metadata and discoverability.** Add page/app metadata, canonical after domain confirmation,
   robots/sitemap, and an approved code-native social image.
7. **Regression and evidence.** Run unit, E2E, build, formatting, accessibility, network, bundle, and
   performance checks. Save screenshots/traces only in established evidence locations and label them
   local until production verification exists.
8. **Release review.** Compare rendered copy to the PRD claim rules and latest dated deployment
   evidence. A deployment is a separate operator action and evidence update, not part of landing-page
   implementation completion.

## 18. Exact validation commands

Use Node 22 and pnpm 11.17.0. During implementation, run the narrow checks first, then the full web
path:

```bash
node --version
pnpm --version
pnpm --filter @gol/web typecheck
pnpm --filter @gol/web test
pnpm --filter @gol/web build
pnpm --filter @gol/web test:e2e
pnpm format:check
git diff --check
```

Use these read-only boundary checks after the build:

```bash
rg -n "publicConfigResult|Providers|Privy|@privy|viem|@gol/agent|@gol/protocol|three|@react-three" \
  web/app/page.tsx web/src/components/landing web/src/content/landing.ts
rg -n "production-ready|fully live|best price|only platform|KYC|custody|token sale" \
  web/app/page.tsx web/src/components/landing web/src/content/landing.ts
git status --short
```

The first two `rg` commands should produce no matches except an intentional prohibited-copy list in
the test file (which is outside the searched paths). Review Next's per-route build output and a clean
browser network trace to confirm the bundle/network budgets; do not infer those from source imports
alone.

For this planning-only document change, the required checks are:

```bash
pnpm format:check
git diff --check
```

## 19. Risks, gates, and rollback

| Risk | Mitigation / gate |
| --- | --- |
| Full Gol vision is mistaken for current capability | Hero disclosure, adjacent claim-state badges, content tests, and final evidence review. |
| Root route move breaks users or tests | Add `/app` first, update product nav/E2E atomically, and retain all behavioral assertions. Consider an announcement period only if analytics show established root deep links; do not redirect `/` away from the new landing. |
| Root configuration gate remains accidentally coupled | Static import audit, invalid-config smoke test, and landing network trace. |
| Current prototype is overclaimed before mandatory acceptance | Use “prototype,” never “production-ready/live payments”; recheck dated evidence at release. |
| Marketing diagram weakens the trust-boundary model | Require the mandate check between agent and chain and preserve owner/agent lanes in text and DOM order. |
| Broad markets imply venue relationships | Use generic adapter categories, design-target labels, and no names/logos/counts. |
| Reference IP enters the product | No-license finding means pattern-only use; asset/code checksum review in PR. |
| Motion causes nausea, jank, or inaccessible DOM | Native scrolling, no pinning/continuous motion, intact semantic text, reduced-motion E2E, and tight transform/opacity limits. |
| Font migration makes builds network-dependent | Verify CI fetch/cache; fall back to separately approved local files, never archive fonts. |
| OG image repeats stale hackathon positioning | Prefer code-native approved creative; require review before reusing existing generated cover. |
| Name, domain, or launch timing changes | Phase-0 product/legal gate; no launch date and canonical only after confirmation. |
| Landing work changes signer/API behavior | No API, server core, worker, contract, protocol, subgraph, or signer changes are in scope. Roll back any implementation that requires them and open a separately reviewed plan. |

Rollback is route-local: restore the prior `web/app/layout.tsx` and `web/app/page.tsx`, reverse the
`TabNav`/E2E URL updates, and remove only new landing files. Do not reset unrelated user changes or
roll back API, contract, deployment, or journal state. The implementer must capture the pre-change
worktree status and preserve any unrelated dirty files throughout.

## 20. Out of scope

- Implementing or deploying the landing page in this planning task.
- Changing contracts, mandates, signer custody, agent policy, journal schema, APIs, or subgraph.
- Adding a waitlist, analytics, cookies, CMS, localization, regulated-service flow, or partner slot.
- Implementing the PRD's broader markets, chains, recovery engine, MCP/SDK surfaces, growth loop, or
  launch programme.
- Publishing competitor, award, team, traction, “best route,” volume, or compliance claims.
- Downloading, executing, or copying third-party reference projects or media.
