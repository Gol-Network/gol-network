---
name: gol-agent-payments
description: Operate a configured GOL developer runner to submit policy-bound Arc testnet USDC instructions, inspect request status, and ask questions grounded in indexed outcomes.
---

# GOL developer runner

Use this skill only against a GOL deployment the user owns or is explicitly authorized to operate. This is a developer interface to a configured backend, not a public wallet CLI. It never accepts an owner private key and must not be used to create, fund, revoke, or withdraw from an account.

## Required context

Before any payment, establish:

- `GOL_API_URL`: HTTPS production URL, or `http://127.0.0.1` for local work
- `GOL_DEV_TOKEN`: server-issued bearer token, supplied through the environment and never printed
- mandate ID and approved address-book label
- a fresh random nonzero 32-byte request ID
- explicit user intent for the recipient and amount

Do not infer authority from a natural-language instruction. The server authenticates the user and resolves the account, agent wallet, and recipient address. Do not accept an arbitrary account or signing destination from model output.

## Submit one instruction

```bash
pnpm --filter @gol/agent cli pay \
  --mandate 1 \
  --request 0x<64-random-hex-characters> \
  --instruction 'Pay 40 USDC to Design contractor'
```

The response should initially be `queued` or an idempotently returned existing record. Keep the same request ID for status checks and retries of the exact same instruction. Never create a new ID automatically after an ambiguous submission or a policy refusal.

## Inspect status

```bash
pnpm --filter @gol/agent cli status --request 0x<same-request-id>
```

Terminal states are `executed`, `refused`, `needs_clarification`, `signer_blocked`, `technical_failure`, and `unknown`. Treat `unknown` as unresolved, not failed or paid. A refusal transaction can have a successful Arc receipt because the contract persisted the denial without transferring USDC.

## Ask from indexed evidence

```bash
pnpm --filter @gol/agent cli ask --question 'Why was the 70 USDC payment refused?'
```

Report answer status, freshness, deployment identifier, indexed block, and every returned explorer citation. If status is `empty`, `partial`, `stale`, `unavailable`, or `model_error`, preserve that qualification. Never replace unavailable Graph evidence with fixture data or an unsupported explanation.

## Safety rules

- Arc testnet only, chain ID `5042002`.
- USDC amounts use exact decimal strings with at most six fractional digits.
- Never expose bearer tokens, Privy credentials, Graph keys, model keys, or database URLs.
- Never claim an instruction executed until the journal has reconciled a receipt and on-chain record.
- Never describe `signer_blocked` as an on-chain policy refusal.
- Never ask the model to choose a request ID, account, mandate, signer, transaction outcome, or citation.
- Owner controls remain in the authenticated web wallet.

For the complete 40 then 70 acceptance flow, use `pnpm demo:acceptance` and follow [README.md](README.md).
