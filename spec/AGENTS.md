# Specification and Evidence Guidelines

The `spec/` tree records product intent, technical decisions, operator state, submission material, prompts, and evidence. These document types are not interchangeable.

## Document Roles

- Product and architecture specs describe intended behavior and trust guarantees.
- Implementation plans describe proposed or completed work and must match current repository paths.
- `prompts/` preserves task inputs; prompts are not proof that requested behavior was implemented.
- `evidence/` contains dated observations and command results. Preserve historical context rather than silently rewriting old evidence.
- `deployment-status.md`, checklists, submission copy, and video scripts summarize state and must link back to verifiable code or dated evidence.

Label claims as proposed, implemented locally, deployed, or independently verified. Never infer live status from source code, configuration, generated artifacts, or a transaction hash alone. When behavior changes, update affected specs and status documents in the same change, but do not rewrite historical records to imply they predicted the new result.

Keep secrets and private operational data out of examples and evidence. Use public addresses, redacted provider signals, sanitized error codes, and timestamps. Product claims should be specific, repository-backed, and bounded by the exact chain, asset, account, and environment that were tested.
