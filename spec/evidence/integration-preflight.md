# Integration preflight evidence

Date: 8 September 2026

Scope: read-only environment and provider checks. No contract, subgraph, VM, wallet, DNS, or application deployment was created or changed.

## Arc testnet

The configured public RPC responded to a direct JSON-RPC probe.

| Check                 | Observed value                                                       |
| --------------------- | -------------------------------------------------------------------- |
| RPC                   | `https://rpc.testnet.arc.network`                                    |
| `eth_chainId`         | `0x4cef52`, decimal `5042002`                                        |
| Official USDC         | `0x3600000000000000000000000000000000000000`                         |
| `decimals()`          | `6`                                                                  |
| Probe head            | `0x3a3bb07`                                                          |
| Probe block hash      | `0x20b7e621208b399e92181a64a6f5a6bfb940929e0dc104c0bea296d1c2dc5ca4` |
| Probe block timestamp | `0x6a9febde`                                                         |

This proves endpoint and token metadata availability at the probe time. It does not prove a GOL deployment or provider uptime.

## Credentials and external resources

Only presence was inspected. No credential value was printed or persisted.

| Capability                                                     | Result                                     |
| -------------------------------------------------------------- | ------------------------------------------ |
| OpenAI API credential                                          | absent                                     |
| Privy app, secret, verification, and authorization credentials | absent                                     |
| The Graph deploy/query credentials                             | absent                                     |
| production database URL                                        | absent                                     |
| `.secrets/gol-graph.env`                                       | absent                                     |
| AWS session                                                    | available, default region `ap-southeast-1` |
| EC2 instance tagged or named `gol-production`                  | not found across enabled regions           |

No new EC2 instance was created because the approved architecture requires verification of an existing target. No alternate host was substituted.

## Local infrastructure proof

A disposable Docker Compose PostgreSQL 17.6 environment was used with test-only credentials and removed after validation.

- Idempotent migration created four public tables.
- The restricted `gol_runtime` role could read the application schema.
- A fixture row was inserted through the runtime role.
- `pg_dump` output was restored into a separate `gol_restore_verify` database.
- The restored fixture row was present.
- Test containers, network, and volume were deleted after the drill. No production data existed.

Compose interpolation, shell syntax, and pinned container manifest availability were also checked. An initial monorepo-wide image build exhausted Docker Desktop storage. After clearing only recoverable build cache, the Dockerfile was split into filtered web and worker stages. Both final ARM64 images then built successfully on Node.js 22.22.0. The web image was 97,670,353 bytes and the worker image was 104,626,065 bytes. Both run as the unprivileged `node` user. A web container returned HTTP 200 for `/` and the expected HTTP 503 readiness response with no credentials. A worker container exited immediately with `DATABASE_URL is required`, proving missing configuration fails closed.

## Remaining live evidence gate

The following evidence does not exist yet and must not be inferred from local fixtures:

- factory and account addresses, deployment blocks, bytecode hashes, and explorer verification
- Privy app ownership, policy ID, agent wallet ID, and wrong-destination denial
- Subgraph deployment ID, authenticated Graph query, `_meta` health, and measured indexing delay
- 40 USDC execution and 70 USDC cumulative-cap refusal transaction hashes
- public HTTPS URL, production health response, restart recovery, and off-host S3 backup URI
- clean-browser screenshots of the deployed interactive flow

Prepare the manifest with `pnpm subgraph:prepare`, which refuses a deployment record that still reports `not_deployed`. Then run `pnpm preflight` and, with `GOL_POLICY_PROBE=1`, `pnpm policy:probe`; both print booleans, public identifiers, and error codes only. Run `pnpm demo:acceptance` last, and only after these integrations are configured. Save its JSON output — which now records the deployed source commit, the public application URL, the Privy policy ID, both indexed action IDs, and the answer citations — as the final acceptance record.

Configuration presence alone is never acceptance. The preflight and the probe reduce the number of surprises during the live sequence; only the real 100/40/70 flow with matching Arc receipts, Graph records, and visible answer citations closes this gate.
