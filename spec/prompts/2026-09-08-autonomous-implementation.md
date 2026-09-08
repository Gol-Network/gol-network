# Autonomous implementation prompt

Use this prompt to implement the GOL ETHOnline project from the `gol-network` repository root.

```text
Implement the complete GOL ETHOnline product in the current repository.

Work autonomously until all application code, local infrastructure, tests, documentation, and deployment preparation are complete. Stop only when external deployment and human submission actions are the remaining work.

READ FIRST

Read these files in order:

1. gol-ethonline-build-spec.md
2. spec/hackathon-product-spec.md
3. spec/architecture.md
4. spec/implementation-plan.md
5. spec/submission-checklist.md
6. spec/studio-setup.md

Current user instructions and these active specifications govern implementation. Resolve routine technical decisions yourself. When a dependency or API assumption is uncertain, check official documentation and choose the smallest implementation consistent with the specifications.

PROJECT BOUNDARY

GOL is a new Start Fresh project for ETHOnline. Write all project-specific application code, contracts, tests, designs, prompts, and assets during the hackathon. Use only public libraries and starter scaffolds with exact attribution and license notices.

Do not inspect, copy, adapt, or derive code, tests, designs, assets, configurations, addresses, secrets, comments, or implementation structures from private or pre-existing product repositories.

Keep every change inside this repository. Do not create nested Git repositories or submodules.

AUTONOMY

- Do not stop after planning, scaffolding, contracts, or one successful test.
- Continue through the implementation plan milestone by milestone.
- Do not ask routine implementation questions.
- Preserve the approved product scope and acceptance demo.
- When external deployment is required for validation, complete all code, tests, configuration templates, and scripts first. Record the remaining live validation and continue with independent work.
- Do not fabricate deployments, transaction hashes, provider responses, test counts, feedback, or completed integrations.
- Never write credentials into source, fixtures, logs, prompts, commits, or browser bundles.
- Never use an em dash or en dash in authored text.

GIT BOUNDARIES

- Use the repository-local Git identity already configured.
- Commit locally in small, meaningful increments after each working slice passes its checks.
- Preserve honest chronological history.
- Do not backdate, squash, or manufacture commits.
- Do not push.
- Do not create pull requests.
- Do not change global Git configuration or the global GitHub CLI account.
- Do not deploy contracts, subgraphs, infrastructure, DNS, or application services.

PRODUCT

Build a full-stack, user-testable application for controlled AI-agent USDC payments on Arc testnet:

- Solidity account and factory contracts.
- Owner-authorized agent mandates.
- Per-payment cap.
- Cumulative spending cap.
- Recipient allowlist.
- Mandate expiry.
- Owner revoke and withdrawal.
- Authenticated agent payment execution.
- Persisted Executed and Refused records.
- Exact request idempotency and conflict handling.
- Standalone TypeScript agent runner.
- Developer CLI for pay, status, and ask.
- Next.js frontend and backend routes.
- Privy owner authentication and a separate restricted agent signer.
- Durable PostgreSQL request journal.
- Persistent payment worker with leases and reconciliation.
- Subgraph schema, mappings, templates, queries, and tests.
- Natural-language questions grounded in indexed Graph records.
- Accessible loading, pending, executed, refused, stale, unavailable, and failure states.
- Docker Compose services for web, worker, PostgreSQL, and cloudflared.
- CI workflows.
- Deployment, backup, restore, rollback, and health-check scripts.
- README, ARCHITECTURE.md, SKILL.md, FEEDBACK.md, attribution, and third-party notices.
- Local demo and evidence scripts.
- Submission copy and asset preparation where possible without deployment.

SCOPE

Arc testnet and USDC only.

Do not implement:

- Trading
- Swaps or routing
- Perps or yield
- Launchpad
- Cross-chain or multi-chain support
- Mobile or Telegram
- MCP
- Growth or quests
- Recurring budgets
- Account upgrades
- General arbitrary-contract execution
- ENS
- x402
- Additional partner integrations
- Mainnet support

REPOSITORY STRUCTURE

Create these units under the existing repository root:

contracts/
subgraph/
agent/
web/
packages/protocol/
deploy/
scripts/
assets/
spec/evidence/

Use one pnpm workspace for TypeScript packages and one Foundry project under contracts.

IMPLEMENTATION ORDER

1. Inspect the current Git state and active specifications.
2. Commit the reviewed specification set as the first local commit.
3. Establish the workspace, pinned toolchain, formatting, linting, type checking, and shared protocol package.
4. Implement contracts test-first, including policy boundaries, replay, concurrency, transfer rollback, and invariants.
5. Implement the subgraph schema, mappings, deterministic IDs, queries, and mapping tests.
6. Implement exact USDC amount parsing and shared runtime schemas.
7. Implement the durable PostgreSQL journal and worker reconciliation.
8. Implement the Privy adapter behind tested fake and real interfaces.
9. Implement the payment parser, submission path, receipt verification, and developer CLI.
10. Implement the Graph client, freshness model, pagination, grounded questions, and citation validation.
11. Implement the complete one-page web experience.
12. Implement Docker Compose, cloudflared configuration, database migration, backup, restore, health, and deployment scripts.
13. Implement CI and all required documentation.
14. Run the full local verification suite.
15. Review every P0 acceptance criterion and close every code-level gap.
16. Produce a precise deployment handoff containing only external deployment and live validation work.

ACCEPTANCE DEMO

The exact product proof is:

1. Owner creates a mandate with a 100 USDC cumulative cap and approved recipient.
2. Agent pays 40 USDC successfully.
3. Agent requests another 70 USDC.
4. Contract refuses it because only 60 USDC remains.
5. The refusal is independently inspectable through contract state and event data.
6. The Graph indexes the same refusal record.
7. The user asks why it was refused and receives an answer grounded in that indexed record with a transaction reference.

TESTING

At minimum, verify:

- The exact 100, 40, 70 acceptance scenario.
- Policy refusals persist because their transactions complete successfully.
- Unauthorized and malformed calls revert without false refusal records.
- Identical duplicate requests do not transfer twice.
- A duplicate request ID with a changed payload fails.
- Expiry and cap boundaries at one micro-USDC.
- Recipient and policy evaluation order.
- Concurrent requests cannot overspend.
- Insufficient balance and token failure roll back state.
- Owner identity remains immutable.
- The agent cannot withdraw, create mandates, revoke, approve, or execute arbitrary calls.
- The owner can revoke and withdraw without the agent or backend.
- Backend cross-user authorization.
- Worker recovery after interruption.
- No duplicate signing after an ambiguous provider response.
- Exact receipt and event validation.
- Deterministic Graph entities and stable pagination.
- Empty, stale, partial, unavailable, and indexing-error behavior.
- Question answers cannot invent records, values, or transaction links.
- Question handling cannot invoke signing.
- Browser wallet rejection, pending, executed, refused, stale, and failure flows.
- API keys and signing credentials never enter browser bundles.
- Wrong-chain configuration fails closed.

VERIFICATION

Run every relevant contract, TypeScript, subgraph, browser, lint, type-check, build, migration, and deployment-configuration check. Record exact commands, executed test counts, skipped live tests, remaining live validation, and known limitations.

Do not describe a check as passing unless it ran successfully against the current implementation.

DEFINITION OF DONE

The coding assignment is complete only when:

- All required source code exists.
- The complete application builds locally.
- All meaningful local tests pass.
- Docker images build for linux/arm64.
- Docker Compose validates.
- Database migrations and restore procedures are tested locally.
- Contracts compile and pass unit and invariant tests.
- The subgraph builds and mapping tests pass.
- The frontend and backend complete the acceptance flow using deterministic local adapters.
- Real provider adapters are implemented and configuration-validated without exposing secrets.
- CI configuration is complete.
- Documentation matches the delivered implementation.
- Every P0 requirement maps to implemented code or explicit live deployment validation.
- No excluded feature remains partially implemented.
- Git status contains no unintended changes.
- Local commits preserve the actual implementation sequence.
- A final handoff lists only contract deployment, subgraph deployment, provider configuration, hosting, DNS, production secrets, public smoke testing, screenshots, human narration, final push, and submission actions.

Do not perform those external deployment, publication, push, or submission actions.

Begin now and continue until this definition of done is satisfied.
```
