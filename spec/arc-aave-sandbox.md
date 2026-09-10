# Arc Aave-compatible sandbox

Arc testnet does not currently have an official Aave deployment. Aave's Arc V4 deployment is still
in the governance process, so GOL must not present a private deployment as an Aave DAO market.

For integration testing, `contracts/script/DeployArcAaveSandbox.s.sol` deploys the pinned Aave V3
Origin contracts and lists the canonical Arc testnet USDC token at
`0x3600000000000000000000000000000000000000`. The pool uses a fixed one-dollar test feed, permits
USDC supply and variable-rate borrowing, and disables flash loans. It is an isolated sandbox with
test parameters, no Aave governance, no production oracle, no incentives, and no official Aave UI
or MCP discovery.

## Verification before broadcast

Initialize submodules and compile with Foundry 1.5.1:

```bash
git submodule update --init --recursive
forge build --root contracts
```

Simulate the complete deployment against Arc testnet state without sending a transaction:

```bash
forge script contracts/script/DeployArcAaveSandbox.s.sol:DeployArcAaveSandbox \
  --root contracts \
  --rpc-url "$ARC_RPC_URL" \
  --sender 0xD2DA4968B09401DB75517EF9AcF6A30CdC7dF26F
```

The 2026-09-11 simulation compiled 230 Solidity files, listed real Arc USDC successfully, and
estimated about 78.9 million gas. Simulated addresses are disposable and must never be copied into
runtime configuration.

## Broadcast gate

Only the repository-standard Foundry keystore account `gol-deployer`
(`0xD2DA4968B09401DB75517EF9AcF6A30CdC7dF26F`) may broadcast. Fund it with enough native Arc testnet
USDC for the simulated gas plus margin, then run the same script with `--account gol-deployer` and
`--broadcast`. Enter the keystore password interactively; do not put it in a command, repository
file, shell history, or Docker environment.

After broadcast, independently verify the receipt and deployed bytecode. Only then change
`deployments/arc-aave-sandbox.json` from `not_deployed`, populate its addresses and receipt, and set
the corresponding `ARC_AAVE_*` runtime values. The GOL UI and agent adapter must stay disabled while
that manifest is incomplete.
