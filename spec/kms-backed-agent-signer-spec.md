# KMS-Backed Agent Signer and `gol.network` Cutover Specification

**Status:** Approved direction, verified prototype, not implemented in the application.

**Decision date:** 9 September 2026.

**Implementation boundary:** This document specifies the next implementation session. It does not
claim that the repository, production database, production IAM role, or `gol.network` currently uses
AWS KMS for agent payments. Do not call the KMS flow deployed until every production acceptance gate
in this document has dated evidence.

## 1. Goal

Replace the Privy-backed agent transaction signer with an AWS KMS-backed Ethereum signer because the
Privy application is not authorized to transact on Arc testnet. Keep Privy for user authentication
and the owner embedded wallet.

After deployment to `gol.network`, an authenticated owner must be able to:

1. use the existing Privy owner wallet and existing GOL account;
2. provision or retrieve a non-exportable KMS-backed agent address;
3. explicitly fund a small agent gas reserve;
4. sign an on-chain mandate naming that agent and an approved recipient;
5. instruct the agent to send USDC under the mandate;
6. observe an allowed payment execute on Arc;
7. observe recipient, cap, expiry, and revocation violations persist as on-chain refusals; and
8. revoke the mandate and withdraw remaining account funds without agent or backend consent.

The owner continues to authorize account creation, deposits, mandates, revocation, and withdrawals
in the browser. The backend never receives an owner signing credential.

## 2. Fixed decisions

- Network: Arc testnet, chain ID `5042002`.
- Payment token: USDC ERC-20 at `0x3600000000000000000000000000000000000000`, using six-decimal
  payment units.
- Owner authentication and wallet: Privy.
- Agent signer: a dedicated AWS KMS asymmetric `ECC_SECG_P256K1`, `SIGN_VERIFY` key in
  `ap-northeast-1`.
- Mandate authority: `GolAccount` on Arc, not KMS and not an off-chain record.
- Existing GOL accounts, deposits, history, factory, contract ABI, subgraph, and owner wallets remain
  valid. A signer migration requires a new owner-signed mandate, not a contract redeployment.
- One KMS key per environment for the initial deployment. Store the key ARN and derived public
  address. Do not store a private key because KMS does not export it.
- The worker signs type-2 EIP-1559 transactions and broadcasts them with
  `eth_sendRawTransaction`.
- Privy agent-wallet and signer-policy creation are removed from the active setup flow. Historical
  Privy identifiers may remain nullable for migration and audit.
- No automatic gas top-up. The owner explicitly approves each top-up, and the UI distinguishes agent
  gas from the GOL account's mandate payment balance.

## 3. Trust and authority model

```text
Privy owner wallet
  -> owns GolAccount
  -> funds GolAccount payment balance
  -> funds a small KMS-agent gas reserve
  -> signs createMandate(KMS agent, caps, expiry, recipients)
  -> can revoke and withdraw independently

Authenticated GOL worker on gol-production
  -> validates a fixed Arc/GolAccount/pay transaction envelope
  -> obtains a signature from one exact KMS key
  -> persists the exact signed raw transaction before broadcast
  -> broadcasts and reconciles without blind re-signing

GolAccount on Arc
  -> requires msg.sender == mandate.agent
  -> enforces active mandate, expiry, recipients and caps
  -> transfers only configured USDC
  -> persists Executed or Refused outcomes
```

KMS protects key custody and controls which AWS principal may sign. KMS IAM cannot inspect an
Ethereum digest and therefore cannot enforce chain, destination, native value, function selector, or
calldata. This is weaker than the intended Privy transaction-policy boundary.

The application must compensate with all of these independent controls:

- construct transactions internally; never accept arbitrary transaction objects from HTTP, the
  model, or the database;
- validate the complete unsigned transaction immediately before `kms:Sign`;
- grant `kms:Sign` only to the persistent payment-worker role and one exact key ARN;
- keep the KMS agent's native Arc USDC balance small;
- retain the on-chain `GolAccount` as the final payment authority;
- persist signed raw transactions before broadcast and reconcile instead of blindly re-signing; and
- record KMS management and signing calls in a durable CloudTrail trail.

A compromised worker with `kms:Sign` could spend the agent EOA's gas reserve or interact with other
contracts. It cannot call owner-only `GolAccount` methods and cannot make `GolAccount` transfer USDC
outside the active mandate. This residual risk must be stated in operator and user-facing security
documentation.

## 4. Cryptographic signer requirements

Add a provider-neutral signer interface and an AWS implementation under `agent/src/signers/`. The
implementation must use `@aws-sdk/client-kms` directly; it must not shell out to the AWS CLI or depend
on Foundry's AWS credential provider.

### 4.1 Address derivation

1. Call `GetPublicKey` for the configured key ARN.
2. Require `KeyUsage=SIGN_VERIFY`, `KeySpec=ECC_SECG_P256K1`, and support for
   `ECDSA_SHA_256`.
3. Parse the DER SubjectPublicKeyInfo value.
4. Obtain the uncompressed 64-byte `x || y` coordinates without the `0x04` prefix.
5. Compute Keccak-256 and use the final 20 bytes as the Ethereum address.
6. Convert it to an EIP-55 checksum address.
7. Cache only the public key and address. On startup, compare the derived address with the configured
   expected address and every linked account row. Fail closed on mismatch.

### 4.2 Transaction signing

1. Build an unsigned EIP-1559 transaction with viem.
2. Serialize it without a signature and compute Keccak-256 of those bytes.
3. Call KMS `Sign` with `MessageType=DIGEST` and `SigningAlgorithm=ECDSA_SHA_256`.
4. Strictly parse the returned ASN.1 DER signature into 32-byte `r` and `s` values.
5. Reject zero, oversized, malformed, or out-of-range values.
6. Normalize high `s` to `curveOrder - s` for Ethereum low-s compatibility.
7. Try recovery parity `0` and `1`; exactly one recovered address must match the derived KMS address.
8. Serialize the signed transaction and calculate its transaction hash locally.
9. Persist the exact raw bytes and local hash atomically before any network broadcast.

The signature implementation must have fixtures for DER integers with and without leading zeroes,
high-s and low-s signatures, both recovery parities, malformed DER, wrong keys, and address mismatch.

### 4.3 Mandatory envelope validator

Immediately before signing, validate all fields from trusted configuration and journal state:

| Field | Required value |
|---|---|
| Transaction type | EIP-1559 type `2` |
| Chain ID | Exactly `5042002` |
| Sender | Derived configured KMS address |
| Destination | The authenticated user's linked `GolAccount` |
| Native value | Exactly zero for `GolAccount.pay` |
| Data selector | Exactly `pay(uint256,bytes32,address,uint256)` |
| Mandate ID | Stored request mandate ID and current on-chain mandate |
| Request ID | Stored immutable journal request ID |
| Recipient | Stored parsed recipient and server-verified address-book entry |
| Amount | Stored exact bigint amount |
| Gas | Bounded estimate plus a documented margin, under a hard ceiling |
| Fees | Derived from Arc RPC and bounded by configured ceilings |
| Nonce | Reserved pending nonce for this agent under the database lock |
| Access list | Empty unless separately specified and tested |

Any mismatch fails before `kms:Sign` with a stable `SIGNER_ENVELOPE_REJECTED` code. It produces no Arc
policy-refusal record because nothing was submitted. Never let model output select chain ID, account,
sender, nonce, gas, fee, selector, or arbitrary calldata.

## 5. Durable journal and nonce state machine

Privy idempotency keys and provider operation IDs cannot provide KMS recovery. The journal becomes
the source of truth for construction, signing, and broadcast recovery.

### 5.1 Schema migration

Make an additive, reversible PostgreSQL migration before changing application readers.

`account_links` gains:

- `signer_provider varchar(32) NOT NULL DEFAULT 'privy'`, constrained to `privy | aws_kms`;
- `signer_key_arn text` nullable;
- `signer_region varchar(32)` nullable; and
- `signer_address char(42)` or reuse `agent_address` as the canonical public address.

Make `agent_wallet_id` and `policy_id` nullable. Preserve their historical values. For
`signer_provider='aws_kms'`, require a KMS key ARN, region, and agent address. Do not put AWS
credentials, raw key material, authorization keys, or owner secrets in PostgreSQL.

`requests` gains:

- `unsigned_intent_hash char(66)`;
- `signed_raw_transaction text` or encrypted byte storage large enough for the serialized value;
- `signing_key_arn text`;
- `signed_at timestamptz`;
- `broadcast_attempted_at timestamptz`; and
- `last_broadcast_error varchar(100)`.

The signed raw transaction is not a private key, but it is a bearer artifact able to broadcast that
exact transaction. Restrict database access, never return it through APIs, never log it, and remove it
according to a documented retention policy after finality while retaining its hash and audit fields.

### 5.2 State transitions

```text
queued
  -> signing-prepared       parsed intent and locked nonce persisted
  -> signed                 exact raw transaction and local hash persisted
  -> submitted              RPC accepted it or returned same known hash
  -> pending
  -> executed | refused

Any stage may become unknown only with a stable error code and preserved recovery evidence.
```

Use a PostgreSQL advisory lock keyed by signer address for nonce allocation and transaction
construction. Read the pending chain nonce inside that lock. A nonce may be reused only when the
journal proves no signed transaction exists for it.

Required crash behavior:

- Before KMS signing: reconstructing from immutable journal fields is permitted.
- After KMS signing but before raw transaction persistence: never broadcast; safely sign again only
  because no signed artifact was broadcast.
- After raw transaction persistence: always reuse those exact bytes.
- Ambiguous broadcast, timeout, connection reset, `already known`, or equivalent response: query the
  local hash, request state, receipt, and chain nonce; rebroadcast the identical bytes when safe.
- `nonce too low`: reconcile the locally calculated hash and on-chain `getRequest`; never create a
  fresh transaction automatically.
- Fee replacement is out of the initial scope. It requires a separately specified replacement state
  that retains every hash under the same business request.
- Never create a new request ID, nonce, or signature merely because receipt polling timed out.

## 6. Application and user flow

### 6.1 Setup

`POST /api/agent/setup` remains session-authenticated, Origin-checked, rate-limited, and bound to the
owner address proven by Privy plus the on-chain `GolAccount.owner()` value.

For KMS mode it must:

1. retrieve the configured KMS public key and derive the agent address;
2. create or update a provider-neutral account link idempotently;
3. save the approved recipient label and address;
4. return only public signer metadata and the required mandate parameters; and
5. never create a Privy agent wallet or Privy policy.

Initial production uses one environment KMS agent address. The schema must not prevent a later
per-user or per-account key model.

### 6.2 Owner actions

The browser continues to submit owner transactions directly:

- account creation;
- payment-balance deposit;
- explicit agent gas top-up;
- `createMandate` for the exact KMS agent address, recipient, caps, and expiry;
- revocation; and
- withdrawal.

The UI must require the owner to review the complete mandate before signing. Creating a replacement
mandate revokes the prior active mandate and starts a new cumulative-spend counter; it does not erase
history or move account funds.

### 6.3 Payment execution on `gol.network`

Once setup, gas funding, account funding, and the mandate receipt are confirmed:

1. the user enters an instruction such as `Pay 0.1 USDC to <approved address or label>`;
2. the backend authenticates the same owner/account association;
3. the model may parse only recipient and decimal amount;
4. deterministic server code validates and journals exact six-decimal units;
5. the worker verifies the live mandate, constructs and validates `GolAccount.pay`;
6. KMS signs the transaction digest;
7. the worker persists and broadcasts the exact transaction;
8. the receipt plus `GolAccount.getRequest` determine `executed` or `refused`; and
9. the UI shows pending, confirmed, or honestly unresolved state with explorer evidence.

An allowed request transfers USDC from the GOL account to the approved recipient. A contract-policy
violation reaches the contract and becomes a `Refused` record. A local envelope rejection is labeled
`Signer blocked before submission`, with no fabricated on-chain receipt.

Update user-facing labels from `Privy restricted signer` to `Restricted agent signer` or
`AWS KMS-backed agent`. Explain that the owner wallet remains in Privy, the agent key is non-exportable,
the mandate is on-chain, and KMS itself does not understand mandate policy.

## 7. AWS and deployment configuration

Create a new production signing key; never reuse the backup encryption key or the disposable
verification key.

Required key configuration:

- region `ap-northeast-1`;
- `ECC_SECG_P256K1`;
- `SIGN_VERIFY`;
- enabled only during active service operation;
- alias such as `alias/gol-agent-signer-production`;
- tags for project, environment, owner, purpose, and creation date; and
- deletion protection through IAM/key policy. No application principal may schedule deletion,
  disable the key, change its policy, create grants, or manage aliases.

The payment worker receives only:

- `kms:GetPublicKey` on the exact production signer key;
- `kms:Sign` on the exact key, conditioned on `kms:SigningAlgorithm=ECDSA_SHA_256`; and
- existing non-signing permissions required by the worker.

The web container must not receive `kms:Sign`. Separate web and worker AWS identities or use a
credential boundary that makes this independently testable. Root credentials and static AWS access
keys must never enter containers or `.env.production`.

Add server-only runtime fields:

```text
AGENT_SIGNER_PROVIDER=aws_kms
AWS_KMS_SIGNER_KEY_ARN=<secret operational configuration>
AWS_KMS_SIGNER_REGION=ap-northeast-1
AWS_KMS_SIGNER_ADDRESS=<public checksum address>
AGENT_GAS_LOW_WATERMARK=<bounded native-unit amount>
AGENT_MAX_GAS=<hard transaction limit>
AGENT_MAX_FEE_PER_GAS=<hard fee limit>
```

Do not expose the key ARN to browser bundles. The public API may return only provider label,
agent address, region-independent control status, and chain ID.

Configure a durable multi-region or appropriately protected CloudTrail trail with encrypted storage,
retention, and alerts for `DisableKey`, `ScheduleKeyDeletion`, `PutKeyPolicy`, `CreateGrant`, unusual
`Sign` volume, or signing by an unexpected principal. Event History alone is not the production
audit solution.

## 8. Required code changes

```text
agent/src/signers/types.ts                 provider-neutral signer contract
agent/src/signers/aws-kms-signer.ts        public key, DER, recovery, signing
agent/src/signers/envelope.ts              mandatory transaction validation
agent/src/payment/worker.ts                persist-before-broadcast KMS state machine
agent/src/payment/viem-chain.ts            raw broadcast and hash reconciliation
agent/src/db/schema.sql                    provider-neutral and signed-transaction fields
agent/src/db/journal.ts                    atomic nonce/signature transitions
agent/src/payment/worker-entry.ts          provider selection and worker-only KMS client
agent/test/aws-kms-signer.test.ts           crypto and malformed-signature fixtures
agent/test/worker.test.ts                   every crash window and exact-byte replay
agent/test/journal.integration.test.ts      nonce concurrency and atomic persistence
web/app/api/agent/setup/route.ts            KMS address setup; no Privy agent creation
web/app/api/account/route.ts                provider-neutral public signer status
web/app/api/health/route.ts                 KMS configuration/readiness without signing
web/src/server/env.ts                       strict KMS configuration validation
web/src/components/Dashboard.tsx            setup, gas, mandate, signer disclosures
web/src/client/types.ts                     provider-neutral response types
web/src/client/stages.ts                    KMS/envelope error descriptions
web/tests/gol.spec.ts                       full owner-to-payment user flow
deploy/docker-compose.yml                  worker-only KMS configuration
deploy/.env.example                         names and safe placeholders only
deploy/README.md                            provisioning, rotation, rollback, alerts
scripts/provider-preflight.ts               redacted KMS and Arc readiness
scripts/demo-acceptance.ts                  live allowed/refused acceptance evidence
spec/deployment-status.md                   dated implementation and deployment state
```

Remove active worker and setup dependencies on `PrivyScopedSigner`, Privy agent wallet IDs, and
Privy policy IDs. Retain Privy authentication and owner-wallet code. Do not delete historical data
until after the new flow is stable and a separate retention decision is approved.

## 9. Test requirements

### 9.1 Unit and integration

- SPKI-to-Ethereum address derivation against independent known vectors.
- DER parsing, low-s normalization, recovery parity, wrong-key and malformed-signature rejection.
- Chain, destination, value, selector, mandate, request, recipient, amount, gas, fee, nonce, and access
  list envelope rejection before `kms:Sign`.
- Exact integer amount parsing without JavaScript `Number` conversion.
- One advisory-lock winner for concurrent requests from the same signer.
- Different requests never reserve the same nonce.
- Every crash boundary before signing, after signing, after persistence, during broadcast, and during
  receipt polling.
- Exact raw transaction replay after ambiguous submission.
- `already known`, `nonce too low`, RPC timeout, replacement, dropped transaction, reverted receipt,
  and temporary KMS failure handling.
- Same request and payload causes one transfer; changed payload causes conflict.
- Disabled or inaccessible key fails closed.
- Web role denied signing; worker role allowed only the exact production key.
- No raw signed transaction, key ARN, AWS credential, prompt, or database URL in logs/API output.

Run at minimum:

```text
pnpm --filter @gol/agent typecheck
pnpm --filter @gol/agent test
pnpm --filter @gol/web typecheck
pnpm --filter @gol/web test
pnpm --filter @gol/web build
pnpm --filter @gol/web test:e2e
forge test --root contracts -vvv
pnpm typecheck && pnpm test && pnpm build
pnpm format:check
git diff --check
docker compose -f deploy/docker-compose.yml config -q
```

Use Node 22 and pnpm 11.17.0 for acceptance. Skipped database, browser, AWS, or live-chain tests do not
pass their corresponding gate.

### 9.2 Live pre-production acceptance

With a non-production key and disposable GOL account:

- prove derived address equality through two independent implementations;
- execute one allowed payment;
- record per-payment, cumulative, recipient, and revoked refusals;
- prove unauthorized callers revert;
- prove identical request replay is idempotent;
- prove changed-payload replay conflicts before signing;
- persist a raw transaction, interrupt the worker, restart, and prove exact-hash convergence;
- run concurrent requests and prove unique ordered nonces;
- disable the key and prove fail-closed behavior, then restore it;
- verify CloudTrail records expected operations; and
- empty/revoke disposable resources and disable or schedule deletion of the test key.

## 10. `gol.network` production rollout

### 10.1 Preparation

1. Take and verify a fresh PostgreSQL backup.
2. Record the deployed source commit and current image tags.
3. Confirm Arc RPC chain ID, factory/account bytecode, USDC address, public TLS, database health,
   subgraph endpoint, and available disk/memory.
4. Create the production KMS signer key and independently verify its derived address.
5. Apply the least-privilege worker policy and independently verify the web identity is denied.
6. Configure CloudTrail persistence and security alerts.
7. Deploy the additive database migration while old readers remain compatible.
8. Build immutable images from the reviewed commit using Node 22.

### 10.2 Activation

1. Stop payment claiming and wait for every existing Privy request to reach a reconciled terminal or
   explicitly reviewed `unknown` state.
2. Deploy provider-neutral code with Privy mode still selected and run health checks.
3. Switch only the worker/setup configuration to `aws_kms` and restart services.
4. Confirm `/api/health` reports KMS readiness without performing a signature.
5. For each existing owner, show the new KMS agent address and require an explicit gas top-up plus a
   new owner-signed mandate. Never replace a mandate silently.
6. Resume payment claiming only after the mandate's confirmed on-chain agent equals the configured
   KMS address.

### 10.3 Mandatory real-user acceptance on `gol.network`

The deployment is not accepted until a real browser session proves all of the following against the
public HTTPS origin:

1. Sign in through Privy and verify the displayed owner address.
2. Load the existing or newly created GOL account.
3. Deposit payment USDC into the GOL account.
4. Provision/display the KMS-backed agent address.
5. Explicitly send a small gas reserve to the agent address.
6. Review and sign a mandate with an approved recipient and bounded caps.
7. Submit an allowed payment instruction from `gol.network`.
8. Observe a confirmed `Executed` record and the recipient balance increase by the exact amount.
9. Submit an over-budget or unapproved-recipient instruction.
10. Observe a confirmed `Refused` record with the correct rule and no recipient balance change.
11. Refresh/restart during a pending request and prove it reconciles without another transfer.
12. Revoke the mandate and prove a new request is refused.
13. Withdraw the remaining GOL account balance through the owner wallet.
14. Confirm explorer links, indexed activity, API state, journal state, worker logs, health endpoint,
    and CloudTrail evidence agree.

Save sanitized evidence containing timestamps, public addresses, request IDs, transaction hashes,
receipt block hashes, outcomes, source commit, image tags, and public URL. Never save credentials or
raw signed transactions in public evidence.

Only after this acceptance may documentation say: `Users can send funds under an owner-signed
mandate on gol.network.` Before it passes, say only that the behavior is implemented locally or is
awaiting production verification, as applicable.

## 11. Rollback and recovery

- Keep the last known-good images and database backup.
- Stop new claims before rollback.
- Do not roll back the database destructively; additive columns remain compatible.
- Reconcile every signed or submitted KMS transaction by stored local hash before changing signer
  providers.
- An owner may revoke the KMS mandate at any time. Revocation is the definitive payment-authority
  rollback.
- Switching configuration back to Privy does not reactivate an old mandate. The owner must explicitly
  create a mandate for the chosen agent.
- Disable the production KMS key only after all signed transactions are reconciled and owners have
  revoked or replaced affected mandates.
- If key access is lost, never invent a new agent association. Provision a replacement key, show its
  address, and require a new owner-signed mandate.

## 12. Verified evidence informing this specification

The following disposable verification ran on Arc testnet on 9 September 2026. It proves provider and
contract feasibility, not current application deployment.

- Disposable KMS address: `0x256f8D718ECcB9fE33D8FF7E4870b841ed244658`.
- Disposable GOL account: `0x8601bF28B6e137443F29DCD8015Bf5Ed1f2B575E`.
- Standalone KMS-signed transaction:
  `0x919466d1e88ca5846babc614d75368ab4415c9e1b99c2c0c5612558aab1735a8`.
- Allowed KMS-signed `GolAccount.pay`:
  `0x1acf631765557efdca6adb1a43e78ec166489fd4a496cb8f01fb12ec3af36ee5`.
- Per-payment refusal:
  `0x45d79d01f4ea8ac9148250b3b1c2769a7dfe892e9e6e5b4262b76964dcd9eaf9`.
- Recipient refusal:
  `0x95314d704761996d270db7241556ea2ad8b7d88f2112183f0f8dc07cc3d15217`.
- Cumulative refusal:
  `0x99119587f67481480c1c665b568925029c5f28cec60f32949eef0e411866a7aa`.
- Same raw transaction submitted twice converged on:
  `0x98601129cb9faed250e20c4a20405f3593f2ee79fb8cd9a6149fb91107b8f193`.
- Same request and payload replayed without another transfer:
  `0x4bc453e5a477e85a236f21a7dfaf53e214b36a692b1863c1776cabfa7d7ad959`.
- Revoked-mandate refusal:
  `0x194eabd282fd5588b79628b0cd2161fefb6be55a8d9269510f27d9f9166fbaf0`.
- The production EC2 role was denied `kms:Sign` and `kms:GetPublicKey` during verification.
- A simulated exact-key policy allowed only the disposable signer key and denied the backup key.
- Disabling the disposable key caused `DisabledException`; it was restored for cleanup and then
  scheduled for deletion on 16 September 2026.
- The disposable mandate was revoked and the disposable account ERC-20 balance was withdrawn to
  zero.
- Local regression evidence: 36 agent tests passed with 3 environment-dependent skips; 17 Solidity
  unit tests and 3 invariant suites passed. The run used Node 25 and therefore is not the required
  Node 22 release acceptance.

AWS documents `ECC_SECG_P256K1`, non-exportable private keys, digest signing, and public-key retrieval:
[key specifications](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html),
[`Sign`](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html), and
[`GetPublicKey`](https://docs.aws.amazon.com/kms/latest/APIReference/API_GetPublicKey.html). Arc
documents chain ID `5042002`, native gas behavior, and raw-transaction RPC support:
[connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) and
[RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints).

## 13. Completion definition

Implementation is complete only when:

- all code, schema, AWS, documentation, and UI requirements above are implemented;
- every required automated test passes without relevant skips under Node 22;
- the production worker alone can sign with the exact production key;
- crash recovery demonstrates exact-byte replay and no duplicate transfer;
- the owner completes the public `gol.network` acceptance flow;
- allowed funds move by the exact mandate-authorized amount;
- invalid requests persist the correct contract refusals without moving funds;
- owner revocation and withdrawal remain independent;
- sanitized dated production evidence is checked in; and
- deployment status distinguishes verified production behavior from the disposable prototype.
