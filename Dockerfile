# ==============================================================================
# GovAsset Production Multi-Stage Dockerfile
# Based on Next.js Standalone Output & Node.js 20 Alpine
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Base Stage: Minimal Alpine with C library compatibility
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ------------------------------------------------------------------------------
# 2. Dependencies Stage: Install production & dev dependencies for build
# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
# Install dependencies cleanly using lockfile
RUN npm ci

# ------------------------------------------------------------------------------
# 3. Builder Stage: Build Next.js standalone application
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client for PostgreSQL/PostGIS
RUN npx prisma generate

# Build Next.js with standalone output
RUN npm run build

# ------------------------------------------------------------------------------
# 4. Production Runner Stage: Minimal non-root execution container
# ------------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user & group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public static files
COPY --from=builder /app/public ./public

# Setup .next directory permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone build bundle & static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to unprivileged runtime user
USER nextjs

EXPOSE 3000

# Health check using the liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Launch Next.js standalone Node server
CMD ["node", "server.js"]
