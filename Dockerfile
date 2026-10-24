# ── TalentScope UI (Next.js 16 standalone) ──
# Multi-stage build: install → build → slim runtime image
# Build context: repo root (so .env.local is accessible during next build)

# ---------- Stage 1: Install deps ----------
FROM node:20-alpine AS deps
WORKDIR /app/ui

COPY ui/package.json ui/package-lock.json ui/.npmrc ./
RUN npm ci --legacy-peer-deps

# ---------- Stage 2: Build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Rewrites are generated during the build, so use the backend's Compose DNS name here.
ARG BACKEND_URL=http://127.0.0.1:8000
ENV BACKEND_URL=${BACKEND_URL}

# Copy root .env.example as build-time fallback (real values injected at runtime)
COPY .env.example .env.local

# Copy UI source and installed node_modules
COPY --from=deps /app/ui/node_modules ./ui/node_modules
COPY ui/ ./ui/

# Copy the Python vendor dir (next build references ../python/vendor for esbuild script)
COPY python/vendor/ ./python/vendor/

WORKDIR /app/ui
# NEXT_PUBLIC_* vars and BACKEND_URL are baked into the build output.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Print standalone layout so path issues are immediately visible in build logs
RUN echo "=== standalone output ===" && \
    find .next/standalone -maxdepth 3 -type f -name "*.js" | head -20 && \
    echo "========================="

# ---------- Stage 3: Production runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# With outputFileTracingRoot set to __dirname (ui/), the standalone output
# has server.js at its root — no nested ui/ subdirectory.
COPY --from=builder --chown=nextjs:nodejs /app/ui/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /app/ui/.next/static      ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/ui/public             ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
