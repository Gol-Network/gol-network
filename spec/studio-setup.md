# GOL Subgraph Studio setup

Decision: PostgreSQL runs on `gol-production`; indexing is hosted externally through Subgraph Studio. PostgreSQL stores private application workflow data. The subgraph stores indexed public blockchain events. They have different jobs; Studio does not connect to our PostgreSQL instance.

Checked against official documentation and Graph CLI source/registry on 8 September 2026. No Studio account was opened or authenticated, no credential was created, and no subgraph code was generated in this preparation step. Application implementation still awaits specification approval.

## Owner setup

1. Open [Subgraph Studio](https://thegraph.com/studio/) and connect a wallet you control. Approve its sign-in request in your wallet. This wallet manages the Studio project; it need not be the GOL agent or the demo owner's payment wallet. Do not share its private key or seed phrase.
2. Choose Create a Subgraph. Suggested name: `GOL Arc Testnet`. Record the exact slug Studio generates. Use Arc Testnet wherever a network choice is requested; manifest identifier is `arc-testnet`. The contract address and ABI are supplied during CLI initialization after deployment, so do not invent them now.
3. Open that subgraph's details and locate its Deploy Key. Save it privately for CLI deployment. It is distinct from the query API key.
4. Open API Keys, choose Create API Key, and name it `gol-production`. Keep the free plan initially and do not authorize paid usage implicitly. Configure an available spending limit and restrict the key to GOL's subgraph once it is selectable. Confirm any restriction still permits requests from our backend.
5. Tell the agent the slug and where the credentials are stored locally. Put credentials in the gitignored workspace secret directory or an approved secret store, not in chat or a committed file. The current local file is `../.secrets/gol-graph.env`, readable only by your user.

Studio wallet sign-in, subgraph creation and deploy-key instructions: [official deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/). Query-key creation and restrictions: [official API-key guide](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/). Exact network: [Arc testnet](https://thegraph.com/docs/en/supported-networks/arc-testnet/).

Use these variable names in the private file; assign actual values in your local editor, not in this document:

```text
GRAPH_SUBGRAPH_SLUG
GRAPH_DEPLOY_KEY
GRAPH_API_KEY
```

`GRAPH_QUERY_URL` is added after deployment. It is the actual URL returned by Studio or the verified published gateway endpoint. Treat a URL containing a credential as secret. The backend needs the query URL/key, not the deploy key. Deployment tooling needs the deploy key, not the owner's wallet private key. Avoid putting a literal secret into shell history; do not commit or log the file. The agent can load these values for a command without printing them or retaining them in a global CLI config.

## What the agent can handle through CLI

The Graph's official package is `@graphprotocol/graph-cli`. Registry inspection returned version `0.98.1`, Node requirement `>=20.18.1`, license `(Apache-2.0 OR MIT)` for that package version. Node 22 fits this requirement. Pin the CLI in GOL's subgraph package during implementation; no global install is required.

After the account/slug exists and specification is approved, the agent can initialize source, write schema/mappings, generate types, compile, test, deploy new versions and verify live queries. CLI deployment does not require signing an on-chain transaction. Commands below describe future work inside `gol/subgraph`; they have not been executed:

```bash
pnpm add -D @graphprotocol/graph-cli@0.98.1
pnpm exec graph init
pnpm exec graph codegen
pnpm exec graph build
pnpm exec graph deploy "$GRAPH_SUBGRAPH_SLUG" --version-label 0.0.1 --deploy-key "$GRAPH_DEPLOY_KEY"
```

Initialization uses the actual factory address, generated ABI, deployment start block and `arc-testnet`. Run scaffolding in an isolated temporary directory if the initialization command would nest or overwrite an existing package, then incorporate only reviewed generated files. The scaffold is only a starting point; our factory templates and precise event schema must be implemented and tested.

The documented `graph auth <DEPLOY_KEY>` command is also available, but the chosen automation passes `--deploy-key` to the deployment process rather than storing it in persistent CLI configuration. The deploy flag is confirmed in [official CLI source](https://github.com/graphprotocol/graph-tooling/blob/main/packages/cli/src/commands/deploy.ts). Deployment output must be redacted if it contains credentials or credential-bearing URLs. This CLI is The Graph's development tool, not an MCP integration.

## Development endpoint versus API-key gateway

Deploy to Studio first and use the deployment's actual query URL to inspect `_meta` and real event records. Studio's development endpoint is a staging service, with documented rate limits. Do not add an API key to that URL and assume this turns it into a published gateway endpoint.

A published Graph Network subgraph has a gateway query URL and an API-key query flow. Publication is a separate on-chain action and may require wallet signatures and network fees. If we need publication for the intended endpoint or submission evidence, the agent prepares the deployment and transaction details and the owner signs. Do not click Publish merely to create an API key or assume the deployment key grants wallet-signing authority. [Deployment versus publication](https://thegraph.com/docs/en/subgraphs/quick-start/)

The official gateway supports bearer authorization. For a published subgraph, the shape is `https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>` plus `Authorization: Bearer <GRAPH_API_KEY>`. A Studio slug, deployment hash and published subgraph ID are different identifiers; use the endpoint returned for our actual deployment. Verify gateway availability for Arc testnet before promising it works.

The development URL is documented as limited to 3,000 queries/day; network-plan quotas are separate. Cache/coalesce timeline requests, bound active receipt-to-index polling, and pause polling for hidden/idle pages. Measure actual usage in rehearsal. Recheck the account's limits in Studio; do not treat a network-plan allowance as the staging endpoint's allowance. [Studio development limits](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/)

## Setup completion evidence

- Wallet-connected Studio account and exact subgraph slug exist.
- Deploy key is available privately to the deployment command; query key is separate.
- Contract address, ABI and start block match Arc testnet.
- CLI deployment produces a real version/deployment ID and a working query URL.
- `_meta.hasIndexingErrors` is false; indexed height includes our refusal transaction.
- Executed and Refused records match on-chain transaction hashes, amounts and headroom.
- Backend configuration uses the tested endpoint and authentication behavior; no key appears in frontend code.
- Any network publication or paid plan is recorded only after the owner actually authorizes/completes it.

The owner handles wallet sign-in/signatures and account/billing decisions. The agent handles the implementation and repeatable deployments once credentials and specification approval are available. No need to install Graph Node, IPFS or The Graph CLI on the production VM solely to serve queries.
