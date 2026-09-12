# GOL landing page visual redesign plan

Date: 11 September 2026
Frozen impression strategy timestamp: **2026-09-11T02:18:26Z**
Frozen strategy SHA-256: `61d1bc4f6479405b95af7b959866428c8db8d3907f382024a27a1b24a9a9401d`

## Target audience state on arrival

The visitor is curious about agents acting with money but skeptical of autonomy claims, short on
attention, and unable to tell from a typical AI-finance landing page whether “limits” are a prompt,
a server switch or an execution-time rule. In five seconds they need a concrete consequence, not a
taxonomy. In thirty seconds they need to understand owner authority, the separate bounded agent
lane, the durable refusal record and the difference between the Arc prototype and the proposed
broader product.

## One-sentence desired impression

**GOL makes an agent's spending power feel physically bounded: a request travels to the owner's
line, and the line visibly decides what can move.**

## Five-second hook

Show one large owned GOL mark/boundary and one legible comparison: **Limit $100 / Agent asks $101**.
A single request token reaches the boundary, stops, and resolves into **Refused · PER_TX_CAP**. The
headline is shorter than the current headline and the primary CTA is visible without scrolling.

## Thirty-second emotional and narrative arc

1. **Recognition:** “I know exactly what crossed the line.”
2. **Relief:** the rule survives prompt, framework and server failure because the relevant check is
   at execution.
3. **Agency:** the owner can shape amount, destination, execution and lifecycle bounds while keeping
   a distinct direct-owner lane.
4. **Confidence:** promised, actual and refused receipts make both action and non-action inspectable.
5. **Possibility, correctly bounded:** adapters can widen the product's reach without making GOL a
   venue, while a compact status disclosure separates the Arc prototype from design targets.

## Single signature wow moment

**The refusal becomes the receipt.** The $101 request crosses the first span, hits the circular
policy boundary, compresses rather than exploding, then unfolds immediately below as a refusal
record containing attempted amount, rule and remaining headroom. This is the only cinematic beat.
It is short, deterministic, transform/opacity-only and optional; the final state exists in the DOM
before motion. With reduced motion, the line, stop and receipt appear together without transition.

## Original GOL visual metaphor

The coherent concept is **The Consequence Line**. It extends the official GOL mark's controlled path
crossing a circular policy boundary into a page-wide visual grammar:

- a thin cobalt route means a request or allowed path;
- a circular boundary means owner-defined policy;
- a square stop and folded ledger edge mean refusal and record;
- parallel owner and agent rails explain authority without implying equal permissions;
- adapter branches leave the account boundary only after a permitted path.

This is original GOL composition, not a traced SVG or a downloaded component. Connections use
semantic DOM plus borders/pseudo-elements and the maintained GOL asset; feature components do not
hand-code SVG.

## Art direction

- **Composition:** asymmetric editorial layouts, one dominant proof object per section, generous
  quiet space and occasional full-bleed rule lines; never another sequence of equal cards.
- **Depth:** restrained paper/ledger layering in receipts and a single foreground boundary in the
  hero. Depth communicates ordering, not glass or decoration.
- **Color:** semantic existing tokens; cobalt `primary` carries requests, `destructive` marks a real
  refusal, and neutral paper/card surfaces carry evidence. No gradients, glows or rainbow shaders.
- **Type:** DM Sans remains the plain-language voice and JetBrains Mono labels amounts, rules and
  receipt fields. Large type is reserved for the short promise and the $100/$101 comparison.
- **Light:** high-contrast flat light with one localized emphasis at the policy boundary; no
  pointer-following spotlight.
- **Motion:** one-shot causal motion. No smooth-scroll replacement, parallax, pinned multi-viewport
  scenes, cursor followers, autoplay media, perpetual orbit or ambient canvas.

## Page pacing

The rhythm is **impact → proof → control → record → reach → honest next step**. Alternate a tall
split hero, a narrow comparison strip, an asymmetric bento, a tactile layered stack, a wide network
map and a compact status/CTA close. Desktop target is at most 6.5 900-pixel viewports; mobile target
is at most 9 844-pixel viewports. No non-hero section should exceed 1.25 viewport heights at 390×844
unless content is expanded by the user.

## Interaction principles

- Interaction answers a product question; it never exists only to make pixels move.
- The illustrative policy request is the only required hydrated island. It supports pointer,
  keyboard and touch equally and uses shadcn `Button`, not native controls in a feature component.
- Essential content and the current state are present without JavaScript. Announcements are concise
  and use `aria-live="polite"`; color and motion are never the only state signals.
- Native scroll remains native. Sticky behavior, if any, is a small progressive enhancement and is
  removed below the desktop breakpoint and under reduced motion.
- Hover is optional enrichment; focus-visible receives an equivalent or stronger treatment.

## How visual proof replaces prose

- `$100 → gate → allowed` and `$101 → gate → refused` replace repeated explanations of enforcement.
- A four-layer comparison physically fades prompt/framework/server layers while the account gate
  remains, replacing four descriptive cards.
- A mandate bento shows amount, destination, execution and lifecycle constraints as legible control
  readouts rather than four card lists.
- A three-sheet receipt stack carries promised/actual/refused fields and exposes detail through a
  native disclosure instead of three explanatory paragraphs.
- A bounded adapter topology shows GOL as account/policy layer with generic execution edges, avoiding
  eight nearly identical market cards and avoiding partner claims.
- One status legend and one end disclosure carry prototype/design-target qualification; qualifiers
  remain adjacent to claims but stop repeating in every tile.

## Memorable exit impression

The consequence line terminates at the final CTA beside the phrase **Set the limit. Send the agent.
Keep the proof.** The visitor leaves remembering a boundary and a receipt—not a grid of capabilities.

## Measurable success criteria

- At most **500 visible body words** at default collapsed state, down from 891.
- At least **six meaningful product visuals**, cutting the proxy from 445.5 to at most 84 words per
  meaningful visual.
- At most **16 large rounded/bordered surfaces** and at most **18 bordered panels over 100×60**, down
  from 27 and 42 respectively.
- “Prototype” appears at most four times and “Design target” at most three times in visible collapsed
  copy, while every proposed/live distinction remains explicit and adjacent.
- Desktop ≤6.5 viewports at 1440×900; mobile ≤9 viewports at 390×844; no horizontal overflow at
  320, 390, 768 or 1440 pixels.
- Hero H1 ≤14 words; default hero explanation ≤45 additional words before the disclosure/CTAs.
- The illustrative request reaches a text-complete allowed/refused result by keyboard and without a
  network request; JavaScript-disabled output still includes the $101 refusal truth.
- No new raster/video/WebGL/Three/GSAP/Lenis payload; no new package; landing-specific JavaScript is
  limited to the request island and measured after the production build.
- Reduced-motion mode has no non-zero animation or transition on the request, receipt and network
  visuals; content order and meaning remain identical.
- Automated accessibility scan has no serious/critical violations; all text/controls meet WCAG 2.2
  AA contrast and targets are at least 44×44 CSS pixels where touch interaction is expected.

## Anti-patterns and non-goals

- No wall of equal cards, icon-per-feature catalogue, repeated “design target” badge on every tile,
  ornamental circuit grid, dotted tech wallpaper, gradient, glow, glass, shader, floating blob or
  logo soup.
- No scroll hijacking, long pinning, forced scroll reset, split-text animation, custom cursor,
  pointer-only reveal, looping beam/orbit, autoplay media or content hidden until animation.
- No fake wallet, transaction, explorer proof or interactive “product demo.” The request is labeled
  illustrative and performs no policy, chain, runtime-config or API work.
- No claim of universal venue support, live multi-market routing, custody, token, yield, KYC,
  licensing, audit completion, production agent payment or deployment beyond dated evidence.
- No redesign of `/app`, no changes to owner/agent trust boundaries, no deployment and no copied
  downloaded/21st.dev source or asset.

## Creative concept decision, frozen before research

**Chosen: The Consequence Line.** It is the only direction that makes refusal, authority and proof
one continuous visual cause/effect while extending an existing brand meaning.

Rejected alternatives:

1. **Mission-control dashboard.** It front-loads small operational widgets, looks like the existing
   app, suggests live data and repeats the current density problem before the visitor understands the
   model.
2. **Every-market solar system.** Orbiting venue icons make breadth the hero, can imply partners or
   live integrations and reduce the mandate to a decorative center. Perpetual orbit also fails the
   restrained motion/performance bar.
3. **Editorial kinetic manifesto.** Giant scrolling sentences would replace a wall of small text
   with a wall of large text, delay concrete proof and depend on split-text/pinned motion.

This strategy was written and checksum-frozen before the archive shortlist or 21st.dev review. The
external source is
`/Users/nathan/Downloads/Gol Network Login Flow/ref-landing-for-gol/research-v2/impression-strategy.md`.
All later research was scored against it; no catalog result changed the concept.

## Planning boundary and source set

This document is implementation-ready planning only. It does not claim the redesign is implemented,
deployed or independently verified. It was derived from:

- `Gol_Complete_PRD_v1.md` in the prepared external documentation;
- current repository code and dated deployment evidence;
- `assets/gol-logo.svg`, `web/public/gol-mark-blue.svg` and `assets/architecture.svg`;
- the current implementation plan/report/final verification and all four verification screenshots;
- the post-freeze component research under external `research-v2/`.

The local corpus scan covered 473/473 archives and indexed 1,103 candidates; the official 21st.dev
review inspected 36 live preview/source/info pages and recorded seven unavailable/stub checks. The
details and limitations are in external `COMPONENT-AUDIT.md`, `component-index.jsonl`,
`local-shortlist.json` and `21st-dev-audit.jsonl`.

## Current behavior versus proposed behavior

| Concern | Current uncommitted tree | Proposed redesign |
| --- | --- | --- |
| Route | `/` is a statically rendered seven-section landing page; `/app` owns the product prototype | Keep route and server-first boundary unchanged |
| Length | 891 visible words; 7.79 desktop and 14.47 mobile screenshot viewports | ≤500 words; ≤6.5 desktop and ≤9 mobile viewports |
| Rhythm | Seven consecutive intro/card-grid bands; 27 rounded-card matches and 42 large bordered panels | Six beats with different silhouettes: split, strip, bento, stack, topology, close |
| Visual proof | Two meaningful diagrams; most visuals are icon cards | Six or more semantic illustrations; ≤84 words per proof visual |
| Hero | Long 25-word headline beside a three-row refusal card | ≤14-word headline around one interactive $100/$101 consequence line |
| Motion | CSS-only entry/hover; zero landing client components | One small client request island; causal CSS transforms only; all else server/static |
| Claims | Truthful, but “prototype” repeats 10 times and “Design target” repeats 5 times | One status legend, adjacent section state, compact disclosure; truth remains explicit |
| Policy | Five equal step cards plus three role cards and repeated authority copy | One owner/agent rail and one gate; roles are spatial labels, not cards |
| Controls | Four equal text-list cards | Asymmetric bento with one dominant amount boundary and three supporting control surfaces |
| Receipts | Three equal cards | A layered promised/actual/refused ledger with the refusal physically on top |
| Markets | Eight equal category cards | One generic adapter topology plus short semantic category list; no venue logos |
| Status | Large two-column lists in the final section | Concise visible truth plus native disclosures for complete prototype/design-target lists |
| Metadata | Confirmed public origin is centralized in `web/src/content/site.ts`; route metadata is accurate | Preserve exactly; visual work does not introduce runtime config or revise deployment claims |

### Baseline evidence

The exact DOM, script and screenshot measurements are recorded in external `baseline.json`. The
existing evidence images are:

- `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/landing-desktop-light.png`
- `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/landing-desktop-dark.png`
- `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/landing-mobile-light.png`
- `/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/landing-mobile-dark.png`

The redesign must take new screenshots with identical viewports so the height, density and rhythm
comparison is objective.

## Information architecture and content budget

The main page moves from seven sections to six narrative beats. The copy budget includes visible
default text, navigation and footer but excludes collapsed disclosure content from the 500-word
default-state target. Collapsed text still counts toward accessibility and full document truth.

| Beat | Purpose | Default word budget | Primary visual proof | Claim state |
| --- | --- | ---: | --- | --- |
| Header + hero: “The line decides” | Establish bounded agency and concrete consequence | 120 | Interactive $100/$101 gate and refusal receipt | Proposed model + illustrative data |
| Enforcement strip: “Where the rule survives” | Distinguish prompts/framework/server from account enforcement | 65 | Four-layer durability comparison | On-chain principle; implemented scope remains qualified |
| Mandate bento: “Make the line yours” | Show amount/destination/execution/lifecycle controls and lanes | 90 | Dominant amount meter, owner/agent rails, three supporting control readouts | Design targets, with implemented payment scope named |
| Receipt stack: “Keep what did and did not happen” | Explain promised/actual/refused evidence | 75 | Layered ledger; refusal on top | Design target + illustrative values |
| Adapter network: “One boundary, many edges” | Show future breadth without venue/partner implication | 70 | Account→adapter→generic category topology | Proposed vision/design target |
| Status + CTA: “Know what exists” | Separate current Arc prototype from broader targets and hand off | 80 | Two-state status ledger and terminating consequence line | Implemented locally/testnet evidence vs design targets |

### Navigation

Keep the current compact, semantic header and skip link. Reduce anchors to `#mandate`, `#receipts`,
`#network` and `#status`; “Open prototype” remains the distinct action. Do not adopt a full-screen
menu. At mobile widths, preserve a 44-pixel action target and allow nonessential anchor labels to
wrap into a compact second row only if all four fit without horizontal scroll; otherwise show the
prototype CTA plus a shadcn `Sheet` with focus management. The preferred implementation is the
simple wrapping header because it needs no additional client boundary.

## Section specifications

### 1. Header and hero — The line decides

**Content**

- Status eyebrow: `PROPOSED MODEL · ARC TESTNET PROTOTYPE AVAILABLE`.
- H1 target: **Agents can act. Your limit still decides.**
- Supporting line: owner sets the mandate; agent asks through a separately scoped lane; account
  policy permits or refuses at execution.
- Primary CTA: `Explore Arc testnet prototype` → `/app`.
- Secondary CTA: `See the boundary` → `#mandate`.
- One short disclosure: complete Gol product has not shipped; sample values are illustrative.

**Visual and interaction**

- The left/top composition carries the short promise and CTAs; the right/bottom proof surface is
  the dominant GOL boundary, not a card.
- `MandateGateDemo` initializes to the text-complete refused sample: limit `$100`, requested `$101`,
  result `Refused`, rule `PER_TX_CAP`, headroom `$100`.
- A two-option shadcn `Tabs` or pair of shadcn `Button` controls lets the visitor choose `$100` or
  `$101`; a `Run illustrative check` button replays only the local visual state. Prefer `Tabs` if its
  existing roving keyboard behavior remains correct. No request is sent and no real policy
  decision is calculated; a lookup table maps the two fixed samples to approved copy.
- The request chip travels through a CSS rail. Allowed `$100` continues to `execution edge`; refused
  `$101` stops and its result panel unfolds into a receipt. Text labels exist throughout, even while
  visually overlapped.
- The default entrance may auto-run once after first paint, but it must not steal focus, scroll,
  announce to assistive technology or loop. User-triggered replay announces only `Allowed within
  illustrative $100 limit` or `Refused: PER_TX_CAP; $100 headroom`.

**Responsive transformation**

- ≥1024px: 5/7 editorial split with the line moving horizontally through the circular mark.
- 640–1023px: stacked copy/proof; proof remains a wide horizontal route.
- <640px: route becomes a vertical ordered rail; controls are full-width and the receipt unfolds
  beneath the gate. No absolute label may escape the viewport.

**Reduced motion**

- The request, gate state and receipt render in their final positions with zero duration.
- Replay changes text/state instantly. No `aria-live` announcement is delayed by animation timing.

**Acceptance**

- A new visitor can say “$101 is stopped by a $100 rule and the stop is recorded” from the first
  viewport.
- The H1, primary CTA, $100, $101 and `PER_TX_CAP` appear within the first 900 desktop pixels and
  first 1,250 mobile pixels.
- With JavaScript disabled the refused state and disclosure remain visible; controls are absent or
  disabled without suggesting interactivity.

**Research fit**

- Original GOL treatment, informed at pattern level by local Scroll-powered SVG stroke (18/20) and
  21st Animated Beam (17/20). Copy no path, component, icons or assets.

### 2. Enforcement strip — Where the rule survives

**Content and visual**

- Replace the current four prose cards with one wide comparison made of four labeled rails:
  `Prompt`, `Framework`, `Server`, `Account policy`.
- Each rail contains only a short failure verb: `rewritten`, `replaced`, `offline`, `still checks`.
- A single caption retains the invariant: shut Morca servers off; an agent request beyond the
  implemented limit is still refused by the account check. Do not generalize this sentence beyond
  repository-backed payment rules.
- Prompt/framework/server lines visually break before execution. Account policy remains continuous
  to the boundary. This is semantic HTML—prefer a definition list or ordered list—not a canvas.

**Motion**

- When visible, the three advisory rails may fade/shorten once and the policy rail may draw once.
  Implement as progressive CSS `animation-timeline: view()` only behind `@supports`; static final
  state is the default and reduced-motion state. No observer/client component is justified.

**Acceptance**

- Exactly four enforcement labels remain.
- Screen-reader order states all four outcomes without needing visual line breaks.
- Section height ≤0.8 viewport at desktop and ≤1.15 at 390×844.

**Research fit**

- Uses the causal ordering found in local path/timeline sources; rejects their Lenis/GSAP/pinning.

### 3. Mandate bento — Make the line yours

**Content and visual**

- Merge the current policy-gate role explanation and mandate controls into one section at
  `id="mandate"`.
- A dominant 2×2-spanning **Amount boundary** shows per-transaction `$100`, `$101` outside the line,
  plus small rolling/session/lifetime labels. It is illustrative/design-target UI, not an input.
- Three supporting visual cells show:
  - Destination: recipient → contract → method, ending at an allow/block boundary.
  - Execution: asset / chain / slippage / arguments as a compact constraint matrix.
  - Lifecycle: validity / nonce / revoke / recovery along a finite timeline.
- A rail along the bento edge labels `Owner lane: direct, owner-signed, fail-open` and `Agent lane:
  scoped, checked, fail-closed`. The agent rail alone passes through the mandate gate.
- A concise footnote preserves: signer may refuse, only account policy may permit an agent payment;
  growth systems can read trace but cannot write mandate state.

**Responsive transformation**

- ≥1024px: asymmetric 12-column grid; amount 7 columns × two rows, other cells 5 columns.
- 640–1023px: amount full-width; supporting cells form a 2+1 grid.
- <640px: one column in semantic source order; rails become two labeled horizontal strips before
  the controls. No content disappears.

**Motion and interaction**

- This section is static. Hover/focus can raise contrast on one cell, but no information appears
  only on hover and no simulated slider/input is rendered.

**Acceptance**

- All four PRD control groups and the separate owner/agent authority model remain findable by text.
- Unequal spans are visually obvious at desktop and collapse cleanly without changing reading order.
- Section has four major surfaces rather than the current seven policy/control cards.

**Research fit**

- Pattern-level hierarchy from local `MissionFeatures` (16/20), 21st Feature Bento (15/20) and
  Feature Section With Bento Grid (14/20); no source or skin is copied.

### 4. Receipt stack — Keep the proof

**Content and visual**

- Preserve `Promised`, `Actual` and `Refused` with the exact illustrative field groups currently in
  `landing.ts`.
- Render an ordered three-sheet ledger: promised at the back, actual in the middle, refused at the
  front with a visible red rule edge. Every sheet has a title, state label and three key/value rows.
- On desktop the stack has slight translate/rotate offsets. On hover or focus-within it fans just
  enough to expose all titles. On mobile and reduced motion it is already fanned vertically.
- A native `<details>` styled through a reusable shadcn disclosure primitive may hold the one-sentence
  explanation for each record if default word budget requires it. If a new interactive disclosure
  is introduced, first add it under `web/src/components/ui/` so feature components do not render a
  raw control.
- The refused sample is visibly tied back to the hero's `$101 / PER_TX_CAP / $100 headroom` result,
  creating the signature consequence-to-record memory.

**Motion**

- Optional CSS view-timeline progressive enhancement spreads the sheets once; transform/opacity
  only. Default/static and reduced-motion layouts expose all three titles and values.

**Acceptance**

- Promised, actual and refused values are text, selectable and not encoded only in position/color.
- No overlapping sheet obscures text at 200% zoom or at 320px width.
- Whole section ≤1.15 desktop viewports and ≤1.5 mobile viewports collapsed.

**Research fit**

- Pattern-level sources: local `MissionStack` (17/20), `FeaturedCards` (15/20), rejected
  `FeaturedWork` implementation, and 21st Cards Stack (14/20). No sticky runway or images.

### 5. Adapter network — One boundary, many edges

**Content and visual**

- Center-left node: `GOL account + mandate`, clearly labeled `Proposed model`.
- Middle nodes: generic `Adapter` ports; the surrounding copy says adapters connect execution edges
  and GOL never becomes the venue.
- Right/bottom category endpoints: Trade, Rebalance, Pay, Borrow/lend, Prediction, Tokenized assets,
  Yield and Service rails. These are design targets, not live integrations.
- Use CSS grid, borders and pseudo-elements for connections. Use the maintained GOL mark asset only;
  do not hand-code a network SVG, add protocol logos or imply named partners.
- One allowed route can receive a brief one-shot highlight. Other edges remain static; nothing
  orbits.

**Responsive transformation**

- ≥1024px: three-stage topology—account, adapters, categories—with varied category positions.
- 640–1023px: account above two adapter columns and a four-column endpoint grid.
- <640px: an ordered vertical route followed by a compact two-column semantic category list; line
  connectors become left borders. Reading order remains account → adapter → category.

**Acceptance**

- The exact phrase `GOL is not the venue` is adjacent to the topology.
- `Design target` labels the category group once, not eight times.
- No venue logo, chain logo, yield/rate, balance, live status or partner language appears.

**Research fit**

- Pattern-level references: local Orbit Matter Observatory (11/20), 21st Integration Showcase and
  Integrations Grid (8/20 each). Radial Orbital Timeline and Orbiting Circles were rejected because
  they contradict the frozen creative decision.

### 6. Status ledger and CTA — Know what exists

**Content and visual**

- Visible “Today on Arc testnet” block: owner account setup, mandate-oriented payment flow,
  browser-owned direct actions, separately scoped agent signer, implemented payment-rule check and
  explicit fixture/mock labels.
- Visible “Broader Gol design target” line: multi-market/multi-chain account and adapter model has not
  shipped.
- Preserve the full current `prototypeToday` and `designTargets` arrays inside keyboard-accessible,
  server-rendered disclosures so no truth is removed for brevity.
- Repeat the unresolved requirement that mandatory real-user browser acceptance under the current
  KMS-backed signer remains pending. Do not reframe local automated tests as that evidence.
- The consequence line ends at the primary `/app` CTA and the closer `Set the limit. Send the agent.
  Keep the proof.` Secondary repository/spec links remain only if they already have stable targets.

**Responsive and motion**

- Desktop uses a 7/5 status/CTA split; mobile uses one column with status before CTA.
- The final line can draw once as progressive CSS enhancement. CTA hover and focus use existing
  Button behavior; no circular custom hover target is copied.

**Acceptance**

- A visitor can distinguish implemented Arc scope from design targets without opening a disclosure.
- Opening disclosures exposes every current list item with no JavaScript or layout overflow.
- Final CTA remains at least 44px high and its label accurately says prototype.

**Research fit**

- The line-to-action relationship takes pattern-level inspiration from Salle Blanche CTA (14/20).
  Its GSAP circle, imagery and pointer-only treatment are not used.

## Component and file plan

The implementation should be a focused refactor inside the existing landing architecture. Do not
touch product routes, server adapters, wallet code, protocol code or deployment configuration.

| File | Current role | Planned change |
| --- | --- | --- |
| `web/app/page.tsx` | Root route and landing metadata | Keep static route; shorten metadata description only if required to match final copy; preserve relative canonical/OG URL resolution |
| `web/app/layout.tsx` | Root fonts and metadata base | No visual-redesign change; keep `publicOrigin` and current font setup |
| `web/src/content/site.ts` | Checked-in public metadata origin | No change; do not couple to product runtime config |
| `web/src/content/landing.ts` | Typed landing copy and arrays | Replace verbose duplicate strings with section-scoped copy, fixed illustrative request outcomes and one claim-state legend; retain complete status arrays |
| `web/src/components/landing/landing-page.tsx` | Composes seven current sections | Compose the six beats in semantic order; keep server component and skip-link target |
| `web/src/components/landing/landing-header.tsx` | Header/nav/CTA | Update anchor IDs/labels; keep compact server-rendered navigation |
| `web/src/components/landing/landing-hero.tsx` | Hero and static refusal card | Become server shell for the short headline, disclosure, CTAs and no-JS final-state fallback |
| `web/src/components/landing/mandate-gate-demo.tsx` | New | Small `'use client'` illustrative state island using existing shadcn controls; fixed local data only |
| `web/src/components/landing/enforcement-layers.tsx` | Four prose cards | Replace with the one durability rail comparison; keep server component |
| `web/src/components/landing/policy-gate.tsx` | Five path cards and three role cards | Replace export with `MandateBento`; combine owner/agent gate and controls here, or rename to `mandate-bento.tsx` and delete this file in the same patch |
| `web/src/components/landing/mandate-controls.tsx` | Four control cards | Fold into `MandateBento` and delete; do not leave unused duplicate content |
| `web/src/components/landing/receipt-model.tsx` | Three equal receipt cards | Render the semantic layered receipt stack; keep server component |
| `web/src/components/landing/market-vision.tsx` | Eight market cards | Render the generic adapter topology and compact endpoint list |
| `web/src/components/landing/product-status.tsx` | Two large status lists | Render concise status ledger plus complete disclosures and CTA handoff |
| `web/src/components/landing/landing-primitives.tsx` | Section wrappers/labels | Add only reusable semantic wrappers needed by the six rhythms; avoid reintroducing a universal card silhouette |
| `web/src/components/landing/landing-footer.tsx` | Footer links/status | Remove duplicate prose while preserving status and stable links |
| `web/src/components/ui/disclosure.tsx` | New, only if disclosure is used | Reusable server-safe native `details/summary` wrapper so feature components follow the UI primitive rule |
| `web/src/components/ui/button.tsx` / `tabs.tsx` | Existing shadcn controls | Reuse unchanged unless an independently justified accessibility fix is required |
| `web/app/globals.css` | Tailwind theme/tokens/keyframes | Add named semantic tokens and keyframes only; no page/component selectors and no gradients |
| `web/tests/landing-content.test.ts` | Content/claim checks | Update copy budgets, complete truth arrays, sample outcomes and banned-claim assertions |
| `web/tests/e2e/landing.spec.ts` | Landing flow/a11y/responsive checks | Add interaction, no-JS, reduced-motion, metrics, focus and overflow coverage |
| `web/tests/e2e/capture.spec.ts` | Screenshot capture | Update stable section waits/anchors if required and capture matching desktop/mobile themes |
| `THIRD_PARTY_NOTICES.md` | Current third-party notices | No change expected because no reference code/asset/dependency is imported |

If the file is renamed to `mandate-bento.tsx`, the implementation report must explicitly list the
deletion of `policy-gate.tsx` and `mandate-controls.tsx`; do not leave both old and new sections in
the bundle.

### Data and state shape

Keep content serializable, local and immutable:

```ts
type ClaimState = 'implemented-arc-prototype' | 'proposed-model' | 'design-target' | 'illustrative';

type IllustrativeRequest = {
  id: 'within-limit' | 'over-limit';
  amountUsd: 100 | 101;
  limitUsd: 100;
  outcome: 'allowed' | 'refused';
  rule: 'PER_TX_CAP';
  headroomUsd: 0 | 100;
};
```

The sample is presentation data, not a policy evaluator. The client component receives the two
records as props or imports them from the browser-safe content module. It must not import from
`src/server`, `src/wallet`, `@gol/agent`, route handlers or environment parsing. Do not add fetch,
RPC, Privy, wallet or telemetry calls to `/`.

## PRD traceability

This matrix maps every requirement that belongs on a public landing page. Deep implementation,
competitive tables and open-question detail remain in the PRD/specs rather than being compressed
into marketing claims.

| PRD source | Required truth | Landing expression | Files | Acceptance evidence |
| --- | --- | --- | --- | --- |
| §1 What Gol is | One financial account with owner-set boundaries and an agent inside them | Hero headline/support and central boundary | `landing.ts`, `landing-hero.tsx`, `mandate-gate-demo.tsx` | H1/support semantic snapshot |
| §2 Failure prevented | A prompt/framework/server is not the final authority | Enforcement durability rail | `enforcement-layers.tsx` | Four labels and outcomes present |
| §3.4/§11 Hard rules | Account is product, mandate enforcement cannot be optional, owner stays in control | Mandate bento plus visible owner/agent lanes | `policy-gate.tsx` or `mandate-bento.tsx` | Text assertions for owner/agent/account |
| §3.5 Honest objection | Broad thesis is not proof complete product exists | Hero disclosure and status ledger | `landing.ts`, `landing-hero.tsx`, `product-status.tsx` | “has not shipped” visible without disclosure |
| §4 Three roles | Owner, agent and venue are distinct | Lanes in mandate section; venue at network edge | `mandate-bento.tsx`, `market-vision.tsx` | DOM order and exact role labels |
| §4a/§6 Layer 1 | Shared account/mandate substrate under product surfaces | Boundary persists from hero through network | all visual sections | Visual review plus semantic text |
| §6/§8.1 Account | Amount/destination/execution/lifecycle bounds, nonce/revocation/recovery | Mandate bento's four surfaces | `landing.ts`, `mandate-bento.tsx` | All control terms asserted |
| §6/§8.2 Agent | Scoped agent authority; unavailable checks fail closed; owner lane is distinct | Parallel lane labels and gate route | `mandate-bento.tsx` | `fail-open`/`fail-closed` text checks |
| §8.3 Refusal record | Lead with what was stopped; keep reason and remaining headroom | Hero signature result and front receipt | `mandate-gate-demo.tsx`, `receipt-model.tsx` | `$101`, `PER_TX_CAP`, `$100` present |
| §8.3a Outcome verification | Promise and actual outcome are twins to refusal; verification fields are designed early | Three-sheet promised/actual/refused stack | `landing.ts`, `receipt-model.tsx` | Field/value and ordered-title tests |
| §8.4 Execution Brain | Planner may route but is not final authority or a venue | Network copy and gate-first ordering | `market-vision.tsx` | Exact boundary sentence |
| §8.5 Markets | Show breadth across all named category families | Eight endpoint labels in topology/list | `landing.ts`, `market-vision.tsx` | All eight names, one group qualifier |
| §8.6 Growth | Growth reads evidence but does not write mandates | One mandate footnote | `mandate-bento.tsx` | Exact no-write assertion |
| §8.7 Surfaces | Consumer should approve understandable outcome, not opaque transaction sequence | Receipt caption and prototype CTA framing | `receipt-model.tsx`, `product-status.tsx` | Copy assertion |
| §9 Winning demo | $100 limit and $101 agent request refused independent of server | Hero visual and enforcement invariant | hero + enforcement files | Keyboard interaction and no-network test |
| §10 Licensed slot | GOL routes to licensed/regulated providers and is not one | Generic adapter edges; no logos/partner claims | `market-vision.tsx` | `GOL is not the venue`; banned-logo review |
| §11/§11a Signer/account authority | A signer may refuse; only account policy may permit agent payment | Concise bento footnote | `mandate-bento.tsx` | Exact authority assertion |
| §11b/§12 Build vs rent | Use adapters/providers; do not build venues or custody | Network topology and copy | `market-vision.tsx` | No custody/venue claim |
| §13 Current state | Separate live-verified, built/not independently verified, unmade claims and known gaps | Visible Arc status plus full disclosures | `landing.ts`, `product-status.tsx` | Complete list unit tests |
| §13.5 Integration risk | Real-user browser acceptance under current KMS signer remains pending | Visible pending-evidence line | `product-status.tsx` | Exact pending string |
| §14 Competitive boundary | Aggregators and venues are adapters/edges, not what Gol becomes | Generic adapter topology | `market-vision.tsx` | No named competitor/partner in visible UI |
| §16/§17 Open questions/risks | Do not imply universal support, audit or production readiness | Status disclosure and banned-claim suite | `landing.ts`, tests | Negative-string tests |
| §18 Doors | CTA should route to the honest current product door | `Explore Arc testnet prototype` to `/app` | hero/header/status/footer | Link target tests |
| §19 Quick reference | Preserve concise model, roles, mandate, records and current status | Six-beat narrative | composition/content | Content inventory review |
| §20 What document is not | Product blueprint is not shipped evidence | Status label and no deployment assertion | hero/status/metadata | Visible disclosure and report wording |

### Intentionally excluded PRD detail

- Version ladder/build-order detail (§7/§7a) stays in planning docs; it is not a user-facing feature.
- The full seven-layer technical taxonomy (§6) is compressed into causal visuals; layer names are not
  repeated as prose.
- Competitive matrices/watchlist (§14), team history (§15), detailed open questions (§16) and risk
  register (§17) remain linked documentation, not landing claims.
- Licensed-provider examples (§10) remain generic. The page does not name a partner without dated
  evidence and does not imply GOL holds a license.

## Visual system implementation rules

### Tokens and Tailwind

- Continue Tailwind v4 and shadcn semantic tokens. Add at most named variables for consequence-line
  width, ledger offset and motion durations in the `@theme inline` block.
- Feature components use utilities only. Do not add CSS modules, inline static style objects,
  arbitrary colors, arbitrary shadows or page/component selectors.
- Lines are borders/pseudo-elements attached to semantic containers. The official GOL mark comes
  from `web/public/gol-mark-blue.svg` or the existing `GolLogo` primitive. Do not trace or hand-code
  new SVG in feature files.
- Avoid `Card` when a semantic `section`, `ol`, `dl`, `figure` or `article` communicates the object
  more honestly. If a surface is interactive, use the appropriate existing/new shadcn primitive.
- No third-party CSS, screenshot-derived coordinates or downloaded media enters the repository.

### Composition tokens

- Content maximum remains `max-w-7xl`, but proof visuals may span grid columns and touch section
  edges within the container.
- Use three radii at most: existing button/input radius, `rounded-card` for evidence sheets and a
  circular policy boundary. Avoid pill badges except actual compact claim/status labels.
- Use one shadow token (`shadow-panel`) only on the front refusal receipt or active gate; background
  sheets use borders and offset, not progressively larger shadows.
- Maintain current light/dark semantic palette and verified contrast pairs. Destructive red is
  reserved for actual refusal/error semantics, never ambient decoration.

## Motion specification

| Motion | Trigger | Duration/easing | Property budget | Reduced-motion/static behavior |
| --- | --- | --- | --- | --- |
| Request travels to gate | one initial run and explicit replay | 500–650ms, existing emphasized easing token | `transform`, `opacity` | request shown at gate immediately |
| Gate decision | after request arrival | 160–220ms | border color/token, `transform` ≤1.02 | final allowed/refused label immediate |
| Refusal unfolds into receipt | after refused decision | 360–480ms | `transform`, `opacity` | receipt in final front position |
| Enforcement rails resolve | progressive view timeline only | ≤500ms total | scale transform/opacity | static final rail states |
| Receipt sheets fan | progressive view timeline or focus-within | ≤400ms | transform | already fanned, no transition |
| Network edge emphasis | view entry once | ≤450ms | opacity/background-position only if tokenized | all edges static and visible |
| CTA focus/hover | direct interaction | existing Button timing | border/background/transform ≤1px | focus ring remains, transform removed |

Define a single `@media (prefers-reduced-motion: reduce)` block that sets landing animation and
transition durations to zero and disables view timelines. Do not use Motion/Framer Motion for this
redesign: CSS plus the request island's class/state changes can express the exact choreography at
lower cost. Reconsider that decision only if implementation proves state continuity cannot be made
accessible with CSS; any change requires a measured bundle delta and report deviation.

## Responsive and zoom behavior

Test source order first, then visual placement:

- **320–639px:** single-column story; vertical consequence rail; two-column market labels may collapse
  to one at 320; no card overlap; status disclosures follow CTA-independent DOM order.
- **640–1023px:** stacked hero with horizontal proof rail, amount bento full-width, two-column
  supporting cells and compact market grid.
- **1024–1439px:** asymmetric hero, 12-column bento, layered receipt composition and three-stage
  topology.
- **≥1440px:** keep max content width; increase quiet space rather than type/card count.
- **200% zoom at 1280 CSS pixels:** content reflows without overlap, clipped focus indicators or
  horizontal page scroll.
- **400% zoom / 320 CSS pixels:** all claims, receipt values and CTA labels remain available in normal
  flow.

Do not hide content on mobile. Decorative line segments may disappear when they no longer map to
reading order, but their textual relationship must remain.

## Accessibility plan

- Preserve the skip link, `main#main-content`, one H1 and monotonic H2/H3 hierarchy.
- Use `figure`/`figcaption` for visuals that need a caption, ordered lists for paths, definition lists
  for receipt fields and explicit visually-hidden text where overlap would otherwise duplicate
  labels.
- Request options have accessible names with amounts, expose selected state, and work with Tab,
  arrow/Enter/Space as appropriate to the chosen shadcn primitive. Replay never changes focus.
- The result region has a stable heading and `aria-live="polite"`; do not announce intermediate
  animation frames or duplicate the initial server-rendered fallback.
- Allowed/refused state uses text plus icon/border. Icons come from `lucide-react`, are decorative
  when text already names the state and use `aria-hidden="true"` then.
- Disclosures have programmatic expanded state, visible focus and complete labels. No essential
  status is collapsed.
- Preserve ≥4.5:1 normal-text contrast and ≥3:1 large text/non-text boundary contrast in both themes.
- Maintain 44×44 touch targets, visible focus rings, logical tab order and no keyboard trap.
- Validate at 200%/400% zoom, Windows/high-contrast-like forced colors where practical, no-JS and
  reduced-motion settings.

## Performance plan

- Keep `/` statically renderable. The only `'use client'` file is `mandate-gate-demo.tsx`; do not
  hoist client state into `LandingPage` or the whole hero.
- No added package, external request, video, raster image, canvas, WebGL, Three/R3F, GSAP, Lenis or
  remote font. Existing `next/font` remains self-hosted by the build.
- Lazy hydration is not required for the above-the-fold request island; prioritize immediate control
  readiness. Keep its props small and fixed.
- Animate only transform/opacity where possible; avoid layout animation, DOM measurements and scroll
  listeners. CSS view timelines are optional progressive enhancement with a static default.
- After `next build`, compare route chunks against the recorded 579,140 raw / 178,495 gzip shared
  baseline using the same static-file method. Record total and incremental route JS honestly; target
  ≤15 KiB gzip landing-specific incremental client code.
- Run Lighthouse against the production build on mobile throttling. Targets: performance ≥90,
  accessibility ≥95, SEO ≥95, LCP ≤2.5s, CLS ≤0.05 and INP proxy/TBT ≤200ms. Treat local lab data as
  local, not field or deployment evidence.

## SEO and metadata

- Preserve the confirmed public-origin boundary. `https://gol.network` is supported by
  `spec/deployment-status.md` reviewed 10 September 2026, `deploy/README.md` and `README.md`, and is
  centralized in `web/src/content/site.ts` strictly for metadata URLs.
- Keep canonical, robots, sitemap, root `metadataBase`, OG and Twitter metadata derived from that one
  constant or relative route URLs. Do not use product runtime configuration, `NEXT_PUBLIC_*`,
  browser environment reads or `/api/config` for landing metadata.
- Update title/description only if the new short promise makes current social copy inaccurate; retain
  `proposed account model` and Arc-prototype qualification in description.
- Keep one H1, meaningful section headings, crawlable default refusal/status content and stable
  anchor IDs. Do not hide the only product explanation in client state.
- Generated OG/Twitter imagery remains text/owned-brand only. No archive or 21st.dev image is allowed.

## Trust, data and configuration boundaries

- The illustrative request is deterministic presentation state and must be labeled `Illustrative`.
  It neither calls nor reimplements contract policy and cannot produce a transaction hash.
- `/` must not import server-only modules, database/RPC clients, Privy, wallet actions,
  `publicConfigResult`, agent code or signer material.
- Owner direct actions remain owner-signed/fail-open; the agent lane remains separate and fail-closed
  when a required check is unavailable. Visual merging must not collapse these lanes.
- Signer refusal is defense in depth; the account policy is the only permitting boundary for the
  implemented agent payment. Preserve this exact direction of authority.
- Market breadth is a design target. GOL is an account/policy/planning layer, not a venue,
  custodian, licensed institution, token issuer or guarantee of returns.
- Current source/evidence can support the Arc testnet prototype and dated public origin. It cannot
  support production readiness, universal support, independent security audit or completed
  real-user KMS-backed browser acceptance.
- All hrefs are compile-time internal routes/anchors or existing stable repository links. Validate
  anchors and use `Link`/shadcn Button patterns; no untrusted URL input enters the page.

## Provenance and licensing decision

No downloaded or 21st.dev component, source fragment, SVG path, image, font, logo or CSS is approved
for import. Local sources overwhelmingly lack standalone license evidence (924 of 1,103 candidates),
and the highest-value ideas are generic patterns: causal line, uneven bento, layered documents,
mobile de-pinning and bounded topology.

### Source-pattern key

These are the exact references named by section. Full hashes, adjacent styles and inspection notes
are in external `local-shortlist.json` and `21st-dev-audit.jsonl`.

| Plan pattern | Exact provenance | Allowed influence |
| --- | --- | --- |
| Local Scroll-powered SVG stroke | channel `1048241543477215275`, message `1447082987219976333`, attachment `1447082986943025162`, `codegrid-scroll-powered-svg-stroke-nextjs/src/app/page.js`, SHA-256 `6aadd256…ed80e` | Cause/effect ordering only |
| Local Oreana `MissionStack` | channel `1112149715237228635`, message `1543398527626125334`, attachment `1543398527277858866`, `CGMWTAUGUST2026/oreana/src/components/MissionStack/MissionStack.jsx`, SHA-256 `cffec4ee…d463a` | Layered-document metaphor only |
| Local Oreana `MissionFeatures` | same Oreana attachment, `src/components/MissionFeatures/MissionFeatures.jsx`, SHA-256 `d0c05dfd…a4824` | Unequal grid hierarchy only |
| Local House of Epochs `FeaturedCards` | channel `1112149715237228635`, message `1487358199756750868`, attachment `1487358199416750161`, `CGMWTMARCH2026/house-of-epochs/src/components/FeaturedCards/FeaturedCards.jsx`, SHA-256 `3cb20f72…bc03` | Desktop-to-mobile de-pinning rule only |
| Local Salle Blanche CTA | channel `1112149715237228635`, message `1475942672123302100`, attachment `1475942671691415634`, `CGMWTFEB2026/salle-blanche/src/components/CTA/CTA.jsx`, SHA-256 `08de51b4…c88e7` | Line resolving into action only |
| Local Orbit Matter Observatory | channel `1112149715237228635`, message `1443863279280721981`, attachment `1443863279054094456`, `CGMWTNOV2025/orbit-matter/observatory.html`, SHA-256 `8a583a8c…c14` | Bounded topology only |
| 21st Animated Beam | `https://21st.dev/@dillionverma/components/animated-beam` | Measured-node request path; recreate locally |
| 21st Agent Trace | `https://21st.dev/@n1m4mz/components/agent-trace` | Compact evidence-state replay idea |
| 21st Feature Bento | `https://21st.dev/@uilayout.contact/components/feature-bento` | Section hierarchy only |
| 21st Cards Stack | `https://21st.dev/@youcefbnm/components/cards-stack` | Layer ordering and mobile caution |
| 21st Scroll Reveal Content A | `https://21st.dev/@abui/components/scroll-reveal-content-a` | Three-state synchronized narrative only |
| 21st Integration Showcase | `https://21st.dev/@ravikatiyar162/components/integration-showcase` | Hub/edge composition without logos |

Ellipsized hashes above are display abbreviations only; machine-readable artifacts contain complete
hashes. No provenance row is a permission to copy.

The official 21st.dev Info panel stated MIT for several components, including Animated Beam, Bento
Grid, Agent Trace, Cards Stack and Background Paths. Their implementation source remained locked in
the anonymous browser session. Even where technically eligible to install, this plan selects an
original, smaller implementation using existing repository primitives. Therefore:

- no registry/CLI install;
- no dependency change;
- no third-party notice change;
- no remote/CDN asset;
- new code comments may cite `spec/landing-page-visual-redesign-plan.md`, not copied source URLs;
- implementation report records the external audit path and confirms zero copied artifacts.

If implementation later proposes copying or installing any reference, stop and perform a separate
license/source review with exact upstream version/hash; do not infer permission from a preview.

## Test strategy and acceptance suite

### Vitest content/boundary tests

Update `web/tests/landing-content.test.ts` to verify:

1. Hero copy contains owner, mandate/account boundary, Arc prototype and `has not shipped` truth.
2. The exact two illustrative fixtures are `$100/$100 allowed` and `$101/$100 refused` with
   `PER_TX_CAP` and `$100` remaining headroom.
3. `prototypeToday` and `designTargets` retain every currently documented item, including pending
   mandatory real-user KMS-backed browser acceptance.
4. The eight market categories remain present while the group, not each item, is labeled design
   target.
5. Owner fail-open, agent fail-closed, signer-can-refuse/account-can-permit, growth-read-only and
   GOL-not-venue statements remain exact.
6. Visible-copy source strings stay within their section budgets and repeated qualifier counts.
7. A banned-claim table rejects `live multi-market`, `universal support`, `production ready`,
   `audited`, `guaranteed yield`, `custody`, `partnered with` and token-launch language unless future
   dated evidence deliberately changes the assertion.
8. Landing content imports no runtime config/server/wallet/agent module. Keep the existing origin and
   metadata boundary tests intact.

Pure fixture/outcome selection can be extracted into a small browser-safe function and unit tested,
but it must remain a lookup over fixed demonstration records—not a policy engine.

### Playwright behavior and semantics

Update `web/tests/e2e/landing.spec.ts` with focused cases:

- `/` renders header, one H1, six labeled main sections, primary `/app` CTA and complete default
  refusal/status truth.
- Selecting/running `$100` yields `Allowed` and `$101` yields `Refused: PER_TX_CAP`; each transition
  is keyboard-operable and triggers one polite result announcement.
- The interaction causes no `/api/`, RPC, third-party or cross-origin request and creates no wallet
  prompt.
- All header/footer anchors resolve to existing element IDs and the `/app` label contains
  `prototype`.
- Tab order reaches request options, replay, CTA and disclosures logically; focus remains visible.
- With JavaScript disabled, the default refusal result, claim disclosure, market status and CTA are
  readable; the page does not show broken controls.
- `page.emulateMedia({ reducedMotion: 'reduce' })` yields final-state visuals and zero computed
  non-zero durations on marked landing motion elements.
- At widths 320, 390, 768, 1024 and 1440, `scrollWidth <= clientWidth`; key labels have non-zero
  bounding boxes and no receipt/control text is visually clipped.
- At 390×844 the collapsed page is ≤9 viewport heights; at 1440×900 it is ≤6.5.
- Touch CTAs/controls are ≥44×44; one H1 and monotonic headings remain.
- Light/dark screenshots capture the six different rhythms and compare against intentionally updated
  snapshots/evidence, not the old page pixel-for-pixel.

Add `@axe-core/playwright` only if it is already transitively available and repository policy allows
it; otherwise do not change dependencies just for this plan. Run existing semantic/contrast checks
and an Orca browser accessibility snapshot. Automated checks supplement, not replace, manual screen
reader/keyboard review.

### Visual review matrix

Use the production server, not only Next dev:

| Viewport/theme | Required visual evidence |
| --- | --- |
| 1440×900 light | Hero consequence, enforcement strip, bento asymmetry, receipt depth, topology, final CTA |
| 1440×900 dark | Same hierarchy and refusal/primary contrast; no low-contrast line loss |
| 768×1024 light | Intermediate bento/topology transform without awkward orphan surfaces |
| 390×844 light | Vertical line, fanned receipts, concise status and ≤9 viewport total |
| 390×844 dark | No clipped values, borders remain distinguishable, focus ring visible |
| 320×800 light | No horizontal overflow or hidden claim text |
| 1280×720 at 200% zoom | Reflow, no overlap and usable disclosures |
| 390×844 reduced motion | Identical meaning, no travel/unfold transition |

Capture full-page evidence under a new dated directory such as
`/Users/nathan/Downloads/Gol Network Login Flow/verification-evidence/redesign-2026-09-11/` and list
exact paths/checksums in the implementation report. Use Orca's embedded browser for semantic and
visual review; do not claim visual verification from automated tests alone.

## Exact validation commands

Run narrow checks while iterating, then the affected web suite. Node must be 22 and pnpm 11.17.0.

```bash
corepack pnpm --filter @gol/web typecheck
corepack pnpm --filter @gol/web test -- landing-content.test.ts
corepack pnpm --filter @gol/web exec playwright test tests/e2e/landing.spec.ts
corepack pnpm --filter @gol/web build
corepack pnpm --filter @gol/web test:e2e
corepack pnpm format:check
git diff --check
```

For production visual review:

```bash
corepack pnpm --filter @gol/web start --hostname 127.0.0.1 --port 3111
```

If the checked-in Playwright config already owns server startup, use its command instead of starting
a second server. Do not run operator preflight, policy probe or deployment commands; the redesign
does not require credentials or live state.

Record exact exit codes, test counts, skipped tests, browser/viewport details and build route
classification. If the complete e2e suite exposes unrelated pre-existing failures, separate those
with the baseline/reproduction command; do not hide them or call the suite passing.

## Implementation sequence

### Phase 0 — establish a clean measurement harness

1. Preserve the current dirty tree and record `git status --short`; do not overwrite unrelated
   changes.
2. Run the current focused landing test and save baseline height/word/script measurements using the
   evaluator documented in external `baseline.json`.
3. Confirm the current public-origin evidence remains dated and consistent; do not touch it during
   visual work.

**Gate:** baseline is reproducible and no unrelated file is staged/modified by the task.

### Phase 1 — content compression without truth loss

1. Reshape `landing.ts` into hero, enforcement, mandate, receipts, network and status copy.
2. Add the fixed illustrative requests and central claim-state vocabulary.
3. Update unit tests before components; assert complete status lists and banned claims.

**Gate:** ≤500-word planned strings at collapsed default, all PRD truth tests pass.

### Phase 2 — static semantic composition

1. Reorder `LandingPage` into six beats.
2. Build hero fallback, enforcement rail, mandate bento, receipt stack, adapter topology and status
   ledger as server components using Tailwind/shadcn primitives.
3. Remove superseded policy/control card code in the same change.
4. Update header/footer anchors and eliminate duplicate status language.

**Gate:** JavaScript-disabled e2e passes; one H1, correct headings, all claims visible; no client code
outside the future request island.

### Phase 3 — one interaction and causal motion

1. Add `mandate-gate-demo.tsx` with fixed local state and existing shadcn controls.
2. Add tokenized Tailwind keyframes to globals; implement final-state-first CSS.
3. Add reduced-motion and replay tests before tuning easing.
4. Add optional CSS view-timeline enhancements only after static layouts pass every viewport.

**Gate:** keyboard/touch/reduced-motion/no-network tests pass and bundle delta is within budget.

### Phase 4 — responsive and accessibility hardening

1. Validate 320/390/768/1024/1440, 200% and 400% zoom, both themes and forced/reduced motion.
2. Fix source-order/focus/overlap issues before aesthetic tweaks.
3. Verify contrast and touch targets, then run an Orca accessibility snapshot.

**Gate:** no horizontal overflow, no serious/critical automated accessibility issue, meaningful
visual count ≥6 and target page heights achieved.

### Phase 5 — production verification and report

1. Run typecheck, unit tests, production build, focused e2e, full web e2e, format check and diff check.
2. Inspect the production build in Orca and capture dated desktop/mobile/theme/reduced-motion evidence.
3. Measure route JS, page length, words, panels and meaningful visuals with the baseline method.
4. Audit diff for imports, native controls outside UI primitives, hand-coded SVG, arbitrary styling,
   gradients/glows, remote assets, claims, secrets and accidental reference code.
5. Write the implementation report with deviations and unresolved risks; do not claim deployment.

**Gate:** all affected checks pass or every failure is explicitly bounded; report contains exact
files and evidence paths.

## Risk register and mitigations

| Risk | Likelihood / impact | Mitigation and stop condition |
| --- | --- | --- |
| Compression removes a qualifier | Medium / high | Unit-test complete claim inventory; visible status remains before disclosure; stop if truth requires >500 words and raise budget explicitly |
| Illustrative UI is mistaken for real policy execution | Medium / high | `Illustrative` label, fixed lookup data, no network/wallet imports, no transaction hash, no interactive arbitrary amount |
| Signature animation becomes the product | Medium / medium | One run, ≤1.3s combined, no loop, final-state-first, reduced-motion instant result |
| Client boundary spreads | Medium / high | Only `mandate-gate-demo.tsx` has `'use client'`; bundle/import audit and ≤15 KiB gzip target |
| CSS lines fail at breakpoints/zoom | Medium / medium | DOM source order is truthful without lines; explicit vertical mobile form and zoom matrix |
| Receipt overlap hides text | Medium / high | Default fanned mobile/reduced state; 200%/400% tests; cap transforms |
| Market topology implies live partners/support | Medium / high | Generic adapter/category labels, one group `Design target`, exact `GOL is not the venue`, no logos |
| Owner and agent lanes visually merge | Low / high | Separate labeled rails and DOM groups; explicit fail-open/fail-closed tests |
| View-timeline support is inconsistent | Medium / low | Static final state is canonical; enhancement only in `@supports`; no dependency on scroll state |
| Light/dark line contrast fails | Medium / medium | Existing semantic tokens and manual contrast checks; lines are never sole meaning |
| 21st/archive pattern becomes accidental copied code | Low / high | No installs/imports/assets; final hash/provenance audit; stop for separate license review if proposed |
| Existing dirty tree causes overlap | Medium / high | Inspect diff per file, preserve unrelated changes, never reset/checkout; coordinator resolves true conflict |
| Metadata origin drifts during refactor | Low / high | Leave site/origin files untouched; retain existing origin tests and dated evidence references |
| Local lab results are described as deployed | Low / high | Report labels local build/browser results; deployment evidence is not rewritten |

## Definition of ready for implementation

Implementation may begin when the team accepts the frozen creative concept, six-beat IA, word/height
budgets and the single-client-island boundary. It is complete only when the PRD traceability matrix,
visual matrix, affected tests/build, provenance audit and metric targets pass with documented
evidence. This plan itself makes **no deployment or implementation claim**.
