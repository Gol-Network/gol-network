# GOL deployment status

Last reviewed: 9 September 2026

## Current state

Local implementation and deployment tooling are complete. `GolAccountFactory` is deployed and
source-verified on Arc testnet, and the public deployment manifest records its receipt and
reproducibility evidence. Production hosting is the existing Tokyo EC2 instance `gol-production`,
with public HTTPS at `https://gol.network`. A demonstration `GolAccount` has not yet been created,
and live provider acceptance has not been performed. The application remains in labeled fixture
mode until real Privy, Graph, and OpenAI configuration is supplied.

This file is the operational source of truth for the remaining release work. Check an item only when
the named evidence exists; configuration presence or fixture output is not acceptance.

## 1. Release source

- [ ] Push the intended release commit and record its full hash.
- [ ] Run the complete validation suite from a clean checkout with Node 22 and pnpm 11.17.0.
- [ ] Run the PostgreSQL-enabled agent tests with `TEST_DATABASE_URL` and record the result.
- [ ] Repeat the ARM64 image builds, migration/role check, backup/restore drill, and worker fail-closed
      container check after the latest runtime and Compose changes.
- [ ] Record the release commit in the deployed services as `GOL_SOURCE_COMMIT`.

Evidence:

- Release commit:
- Validation record:
- Image digests:

## 2. Provider and infrastructure provisioning

- [x] Create or confirm the dedicated Privy application, allowed origin, app secret, verification
      key, and authorization key/quorum.
- [x] Confirm the authorization key ID matches the configured private authorization key.
- [x] Obtain and verify access to the configured OpenAI model.
- [x] Create the Graph Studio subgraph, deploy key, query API key, and endpoint.
- [x] Confirm the production host, region, architecture, capacity, encrypted storage, and SSM or
      restricted SSH access. Create or explicitly approve a replacement if `gol-production` does
      not exist.
- [x] Configure DNS, TLS, the private backup bucket, KMS key, IAM role, and retention policy.
- [ ] Populate `deploy/.env.production` on the host with mode `0600`; never commit it.

Evidence:

- Privy app and policy IDs: app `cmttquzfy02qb09l5gd9u6txw` (`Gol`); authorization
  quorum `yeb2ndtfydr87r4687k4ypyv` (`GOL worker signer`, threshold 1). Allowed
  origins `https://gol.network` and `http://127.0.0.1:3000`. Policy ID is created
  per owner during agent provisioning, not at app setup.
- Graph Studio subgraph: slug `gol`, Studio account `1758918`, network Arc testnet.
  Studio status still `DRAFT` (not published to the decentralised network). Query API
  key `gol-production` created and stored as `GRAPH_API_KEY`. Dev query endpoint live
  after deploying version `0.0.1`:
  `https://api.studio.thegraph.com/query/1758918/gol/0.0.1`. Deploy key and query API
  key are distinct 32-hex values; deploy key held only in `../.secrets/gol-graph.env`.
- Production host and region: `i-0551fb8ae101f65d0`, `ap-northeast-1` / `ap-northeast-1d`, `t4g.medium` ARM64,
  Amazon Linux 2023, 30 GB encrypted gp3, Elastic IP `16.76.174.242`, SSH alias
  `gol-production`, SSM Online
- Public domain: `gol.network` (Cloudflare DNS-only A record to the Elastic IP; Caddy
  Let's Encrypt certificate for `https://gol.network`)
- Backup bucket and KMS reference: `gol-production-779035457064-ap-northeast-1` /
  `alias/gol-backups`

## 3. Arc contract deployment

- [x] Load the Foundry keystore account `gol-deployer`
      (`0xD2DA4968B09401DB75517EF9AcF6A30CdC7dF26F`) without exposing its password or key.
- [x] Confirm Arc testnet chain ID `5042002`, official USDC, deployer balance, and compiler settings.
- [x] Deploy `GolAccountFactory` with `contracts/script/Deploy.s.sol`.
- [x] Verify the contract source on the configured Arc explorer.
- [x] Update `deployments/arc-testnet.json` with the factory address, deployment block and
      transaction, source commit, bytecode and ABI hashes, and verification URL.
- [ ] Create the demonstration account through the verified factory and record its address.

Evidence:

- Factory address: `0x0C057bE9Ea60Ee0dc9b617600Eb6a688fC9Cf789`
- Account address: pending creation by the actual owner wallet
- Deployment transaction and block:
  `0xf6504c625ed208cd7bc2ea244c3eaab8bf651485d75b7db7d6ed9e1dc7641685`, block
  `61179889`
- Verification URL:
  https://testnet.arcscan.app/address/0x0C057bE9Ea60Ee0dc9b617600Eb6a688fC9Cf789
- Source commit: `f1f9e7b4586b834325ab834a0e8fe137c9a4c649`
- Bytecode hash: `0x82c5376287521aa611e7f583a23cc8f85e891600534d33b9e4c51d78ab21b46d`
- ABI hash: `0x34996f274c68002fde4c9a782b02747006b25e05898efc4a50f2311af8ba45f6`
- Contract validation: 20 Foundry tests passed; `forge fmt --check` passed

## 4. Subgraph deployment

- [x] Run `pnpm subgraph:prepare` from the completed Arc deployment manifest.
- [x] Review the generated network, factory address, and start block.
- [x] Run subgraph code generation, tests, and build.
- [x] Deploy the subgraph through Graph Studio and record its deployment ID and query endpoint.
- [x] Confirm `_meta` health and that indexing reaches the factory deployment block.

Evidence:

- Prepared manifest: network `arc-testnet`, factory
  `0x0C057bE9Ea60Ee0dc9b617600Eb6a688fC9Cf789`, `startBlock: 61179889` (matches
  `deployments/arc-testnet.json` deployment block).
- Build/test: `graph codegen` and `graph build` clean on `@graphprotocol/graph-cli`
  0.98.1 / Node 22; `graph test` 3/3 matchstick assertions pass.
- Deployment ID (IPFS manifest CID): `QmYuyvng3hazXSfj3MWnFi2arm6RCJu4FD2nstF52xSYT9`,
  version label `0.0.1`.
- Query endpoint, without API key:
  `https://api.studio.thegraph.com/query/1758918/gol/0.0.1`
- `_meta` health: `hasIndexingErrors: false`; deployment hash matches the CID above;
  indexed head past block `61202900`, i.e. synced beyond the factory deployment block
  `61179889`.
- Initial indexed block: `61179889` (subgraph start block; no `Account`/`Mandate`/
  `Action` entities yet — the demonstration `GolAccount` has not been created).

## 5. Application deployment

- [ ] Deploy PostgreSQL, the web service, payment worker, and Caddy with `deploy/deploy.sh`.
- [ ] Confirm PostgreSQL has no public host port and that web and worker use restricted runtime
      credentials.
- [ ] Confirm HTTPS and `/api/health` report the expected source commit, database connectivity, Arc
      chain, and Graph health.
- [ ] Configure Privy allowed origins for the final HTTPS domain.
- [ ] Schedule encrypted off-host backups and complete an isolated restore drill.
- [ ] Restart the host or containers and verify journal recovery, persistent data, TLS, and worker
      health.
- [ ] Rehearse rollback with a compatible earlier release without deleting `postgres_data`.

Evidence:

- Health response:
- Backup URI and restore result:
- Restart/recovery record:
- Rollback record:

## 6. Wallet and policy setup

- [ ] Fund the owner wallet with sufficient Arc testnet USDC for setup and gas.
- [ ] Sign in through the real Privy owner flow and link the deployed GOL account.
- [ ] Provision the separate agent wallet and restricted signer policy.
- [ ] Run `pnpm preflight` successfully.
- [ ] Run `GOL_POLICY_PROBE=1 pnpm policy:probe`; record the allowed GOL transaction and the
      wrong-destination denial before broadcast.
- [ ] Fund the agent gas reserve and GOL account with the required demonstration balances.
- [ ] Review and sign a fresh seven-day, one-recipient, 100 USDC mandate.
- [ ] Verify owner withdrawal and revocation controls before preparing the final fresh mandate.

Evidence:

- Owner, agent, and recipient public addresses:
- Privy policy ID:
- Allowed probe transaction:
- Denied probe result:
- Final mandate ID:

## 7. Live acceptance

- [ ] Run `pnpm demo:acceptance` against a fresh 100 USDC mandate.
- [ ] Confirm the 40 USDC request is executed with an Arc receipt.
- [ ] Confirm the subsequent 70 USDC request is a successful on-chain `CUMULATIVE_CAP` refusal with
      60 USDC headroom.
- [ ] Confirm The Graph indexes both request IDs and transaction hashes without duplication.
- [ ] Confirm Ask the Record explains the refusal using trusted indexed and explorer citations.
- [ ] Measure indexing delay and exercise stale, unavailable, provider-failure, and recovery states.
- [ ] Save the acceptance JSON tied to the deployed source commit and public URL.
- [ ] Rehearse the complete flow from a clean, signed-out browser.

Evidence:

- Acceptance JSON:
- Executed transaction:
- Refused transaction:
- Indexed action IDs:
- Answer citations:
- Measured indexing delay:

## 8. Release and submission evidence

- [ ] Capture at least three clean-browser screenshots from the deployed application.
- [ ] Record actual feedback and human design decisions in `FEEDBACK.md`.
- [ ] Replace every placeholder in `spec/submission-copy.md` with verified live evidence.
- [ ] Confirm registration, track and prize selections, form constraints, and asset dimensions in the
      authenticated dashboard.
- [ ] Record, upload, and watch the complete two-to-four-minute human-narrated video.
- [ ] Publish the source and live demo URLs and perform the final human submission.

Evidence:

- Screenshot paths:
- Feedback record:
- Video URL:
- Source URL:
- Live demo URL:
- Submission acknowledgement:

## Known caveats

- GOL is Arc testnet only, unaudited, and not represented as mainnet-ready.
- The Privy signer policy constrains the transaction envelope; it is not an ABI-level allowlist.
- A fixture walkthrough proves UI behavior only. It does not prove Arc, Privy, The Graph, OpenAI,
  production hosting, or partner eligibility.
- Live integration may expose provider or chain compatibility defects that require implementation
  changes before acceptance can pass.
