# Subgraph Guidelines

The subgraph is a derived read model of contract events. It must not invent authority or become the source of truth for execution decisions.

## Source and Generation Flow

`subgraph.yaml` binds deployed addresses, ABIs, events, and mapping handlers. `schema.graphql` defines indexed entities; `src/` contains deterministic AssemblyScript mappings; `queries/` contains consumer queries; `tests/` contains Matchstick coverage. `abis/` are checked-in inputs and must match deployed contract interfaces. `generated/` and `build/` are generated and must not be hand-edited.

When contract events change, update the ABI, manifest, schema/mappings, Matchstick fixtures, and affected queries together. Entity IDs and updates must be deterministic under replay. Preserve transaction hash, log index, block metadata, account identity, and refusal context where the schema exposes them. Mapping code cannot depend on network calls, wall-clock time, or mutable external state.

## Validation

- `pnpm --filter @gol/subgraph codegen`
- `pnpm --filter @gol/subgraph build`
- `pnpm --filter @gol/subgraph test`

Run code generation before reviewing generated type errors, but commit generated output only if the repository's current convention requires it.
