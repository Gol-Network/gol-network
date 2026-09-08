# GOL production operations

The selected target is the existing EC2 instance named `gol-production`. Discovery on 8 September 2026 did not find that instance in the enabled AWS regions, so these commands prepare the release but do not create, replace, or deploy to a VM.

## Host prerequisites

- ARM64 or AMD64 Linux with Docker Engine 29 or compatible Compose v2
- encrypted EBS storage for Docker volumes
- inbound 80 and 443 only, with SSM or restricted SSH administration
- AWS CLI role limited to the private backup bucket and KMS key
- DNS `A` or `AAAA` record for `DOMAIN`

Copy `.env.example` to `.env.production` on the host with mode `0600`. Use URL-safe alphanumeric database passwords because the runtime password is embedded in a PostgreSQL connection URL. Never commit the file. All external identifiers must come from completed Arc, The Graph, and Privy provisioning. PostgreSQL has no published port and both application services use the private Compose network. The admin role applies schema changes and backups; the restricted runtime role serves web and worker queries.

## Release

```bash
export RELEASE_COMMIT="$(git rev-parse HEAD)"
export GOL_BACKUP_BUCKET=private-gol-backups
export GOL_BACKUP_KMS_KEY_ID=alias/gol-backups
./deploy/deploy.sh
```

The script stops new worker claims, waits up to 45 seconds, creates an encrypted off-host backup, builds both images, applies the idempotent schema, activates services, and requires the internal health endpoint to return 200. Rollback means checking out a prior compatible commit and rerunning with its exact hash. Never delete `postgres_data` during rollback.

## Backup and restore drill

Schedule `backup-db.sh daily` with a host systemd timer. Configure an S3 lifecycle rule that retains at least seven daily objects and prevents public access. Test a backup without touching `gol`:

```bash
uri="$(./deploy/backup-db.sh restore-test)"
./deploy/restore-db.sh "$uri" gol_restore_verify
```

The restore script refuses database names outside the `gol_restore_` prefix. It recreates only that isolated verification database and reports its public table count.

## Recovery checks

After a VM or container restart, confirm `docker compose ps`, `/api/health`, free disk space, the worker log, and the newest S3 backup. The journal reconciles provider operation IDs and transaction hashes before any signing retry. Caddy owns TLS state in `caddy_data`; PostgreSQL state remains in `postgres_data`.
