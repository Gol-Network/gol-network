# GOL production operations

The selected target is the existing EC2 instance named `gol-production`. Discovery on 8 September 2026 did not find that instance in the enabled AWS regions, so these commands prepare the release but do not create, replace, or deploy to a VM.

## Host prerequisites

- ARM64 or AMD64 Linux with Docker Engine 29 or compatible Compose v2
- encrypted EBS storage for Docker volumes
- inbound 80 and 443 only, with SSM or restricted SSH administration
- AWS CLI role limited to the private backup bucket and KMS key
- DNS `A` or `AAAA` record for `DOMAIN`

Copy `.env.example` to `.env.production` on the host with mode `0600`. Use URL-safe alphanumeric database passwords because the runtime password is embedded in a PostgreSQL connection URL. Never commit the file. All external identifiers must come from completed Arc, The Graph, and Privy provisioning. `deploy.sh` passes this one file to Compose for both variable interpolation and service environments, and refuses to start when a required runtime field is empty. It reports field names only, because several values are secrets.

PostgreSQL stays on the private Compose network and publishes no host port. The web service and the worker also join the public network for outbound provider access; neither publishes an inbound port, and Caddy is the only public ingress. The admin role applies schema changes and backups; the restricted runtime role serves web and worker queries.

Browser configuration is read on the server when the container starts, not when the image is built, so one image can serve any configured deployment. `FACTORY_ADDRESS` replaces the former build-time `NEXT_PUBLIC_FACTORY_ADDRESS`, and one canonical `PRIVY_APP_ID` serves authentication, provisioning, the worker, and the browser.

## Release

```bash
export RELEASE_COMMIT="$(git rev-parse HEAD)"
export GOL_BACKUP_BUCKET=private-gol-backups
export GOL_BACKUP_KMS_KEY_ID=alias/gol-backups
./deploy/deploy.sh
```

The script requires a clean source tree, or an explicit `ALLOW_DIRTY_TREE=1` that records the intentional source commit. It then validates required runtime configuration, stops new worker claims, waits up to 45 seconds, creates an encrypted off-host backup, builds both Node 22 images, applies the idempotent schema before any traffic, activates services, and requires the internal health endpoint to return 200. `RELEASE_COMMIT` is passed into the running services as `GOL_SOURCE_COMMIT`, so `/api/health` and the acceptance runner report the deployed commit. Rollback means checking out a prior compatible commit and rerunning with its exact hash. Never delete `postgres_data` during rollback.

## Backup and restore drill

Schedule `backup-db.sh daily` with a host systemd timer. Configure an S3 lifecycle rule that retains at least seven daily objects and prevents public access. Test a backup without touching `gol`:

```bash
uri="$(./deploy/backup-db.sh restore-test)"
./deploy/restore-db.sh "$uri" gol_restore_verify
```

The restore script refuses database names outside the `gol_restore_` prefix. It recreates only that isolated verification database and reports its public table count.

## Recovery checks

After a VM or container restart, confirm `docker compose ps`, `/api/health`, free disk space, the worker log, and the newest S3 backup. `/api/health` actively verifies the database and the Arc chain ID and performs one bounded Graph metadata query; it never makes a paid model call. The journal reconciles provider operation IDs and transaction hashes before any signing retry, and replays a lost signing response under the same Privy idempotency key rather than creating a second request. Caddy owns TLS state in `caddy_data`; PostgreSQL state remains in `postgres_data`.

Before a rehearsal, run `pnpm preflight` and, with `GOL_POLICY_PROBE=1`, `pnpm policy:probe` from an operator shell that has `.env.production` loaded. Both print booleans, public identifiers, and error codes only.
