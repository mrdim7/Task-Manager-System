# syntax=docker/dockerfile:1

# ─── Stage 1: Builder ────────────────────────────────────────────────────────
# Use glibc-based Node (bookworm) — required because the workspace overrides
# exclude musl (Alpine) builds of esbuild and Tailwind's native module.
FROM node:24-bookworm-slim AS builder

RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy every package.json so pnpm can resolve the workspace graph
COPY lib/api-spec/package.json          lib/api-spec/
COPY lib/api-client-react/package.json  lib/api-client-react/
COPY lib/api-zod/package.json           lib/api-zod/
COPY lib/db/package.json                lib/db/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/web/package.json         artifacts/web/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY scripts/package.json               scripts/

RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build composite TypeScript libs
RUN pnpm run typecheck:libs

# Build API server (esbuild → dist/index.mjs)
RUN NODE_ENV=production pnpm --filter @workspace/api-server run build

# Build web app (Vite → artifacts/web/dist/public)
RUN BASE_PATH=/ pnpm --filter @workspace/web run build


# ─── Stage 2: API server ─────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS api

WORKDIR /app

# esbuild bundles everything; no node_modules needed at runtime
COPY --from=builder /app/artifacts/api-server/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run as non-root
USER node

CMD ["node", "--enable-source-maps", "dist/index.mjs"]


# ─── Stage 3: Web (nginx + static files) ─────────────────────────────────────
FROM nginx:stable-alpine AS web

COPY --from=builder /app/artifacts/web/dist/public /usr/share/nginx/html
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
