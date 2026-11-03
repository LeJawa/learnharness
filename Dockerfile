# ── Stage 1: Build ─────────────────────────────────────────────────────────
# Build on Node 26 (the runtime version) so native modules compile for the
# correct ABI.  Standalone output is produced here — no native deps in the
# final image beyond what the standalone trace actually needs.
FROM node:26-slim AS builder

WORKDIR /build

# ── native build deps (pdfjs-dist, @napi-rs/canvas, @resvg/resvg-js, photon) ─
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────
FROM node:26-slim AS production

# Non-root user
RUN groupadd -r learnharness && useradd -r -g learnharness -d /app -s /sbin/nologin learnharness

WORKDIR /app

# Standalone output: server.js + traced node_modules subset
COPY --from=builder --chown=learnharness:learnharness /build/.next/standalone ./
# Static assets (copied by build-server.mjs into standalone/.next/static
# but public/ is still a separate copy the docs require)
COPY --from=builder --chown=learnharness:learnharness /build/.next/static ./.next/static
COPY --from=builder --chown=learnharness:learnharness /build/public ./public
# Prompt assets the server reads from disk at request time
COPY --from=builder --chown=learnharness:learnharness /build/src ./src
# Runtime .cjs modules shared with the Electron shell — src/server/web-subscriptions.ts
# imports ../../electron/{chatgpt,subscriptions,*-ipc}.cjs. Keep the same relative
# layout in case the standalone trace does not copy them.
COPY --from=builder --chown=learnharness:learnharness /build/electron ./electron

# Entrypoint: just run the standalone server
RUN printf '#!/bin/sh\nexec node server.js "$@"\n' > entrypoint.sh && \
    chmod +x entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Persistent data directory (bind-mount or volume at runtime)
RUN mkdir -p /app/data && chown learnharness:learnharness /app/data

USER learnharness

EXPOSE 3000

CMD ["./entrypoint.sh"]
