# GOL production operations

The selected target is the existing EC2 instance named `gol-production`
(`i-0551fb8ae101f65d0` in `ap-northeast-1`, Elastic IP `16.76.174.242`). Public HTTPS is
`https://gol.network`. These commands activate a release on that host; they do not create or
replace the VM.

## Host prerequisites

- ARM64 or AMD64 Linux with Docker Engine 29 or compatible Compose v2
- encrypted EBS storage for Docker volumes
- inbound 80 and 443 only, with SSM or restricted SSH administration
- AWS CLI role limited to the private backup bucket and KMS key
- DNS `A` or `AAAA` record for `DOMAIN`

Copy `.env.example` to `.env.production` on the host with mode `0600`. Use URL-safe alphanumeric database passwords because the runtime password is embedded in a PostgreSQL connection URL. Never commit the file. All external identifiers must come from completed Arc, The Graph, and Privy provisioning. `deploy.sh` passes this one file to Compose for both variable interpolation and service environments, and refuses to start when a required runtime field is empty. It reports field names only, because several values are secrets.

PostgreSQL stays on the private Compose network and publishes no host port. The web service and the worker also join the public network for outbound provider access; neither publishes an inbound port, and Caddy is the only public ingress. The admin role applies schema changes and backups; the restricted runtime role serves web and worker queries.

Browser configuration is read on the server when the container starts, not when the image is built, so one image can serve any configured deployment. `FACTORY_ADDRESS` replaces the former build-time `NEXT_PUBLIC_FACTORY_ADDRESS`, and one canonical `PRIVY_APP_ID` serves authentication, provisioning, the worker, and the browser.

## Agent signer: AWS KMS

`AGENT_SIGNER_PROVIDER` selects the agent signer. `privy` uses a separate Privy agent wallet and scoped raw-signing policy. `aws_kms` replaces the Privy agent signer with a non-exportable AWS KMS `ECC_SECG_P256K1`, `SIGN_VERIFY` key in `AWS_KMS_SIGNER_REGION`. Privy still authenticates the owner and owns the owner embedded wallet in both modes. The on-chain `GolAccount` remains the payment authority; KMS cannot inspect an Ethereum digest and does not understand mandate policy.

### Provisioning the production key

1. Create the key: `ECC_SECG_P256K1`, `SIGN_VERIFY`, region `ap-northeast-1`, alias `alias/gol-agent-signer-production`, tags for project, environment, owner, purpose, and creation date. Never reuse the backup encryption key (`alias/gol-backups`) or a disposable verification key.
2. Key policy: no application principal may `DisableKey`, `ScheduleKeyDeletion`, `PutKeyPolicy`, `CreateGrant`, or manage aliases. Only account administrators hold those rights.
3. Derive the Ethereum address from the key's SPKI public key with two independent implementations and confirm they are byte-for-byte equal. Record it as `AWS_KMS_SIGNER_ADDRESS` (EIP-55 checksum).
4. Worker IAM: grant only `kms:GetPublicKey` and `kms:Sign` (conditioned on `kms:SigningAlgorithm = ECDSA_SHA_256`) on the exact key ARN, attached to the EC2 instance role the worker container uses via IMDS. Set the instance metadata hop limit to 2 so the container can read the role. No static AWS access keys enter `.env.production` or any container.
5. Web credential boundary: the `web` service sets `AWS_EC2_METADATA_DISABLED=true`, so it can obtain no AWS credentials and can never call `kms:Sign`. Verify independently: `docker compose exec web env | grep AWS_EC2_METADATA_DISABLED` and confirm the web image imports no KMS SDK.
6. CloudTrail: a durable multi-region trail with encrypted storage and retention, plus alerts for `DisableKey`, `ScheduleKeyDeletion`, `PutKeyPolicy`, `CreateGrant`, unusual `Sign` volume, and signing by an unexpected principal. Event History alone is not the production audit solution.

The worker re-derives the address from the key on startup and refuses to run if it does not match `AWS_KMS_SIGNER_ADDRESS` and every `signer_provider='aws_kms'` account link. The web `/api/health` reports `components.signer` (provider and configuration presence) without any KMS call.

### Operator-funded agent gas

With one shared agent address, `AGENT_GAS_MANAGED` defaults to `true`: the owner-funded "top up agent gas" step is removed from the UI and the operator keeps the shared agent EOA funded for native Arc gas. This does not change any trust boundary; gas is only fuel for the agent EOA, which can spend its own gas and call `GolAccount.pay` under an active, envelope-validated mandate, and nothing else. The application's liveness now depends on the operator: an empty reserve makes every payment fail with `signer_blocked` / `AGENT_GAS_INSUFFICIENT` until it is topped up. Keep the reserve small (a compromised worker could waste it), monitor the agent address balance with an alarm, and leave `AGENT_GAS_LOW_WATERMARK` as the pre-sign guard. Set `AGENT_GAS_MANAGED=false` to restore the owner-funded gas step.

### Rotation and rollback

- A signer migration requires a new owner-signed mandate for the new agent address, never a contract redeployment. Switching `AGENT_SIGNER_PROVIDER` back to `privy` does not reactivate an old mandate.
- Before disabling or scheduling deletion of a KMS key, reconcile every `signed` or `submitted` request by its stored local hash and confirm owners have revoked or replaced affected mandates.
- If key access is lost, provision a replacement key, publish its derived address, and require a new owner-signed mandate. Never invent a new agent association.
- Owner mandate revocation is the definitive payment-authority rollback and needs neither the backend nor AWS.

## Release

```bash
export RELEASE_COMMIT="$(git rev-parse HEAD)"
export GOL_BACKUP_BUCKET=private-gol-backups
export GOL_BACKUP_KMS_KEY_ID=alias/gol-backups
./deploy/deploy.sh
```

The script requires a clean source tree, or an explicit `ALLOW_DIRTY_TREE=1` that records the intentional source commit. It then validates required runtime configuration, stops new worker claims, waits up to 45 seconds, creates an encrypted off-host backup, builds the pinned LangGraph and Node images, applies the idempotent schema before any traffic, activates services, and requires the internal health endpoint to return 200. `RELEASE_COMMIT` is passed into the running services as `GOL_SOURCE_COMMIT`, so `/api/health` and the acceptance runner report the deployed commit. Rollback means checking out a prior compatible commit and rerunning with its exact hash. Never delete `postgres_data` during rollback.

## Backup and restore drill

Schedule `backup-db.sh daily` with a host systemd timer. Configure an S3 lifecycle rule that retains at least seven daily objects and prevents public access. Test a backup without touching `gol`:

```bash
uri="$(./deploy/backup-db.sh restore-test)"
./deploy/restore-db.sh "$uri" gol_restore_verify
```

The restore script refuses database names outside the `gol_restore_` prefix. It recreates only that isolated verification database and reports its public table count.

## Recovery checks

After a VM or container restart, confirm `docker compose ps`, `/api/health`, free disk space, the worker log, and the newest S3 backup. `/api/health` actively verifies the database and the Arc chain ID and performs one bounded Graph metadata query; it never makes a paid model call, and it reports `components.signer` without any KMS call. The worker log line `{"event":"kms_signer_ready",...}` proves the derived address matched configuration and every linked row on startup. Under both raw-signing providers, the journal reconciles by the locally computed transaction hash: after the exact raw bytes are persisted it always rebroadcasts those bytes and never re-signs, and `nonce too low` reconciles the local hash against `getRequest` rather than creating a new transaction. Caddy owns TLS state in `caddy_data`; PostgreSQL state remains in `postgres_data`.

Before a rehearsal, run `pnpm provider:preflight` (alias `pnpm preflight`) from an operator shell that has `.env.production` loaded. With `AGENT_SIGNER_PROVIDER=aws_kms` it checks the KMS signer configuration (ARN shape, region, derived address checksum, fee ceilings) instead of the Privy authorization quorum, and issues no `kms:Sign`, `kms:GetPublicKey`, or paid model call. The Privy `pnpm policy:probe` applies only to `AGENT_SIGNER_PROVIDER=privy`. All operator commands print booleans, public identifiers, and error codes only.
