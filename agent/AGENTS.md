# Agent Package Guidelines

The agent is the off-chain execution and journal service. It may propose and submit actions, but contract mandates remain the final authority over value movement.

## Module Map

- `src/db/` owns the PostgreSQL schema and durable journal.
- `src/model/` owns provider-neutral model interfaces and the OpenAI adapter.
- `src/query/` combines journal and indexed activity into answers.
- `src/privy/` owns signing policy and Privy signer integration.
- `src/payment/` owns instruction parsing, transaction submission, chain configuration, and the retrying worker.
- `src/cli.ts`, `src/payment/worker-entry.ts`, and `src/tools/` are executable boundaries. Put reusable domain logic in modules rather than command entry points.
- `dist/` is generated and must not be edited.

## Execution Rules

Validate model output and CLI/API input before it reaches signing code. Check policy immediately before signing, preserve refusal reasons, and never let prompts grant authority. Payment processing must remain idempotent across retries and restarts; journal state transitions must be durable, monotonic, and recoverable. Keep amounts in base-unit integers and bind submissions to the expected chain, account, recipient, token, and mandate.

Never log model/provider keys, database URLs, Privy credentials, RPC credentials, raw signing payload secrets, or user-sensitive prompt data. Operator tools should emit booleans, public identifiers, and stable error codes only.

## Testing

Place tests in `test/*.test.ts`. Add regression tests for parsing, policy decisions, retry/idempotency behavior, and recovery. PostgreSQL integration tests require `TEST_DATABASE_URL`; a skipped integration suite is not evidence that database behavior passed.

- `pnpm --filter @gol/agent typecheck`
- `pnpm --filter @gol/agent test`
- `pnpm --filter @gol/agent build`
