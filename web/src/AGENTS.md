# Web Source Guidelines

This subtree contains reusable web application modules; route entry points remain under `web/app/`.

## Layer Boundaries

- `server/` may access environment variables, PostgreSQL, agent modules, and RPC clients. Mark privileged modules with `server-only` and return narrow domain results.
- `client/` contains browser-safe adapters, stage definitions, timeline transformations, and shared client types. It must not import `server/` or Node-only dependencies.
- `components/` renders typed state and emits user intent. Keep fetching, chain orchestration, and policy decisions outside presentation components.
- `wallet/` constructs and submits owner-approved wallet actions. Validate account, chain, target contract, and values before requesting a signature.

Props crossing the server/client boundary must be serializable and explicitly typed. Normalize external errors into stable public responses; do not leak stack traces, SQL details, provider responses, or secrets. When changing a shared timeline or API shape, update fixture and live adapters plus route/component tests together.

Use adjacent existing patterns before introducing another state model or transport abstraction. Test pure transformations with Vitest and reserve Playwright for cross-boundary behavior.
