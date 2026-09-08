# Local validation record

Date: 8 September 2026

Source: update this file with the final commit hash after external deployment. Commands below ran against the working tree immediately before its documentation commit.

## Application and contracts

| Check                        | Result                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`             | passed for protocol, agent, and web                                                                                                     |
| `pnpm test`                  | 17 protocol, 18 agent unit, 7 web, and 3 subgraph mapping tests passed; 3 credential-gated database tests skipped in this aggregate run |
| database-enabled agent suite | 21 passed against disposable PostgreSQL 17.6                                                                                            |
| `pnpm lint`                  | passed; packages with no lint script were skipped                                                                                       |
| Playwright judge path        | 1 passed; opt-in screenshot capture skipped in standard run                                                                             |
| screenshot capture           | 2 passed with `GOL_CAPTURE_SCREENSHOTS=1`, including the normal judge path                                                              |
| Foundry behavior suite       | 17 passed                                                                                                                               |
| Foundry invariants           | 3 passed, each with 128 runs and 8,192 calls                                                                                            |

The host Node version was 25.3.0, so pnpm correctly warned that it was outside the pinned `>=22 <23` engine. Production Docker compilation and runtime smoke tests used Node 22.22.0.

## Production artifacts

| Check                       | Result                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| Compose interpolation       | passed with `deploy/.env.example`                                           |
| deployment shell syntax     | passed for every `deploy/*.sh`                                              |
| PostgreSQL migration        | four public tables created; restricted runtime role could read them         |
| backup and isolated restore | fixture row survived `pg_dump` and restore into ` 크`                       |
| ARM64 web image             | built, 97,670,353 bytes, unprivileged `node` user                           |
| ARM64 worker image          | built, 104,626,065 bytes, unprivileged `node` user                          |
| web image smoke test        | `/` returned 200; `/api/health` returned expected 503 without configuration |
| worker fail-closed test     | exited nonzero with `DATABASE_URL is required`                              |

## What this does not prove

Local checks do not prove deployed contract behavior, Privy policy enforcement, Graph provider indexing, production TLS, S3 backup access, or the public judge path. Those remain in [integration-preflight.md](integration-preflight.md) until external credentials and the existing host are available.
