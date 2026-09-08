# GOL submission copy

Status: copy-ready draft for the authenticated submission form. Replace every bracketed field with verified live evidence. Do not submit while placeholders remain.

## Identity

Name: GOL

Emoji: 🎯

Short description, 88 characters:

> An agent payment account that enforces limits and explains on-chain refusals with proof.

Category: finance and payments

Network: Arc testnet

Source URL: `[PUBLIC_REPOSITORY_URL]`

Live demo URL: `[PUBLIC_HTTPS_DEMO_URL]`

Contract: `[VERIFIED_GOL_ACCOUNT_OR_FACTORY_URL]`

Subgraph: `[GRAPH_DEPLOYMENT_OR_QUERY_URL_WITHOUT_API_KEY]`

Video: `[PUBLIC_VIDEO_URL]`

## Description

GOL helps a small business owner let an AI operations agent pay an approved contractor in USDC on Arc testnet without handing the model open-ended wallet authority. The owner signs a mandate with a per-payment cap, cumulative budget, recipient allowlist, and expiry. A separate scoped agent wallet submits requests, while the immutable account contract either transfers the allowed amount or persists a policy refusal. The Graph indexes both outcomes so the owner can ask what happened and follow a cited transaction. GOL verifies payment execution, not invoices, identity, or work delivery.

## How it is made

GOL combines a Solidity factory and USDC-only account, a durable TypeScript payment worker, Privy owner authentication plus a policy-restricted agent signer, a Next.js interface, PostgreSQL recovery state, OpenAI Responses with strict structured output, and an Arc testnet subgraph. Owner funding, mandate, revoke, and withdrawal actions are signed directly in the browser. The backend signer is limited to the configured chain, account, and zero native value, while the contract independently enforces recipients and budget. Executed and Refused events are queried through The Graph with freshness metadata and explorer citations. Tests cover contract behavior and invariants, exact decimal parsing, journal recovery, query grounding, routes, mappings, and the browser flow.

## Partner-specific explanation

### Arc

GOL uses official Arc testnet USDC and demonstrates controlled contractor payments. The contract records an allowed 40 USDC transfer and a later 70 USDC cumulative-budget refusal with 60 USDC remaining. The working frontend, backend, architecture, and operations guide are included. No Circle Agent Stack or mainnet-readiness claim is made.

### The Graph

The custom subgraph indexes account, mandate, execution, refusal, revoke, and withdrawal events. The application uses live provider results as the source for activity and natural-language answers. Each answer exposes the deployment, indexed block, freshness, and transaction citation. Local fixtures are clearly labeled and are not partner evidence.

### Privy

Privy authenticates the owner wallet and provisions a separate user-owned agent wallet with a backend additional signer. A Privy policy restricts the signer to the Arc chain, linked GOL account, and zero native value. Owner-only actions remain browser-signed, and the account contract remains the budget authority. Show one permitted call and one wrong-destination denial in the live demo.

## AI use disclosure

OpenAI Codex assisted with specification review, implementation, tests, documentation, and visual asset generation. The prompt records are committed under `spec/prompts/`. The product's runtime model uses OpenAI Responses only to parse bounded payment text into a strict recipient and amount schema and to phrase read-only answers from Graph records. It has no wallet tool, request-ID authority, policy authority, transaction-status authority, or owner credential. Anderson supplied product choices, approved implementation, owns all external account consent, and must narrate and submit the final demo.

## Final replacement checklist

- Replace all bracketed URLs.
- Add actual contract and subgraph identifiers.
- Confirm selected prize categories in the authenticated dashboard.
- Confirm form character counters and media dimensions in the dashboard.
- Attach three screenshots from the live deployment, not the local fixture captures.
- Upload and watch the complete human-narrated 2 to 4 minute video.
