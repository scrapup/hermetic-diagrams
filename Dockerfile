# syntax=docker/dockerfile:1
#
# MCP Gateway image (TF-72-02). Multi-stage: build the TS, install production deps in isolation,
# assemble a slim non-root runtime. The base image is pinned by digest (RN-08) — never a mutable
# tag. This container holds no Docker privilege and no Docker socket; at runtime it only reaches
# Kroki over the internal network.
ARG NODE_IMAGE=node:24.18.0-bookworm-slim@sha256:b31e7a42fdf8b8aa5f5ed477c72d694301273f1069c5a2f71d53c6482e99a2fc

# --- build: compile TypeScript to dist/ ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts closes the dependency postinstall vector; the TS build is invoked explicitly.
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- deps: production-only node_modules, no install scripts ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- runtime: slim, non-root ---
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# The official Node image ships a non-root `node` user (uid 1000).
USER node
# MCP over stdio: no ports, no network server.
CMD ["node", "dist/index.js"]
