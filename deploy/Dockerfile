FROM node:22.22.0-bookworm-slim AS toolchain
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM toolchain AS web-build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY patches ./patches
COPY packages/protocol/package.json packages/protocol/tsconfig.json packages/protocol/tsconfig.build.json ./packages/protocol/
COPY agent/package.json agent/tsconfig.json agent/tsconfig.build.json ./agent/
COPY web/package.json web/tsconfig.json web/next.config.ts web/next-env.d.ts ./web/
RUN pnpm install --frozen-lockfile --filter @gol/web...
COPY packages/protocol ./packages/protocol
COPY agent ./agent
COPY web ./web
RUN pnpm --filter @gol/web build

FROM node:22.22.0-bookworm-slim AS web
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=web-build /app/web/.next/standalone ./
COPY --from=web-build /app/web/.next/static ./web/.next/static
COPY --from=web-build --chown=node:node /app/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]

FROM toolchain AS worker-build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY patches ./patches
COPY packages/protocol/package.json packages/protocol/tsconfig.json packages/protocol/tsconfig.build.json ./packages/protocol/
COPY agent/package.json agent/tsconfig.json agent/tsconfig.build.json ./agent/
RUN pnpm install --frozen-lockfile --filter @gol/agent...
COPY packages/protocol ./packages/protocol
COPY agent ./agent
RUN pnpm --filter @gol/protocol build \
  && pnpm --filter @gol/agent build \
  && pnpm --config.allow-unused-patches=true --filter @gol/agent deploy --prod --legacy /prod/agent

FROM node:22.22.0-bookworm-slim AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=worker-build --chown=node:node /prod/agent ./
USER node
CMD ["node", "dist/payment/worker-entry.js"]
