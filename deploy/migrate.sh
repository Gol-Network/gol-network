#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 -h postgres -U gol_admin -d gol \
  -v runtime_password="$POSTGRES_RUNTIME_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE gol_runtime LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gol_runtime') \gexec
ALTER ROLE gol_runtime PASSWORD :'runtime_password';
\i /migrations/001.sql
GRANT CONNECT ON DATABASE gol TO gol_runtime;
GRANT USAGE ON SCHEMA public TO gol_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gol_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gol_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE gol_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gol_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE gol_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO gol_runtime;
SQL
