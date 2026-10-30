# GovAsset Production Deployment & Infrastructure Guide

This document defines the deployment architecture, container configuration, environment variable specifications, and rollback procedures for the GovAsset platform.

---

## 1. Architecture Overview

GovAsset runs as a containerized Next.js 14 application in standalone mode, backed by managed PostgreSQL (with PostGIS extensions) and S3-compatible private object storage (e.g. Cloudflare R2 or AWS S3).

```
                      +-----------------------------+
                      |   Cloudflare / Edge CDN     |
                      |  - SSL Termination          |
                      |  - DDoS & WAF Rules         |
                      |  - HSTS & Security Headers  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     Docker Container        |
                      |  Next.js Standalone Runner  |
                      |  - Port 3000 (Non-root user)|
                      |  - Edge Middleware Auth     |
                      |  - Liveness: /api/health    |
                      |  - Ready: /api/health/ready |
                      +-------+--------------+------+
                              |              |
           +------------------+              +-------------------+
           |                                                     |
           v                                                     v
+-------------------------------+             +-------------------------------+
|     Supabase Managed DB       |             |   Cloudflare R2 / AWS S3      |
|  PostgreSQL 15+ with PostGIS  |             |  - Private Bucket             |
|  - App Runtime: Port 6543     |             |  - 15-minute Presigned URLs   |
|    (Supavisor Pooler / pgbouncer)           |  - JPEG, PNG, WebP only       |
|  - Migrations: Port 5432      |             |  - Max 5MB file size          |
+-------------------------------+             +-------------------------------+
```

---

## 2. Containerization & Docker Build

The application uses a multi-stage Docker build (`Dockerfile`) based on `node:20-alpine` with an unprivileged system user (`nextjs:nodejs`, UID 1001) for strict defense-in-depth security.

### 2.1 Build Docker Image

```bash
# Build production container image
docker build -t govasset-app:latest .
```

### 2.2 Run Docker Container

```bash
docker run -d \
  --name govasset-prod \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  govasset-app:latest
```

### 2.3 Container Health Check Verification

The Docker container includes an automated `HEALTHCHECK` configured to poll `/api/health` every 30 seconds:

```bash
# Verify container health status
docker inspect --format='{{json .State.Health.Status}}' govasset-prod
# Expected: "healthy"
```

---

## 3. Environment Variable Specification

GovAsset separates configuration strictly across development, staging, and production environments. In production, missing or weak critical secrets trigger `EnvValidationError` and fail closed.

| Variable | Required in Prod | Valid Format / Constraints | Description |
|---|:---:|---|---|
| `NODE_ENV` | **Yes** | `production` \| `development` \| `test` | Runtime environment mode |
| `DATABASE_URL` | **Yes** | `postgresql://...:6543/...` with `pgbouncer=true` | Supavisor pooled connection string for runtime queries |
| `DIRECT_URL` | **Yes** | `postgresql://...:5432/...` | Direct session connection string for Prisma migrations |
| `AUTH_SECRET` | **Yes** | Hex/Base64 string ($\ge 32$ characters) | HMAC-SHA256 secret for tamper-proof session tokens |
| `CRON_SECRET` | **Yes** | String ($\ge 16$ characters) | Shared secret safeguarding `/api/v1/admin/jobs/run` |
| `AUTH_COOKIE_DOMAIN` | No | Domain name (e.g. `govasset.in`) | Root cookie domain for multi-subdomain session sharing |
| `SESSION_TTL_HOURS` | No | Integer (Default: `12`) | Inactivity session expiration in hours |
| `S3_MOCK` | **Yes** | `0` (Prod) \| `1` (Dev/Mock) | Set `0` in production to enforce real S3/R2 storage |
| `S3_ENDPOINT` | If S3 | `https://<account-id>.r2.cloudflarestorage.com` | S3-compatible API endpoint |
| `S3_REGION` | If S3 | `auto` or AWS region code | S3 signing region |
| `S3_ACCESS_KEY_ID` | If S3 | Alphanumeric key ID | Object storage API access key |
| `S3_SECRET_ACCESS_KEY` | If S3 | Secret key string | Object storage API secret access key |
| `S3_BUCKET_NAME` | If S3 | Bucket identifier | Private object storage bucket name |
| `SMS_MOCK` | **Yes** | `0` (Prod) \| `1` (Dev/Mock) | Set `0` in production for live SMS dispatch |
| `SMS_PROVIDER` | No | `MSG91` \| `FAST2SMS` | Indian DLT-compliant SMS gateway |
| `SMS_API_KEY` | If SMS live | API key string | Gateway authentication token |
| `SMS_SENDER_ID` | If SMS live | 6-character alphabetic header | Approved DLT header (e.g. `GOVPMC`) |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://govasset.in` | Canonical public application base URL |
| `NEXT_PUBLIC_MUNICIPAL_NAME` | No | e.g. `Pune Municipal Corporation` | Municipal entity brand label |

---

## 4. Startup & Shutdown Procedures

### 4.1 Startup Sequence

1. **Database Migration Gate:**
   Prior to container rollout, execute Prisma schema migrations using the direct port 5432 connection:
   ```bash
   npx prisma migrate deploy
   ```
2. **Container Launch:**
   Next.js standalone runner initializes `server.js` on port 3000.
3. **Readiness Probe Check:**
   Container orchestrator polls `http://localhost:3000/api/health/ready`. Traffic is routed only after HTTP 200 `HEALTHY` is returned.

### 4.2 Graceful Shutdown

Upon receiving `SIGTERM` or `SIGINT`, the Node.js server drains in-flight HTTP requests within a 15-second grace period before closing Prisma client pool connections.

---

## 5. Security Headers & Edge Policy

All HTTP responses emitted by GovAsset enforce the following defense-in-depth headers configured in `next.config.mjs`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=(self)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 6. Zero-Downtime Deployment & Rollback Runbook

### 6.1 Rolling Deployment Procedure

```bash
# 1. Pull new container image tag
docker pull govasset-app:v2026.11.0

# 2. Start new container on staging port
docker run -d --name govasset-next -p 3001:3000 --env-file .env.production govasset-app:v2026.11.0

# 3. Probe readiness
curl -f http://127.0.0.1:3001/api/health/ready || exit 1

# 4. Atomically swap reverse proxy upstream to port 3001
# 5. Stop prior container
docker stop govasset-prod && docker rm govasset-prod
docker rename govasset-next govasset-prod
```

### 6.2 Instant Rollback Procedure

If unexpected errors or elevated 5xx rates are observed post-release:

1. **Revert Upstream Traffic:** Immediately point the reverse proxy or load balancer back to the previous stable container tag (`govasset-app:v2026.10.x`).
2. **Database Schema Backward Compatibility:** All Prisma migrations must adhere to additive patterns (never drop columns without prior multi-step deprecation).
3. **Validate Restored Health:**
   ```bash
   curl -i http://localhost:3000/api/health/ready
   # Verify HTTP 200 status
   ```
