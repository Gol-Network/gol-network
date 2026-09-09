# Deployment Guidelines

This directory owns production packaging and operational procedures. Deployment files describe intended configuration; they do not by themselves prove current production state.

## File Ownership

- `.env.example` documents every required variable with safe placeholders only.
- `docker-compose.yml`, `Dockerfile`, and `Caddyfile` define the production stack, image, and ingress.
- `deploy.sh` and `migrate.sh` perform rollout operations; `backup-db.sh` and `restore-db.sh` protect PostgreSQL state.
- Record verified addresses and public deployment outputs in `deployments/`; record dated acceptance evidence in `spec/evidence/` or `spec/deployment-status.md`.

Never commit populated environment files, keys, passwords, tokens, or secret-bearing URLs. Keep browser configuration server-read and runtime-injected. Preserve ARM64 image compatibility and health checks when changing images or services.

Back up and verify recoverability before database migrations or destructive cutovers. Make target host, network, project, and database explicit; do not infer destructive targets from an unset variable. Keep legacy services available until endpoint, data, backup, and dependent-service cutover are independently verified and retirement is separately authorized.

Validate Compose edits with `docker compose -f deploy/docker-compose.yml config -q`. Shell changes should remain non-interactive for automation, fail fast, quote variables, and avoid leaking environment values.
