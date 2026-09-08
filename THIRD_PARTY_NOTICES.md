# Third-party notices and provenance

GOL project-specific contracts, application logic, designs, prompts, and assets were created on 8 September 2026 for this Start Fresh repository. Public packages are used under their upstream terms. This inventory covers direct dependencies and major build tools; `pnpm-lock.yaml` is the exact transitive software bill of materials.

| Component           |               Version | Source and license                                                              | Used in                    | Modifications and provenance                                         |
| ------------------- | --------------------: | ------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| Next.js             |                16.3.4 | https://github.com/vercel/next.js, MIT                                          | `web/`                     | Unmodified package, incorporated 2026-09-08                          |
| React and React DOM |                19.2.0 | https://github.com/facebook/react, MIT                                          | `web/`                     | Unmodified packages, incorporated 2026-09-08                         |
| Privy React Auth    |                3.40.0 | https://www.npmjs.com/package/@privy-io/react-auth, Apache-2.0 package metadata | `web/`                     | Unmodified service SDK, incorporated 2026-09-08                      |
| Privy Node          |                0.34.0 | https://www.npmjs.com/package/@privy-io/node, Apache-2.0 package metadata       | `agent/`, `web/`           | Unmodified service SDK, incorporated 2026-09-08                      |
| OpenAI JavaScript   |                7.10.0 | https://github.com/openai/openai-node, Apache-2.0                               | `agent/`                   | Unmodified client, incorporated 2026-09-08                           |
| viem                |                2.56.3 | https://github.com/wevm/viem, MIT                                               | protocol, agent, web       | Unmodified package, incorporated 2026-09-08                          |
| Zod                 |                 4.5.4 | https://github.com/colinhacks/zod, MIT                                          | protocol, web, agent       | Unmodified package, incorporated 2026-09-08                          |
| node-postgres       |                8.23.0 | https://github.com/brianc/node-postgres, MIT                                    | agent, web                 | Unmodified package, incorporated 2026-09-08                          |
| Commander           |                15.0.0 | https://github.com/tj/commander.js, MIT                                         | `agent/src/cli.ts`         | Unmodified package, incorporated 2026-09-08                          |
| Graph CLI           |                0.98.1 | https://github.com/graphprotocol/graph-tooling, Apache-2.0                      | `subgraph/`                | Generated types are build artifacts; business mappings are original  |
| graph-ts            |                0.33.0 | https://github.com/graphprotocol/graph-tooling, Apache-2.0                      | `subgraph/`                | One local compatibility patch in `patches/`, incorporated 2026-09-08 |
| AssemblyScript      |               0.19.23 | https://github.com/AssemblyScript/assemblyscript, Apache-2.0                    | subgraph compiler          | Unmodified package, incorporated 2026-09-08                          |
| Matchstick          |                 0.6.0 | https://github.com/LimeChain/matchstick, Apache-2.0                             | subgraph tests             | Unmodified package, incorporated 2026-09-08                          |
| TypeScript          |                 7.0.2 | https://github.com/microsoft/TypeScript, Apache-2.0                             | workspace build            | Unmodified package, incorporated 2026-09-08                          |
| Vitest              |                 5.0.0 | https://github.com/vitest-dev/vitest, MIT                                       | unit and integration tests | Unmodified package, incorporated 2026-09-08                          |
| Playwright          |                1.63.0 | https://github.com/microsoft/playwright, Apache-2.0                             | browser tests              | Unmodified package and browser binary, incorporated 2026-09-08       |
| PostgreSQL image    |           17.6-alpine | https://www.postgresql.org/about/licence/, PostgreSQL License                   | production data store      | Pinned public container image, no modification                       |
| Caddy image         |         2.10.2-alpine | https://github.com/caddyserver/caddy, Apache-2.0                                | TLS reverse proxy          | Pinned public container image, configuration is original             |
| Node.js image       | 22.22.0-bookworm-slim | https://github.com/nodejs/node, MIT and bundled notices                         | application images         | Pinned public container base, no source modification                 |

OpenZeppelin Contracts was evaluated in the specification but is not incorporated. `GolAccount` contains an original minimal fixed-token call wrapper and reentrancy guard, so no OpenZeppelin source is copied into this repository.

The generated cover at `assets/gol-cover.png` was created with OpenAI's built-in image generation on 8 September 2026 from the prompt recorded in `spec/prompts/2026-09-08-cover-image.md`. The logo and architecture diagram are original SVG source created during the same implementation session. No pre-existing project-specific visual asset was used.

Service access, container registries, and generated model outputs may carry additional platform terms separate from open-source package licenses. Before public release, preserve notices shipped inside installed packages and run the organization's normal transitive license review against `pnpm-lock.yaml`.
