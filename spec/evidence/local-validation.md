# Local validation record

Date: 8 September 2026

Source: update this file with the final commit hash after external deployment. Commands below ran against the working tree immediately before its documentation commit, on Node.js 22.22.0 and pnpm 11.17.0.

## Application and contracts

| Check                          | Result                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`               | passed for protocol, agent, and web                                                                       |
| `pnpm test`                    | 17 protocol, 32 agent unit, 18 web, and 3 subgraph mapping tests passed; 3 credential-gated database tests skipped in this aggregate run |
| database-enabled agent suite   | not re-run in this pass; the Docker daemon was unavailable, so the three PostgreSQL journal tests skipped |
| `pnpm build`                   | protocol, agent, and the standalone Next.js image build passed                                            |
| `pnpm format:check`            | passed                                                                                                     |
| `pnpm --filter @gol/web test:e2e` | 1 passed; opt-in screenshot capture skipped in the standard run                                        |
| screenshot capture             | 2 passed with `GOL_CAPTURE_SCREENSHOTS=1`, including the mocked walkthrough                                |
| `pnpm --filter @gol/subgraph codegen` and `build` | passed                                                                                 |
| Foundry behavior suite         | 17 passed                                                                                                  |
| Foundry invariants             | 3 passed, each with 128 runs and 8,192 calls                                                              |

The mocked browser test completes the seven-step owner checklist, a 40 USDC execution, a 70 USDC on-chain refusal, the `On-chain; indexing pending` to indexed transition without duplication, timeline filtering, and a grounded answer whose citation link resolves to an explorer transaction URL.

## Focused regression coverage added in this pass

| Behavior                                                                                  | Where                          |
| ----------------------------------------------------------------------------------------- | ------------------------------ |
| Canonical Privy policy permits the exact envelope and denies wrong chain, destination, value, and method | `agent/test/payment.test.ts` |
| Signing-state recovery replays the stored intent with the same Privy idempotency key       | `agent/test/worker.test.ts`    |
| Graph filters are applied server-side; question pagination stops at 100 with `partial` set | `agent/test/query.test.ts`     |
| Grounded answers keep a trusted citation and the deterministic fallback                    | `agent/test/query.test.ts`     |
| Indexed records replace pending overlays without duplication                               | `web/tests/timeline.test.ts`   |
| Production configuration rejects missing or invalid public addresses and unpaired signer fields | `web/tests/env.test.ts`    |
| One mocked browser run through setup, execution, refusal, indexing, and citations          | `web/tests/e2e/gol.spec.ts`    |

## Production artifacts

| Check                       | Result                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| Compose validation          | `docker compose -f deploy/docker-compose.yml config -q` passed with no environment file |
| Compose topology            | PostgreSQL private with no host port; web and worker have egress and no inbound port; Caddy is the only public ingress |
| deployment shell syntax     | `bash -n` passed for every `deploy/*.sh`                                     |
| subgraph preparation        | refused the `not_deployed` manifest and accepted explicit factory/start-block arguments |
| provider preflight          | ran with no configuration and reported every missing field name; with only `ARC_RPC_URL` set it read chain ID `5042002` from the public Arc endpoint |
| policy probe                | refused to run without `GOL_POLICY_PROBE=1` and exited nonzero            |

## Not re-run in this pass

The Docker daemon was unavailable while these changes were made, so the container-dependent drills were not repeated: the PostgreSQL migration and restricted-role check, the backup and isolated restore drill, the ARM64 web and worker image builds, and the worker fail-closed container test. Their earlier results are recorded in [integration-preflight.md](integration-preflight.md) and were produced before this pass. Repeat all four before any deployment, because the runtime configuration parser, the worker's required fields, and the Compose networks changed.

## What this does not prove

Local checks do not prove deployed contract behavior, Privy policy enforcement, Graph provider indexing, production TLS, S3 backup access, or the public judge path. The fixture walkthrough is a mocked provider flow and is never partner evidence. Those gates remain in [integration-preflight.md](integration-preflight.md) until external credentials and the existing host are available.
