# GovAsset Municipal Operations & Systems Runbook

This guide details day-to-day administrative operations, database pooling and backup management, recurring background job scheduling, and official municipal GIS shapefile ingestion procedures.

---

## 1. Database Pooling Architecture & Connection Rules

GovAsset utilizes Supabase Managed PostgreSQL 15+ equipped with PostGIS extensions. To ensure maximum stability and avoid connection exhaustion under peak civic incident surges, database connectivity strictly follows a two-tier pooling strategy:

```
[ Next.js API Routes / Server Actions ]
                  │
                  ▼ (Max connections: ~200+, short-lived transaction pooling)
       [ Supavisor Pooler : Port 6543 (?pgbouncer=true) ]
                  │
                  ▼ (Translates to internal Postgres sessions)
         [ PostgreSQL 15+ Engine ]
                  ▲
                  │ (Single direct connection for DDL migrations & advisory locks)
       [ Direct Session : Port 5432 (Prisma Migrations) ]
                  │
        [ CLI: npx prisma migrate deploy ]
```

### Connection Rules

1. **Application Runtime (`DATABASE_URL`):**
   - Must use Supavisor connection pooler on **port 6543**.
   - Must append query parameter `?pgbouncer=true`.
   - Never use direct port 5432 for high-concurrency runtime queries.
2. **Database Migrations (`DIRECT_URL`):**
   - Must use direct PostgreSQL connection on **port 5432**.
   - Supavisor transaction pooler does not support PostgreSQL prepared statements or advisory locks required by Prisma migration tools.

---

## 2. Database Backup, Restore & Point-in-Time Recovery (PITR)

### 2.1 Automated Cloud Backups
- Supabase provides automated daily write-ahead-log (WAL) snapshots with 30-day point-in-time recovery.
- Restoration to any arbitrary minute in the prior 30 days is accessible via Supabase Dashboard -> Project Settings -> Database -> Backups.

### 2.2 Manual Logical Backup (Pre-Deployment Snapshots)

Prior to executing any major schema upgrade or bulk jurisdictional remapping, generate a standalone logical backup:

```bash
# Dump full database to compressed custom format
pg_dump -Fc --no-owner --no-privileges -v -d "$DIRECT_URL" -f "govasset_backup_$(date +%Y%m%d_%H%M%S).dump"

# Dump schema only (excluding complaint records)
pg_dump --schema-only --no-owner -d "$DIRECT_URL" -f "schema_structure_$(date +%Y%m%d).sql"
```

### 2.3 Disaster Recovery / Database Restoration

```bash
# Restore from custom-format dump into target database
pg_restore --clean --if-exists --no-owner --no-privileges -v -d "$DIRECT_URL" "govasset_backup_target.dump"

# Verify PostGIS extension & spatial indices post-restore
psql "$DIRECT_URL" -c "SELECT PostGIS_Full_Version();"
psql "$DIRECT_URL" -c "REINDEX TABLE jurisdictions; REINDEX TABLE complaints;"
```

---

## 3. Recurring Background Maintenance & Scheduler Cycle

GovAsset incorporates a unified, idempotent background maintenance engine (`src/server/worker.ts` and `src/server/sla-cron.ts`).

### 3.1 Operations Executed Per Cycle
1. **SLA Escalation Engine:** Detects complaints exceeding resolution deadlines (`now() > resolution_due_at`), marks `sla_breached = true`, logs an immutable timeline entry, and queues alert dispatches.
2. **7-Day Auto-Closure Engine:** Automatically moves `VERIFIED_RESOLVED` complaints older than 7 calendar days to `CLOSED` if no citizen dispute has been raised.
3. **Notification Queue Worker:** Processes queued SMS and email dispatches with exponential backoff and bounded retries.

### 3.2 Invocation Architecture

External schedulers (e.g. Cloudflare Cron Triggers, AWS EventBridge, or Linux crontab) must trigger the scheduler endpoint **every 5 minutes**:

```bash
# External Cron Trigger Command
curl -X POST https://govasset.in/api/v1/admin/jobs/run \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET"
```

### 3.3 Security Contract
- Access is strictly denied (HTTP 401 `UNAUTHORIZED_CRON`) unless:
  1. The request provides a valid `x-cron-secret` matching `process.env.CRON_SECRET`, OR
  2. The request carries a valid session cookie for an authenticated `PLATFORM_ADMIN`.

---

## 4. Notification Failure Troubleshooting & Dead-Letter Queue

If an SMS or Email provider experiences an outage, failed dispatches are tracked in the `notifications` table:

```sql
-- Query failed notifications within last 24 hours
SELECT id, channel, recipient_phone, template_code, retry_count, error_message, created_at
FROM notifications
WHERE status = 'FAILED' AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

To re-enqueue failed notifications after provider recovery:
```sql
-- Reset failed dispatches to PENDING for automatic worker pickup
UPDATE notifications
SET status = 'PENDING', error_message = NULL, retry_count = retry_count + 1
WHERE status = 'FAILED' AND retry_count < 3;
```

---

## 5. Official Municipal GIS Shapefile Ingestion Specification

> **IMPORTANT GIS DISCLAIMER (`SYNTHETIC_BOUNDARY_DISCLAIMER`):**
> Current municipal ward boundaries in the database are synthetic pilot approximations generated for testing and system demonstration. They must never be used for official administrative boundary assertions.

### 5.1 Ingestion Prerequisites
When official boundary shapefiles or GeoJSON layers are received from the Municipal Corporation Town Planning Department, they must be validated against the following specifications:

1. **Coordinate Reference System (CRS):** `EPSG:4326 (WGS 84)` latitude/longitude coordinates.
2. **Geometry Type:** Must be valid `Polygon` or `MultiPolygon`.
3. **Topological Integrity:** Boundaries must be simple, non-self-intersecting (`ST_IsValid(boundary) = true`), and planar.

### 5.2 Mandatory Layer Attributes

| Shapefile / GeoJSON Field | Database Column | Data Type | Example Value |
|---|---|---|---|
| `WARD_NO` | `code` | `VARCHAR(50)` | `WARD-28` |
| `WARD_NAME` | `name` | `VARCHAR(100)` | `Kothrud Gavthan` |
| `ZONE_NAME` | `parent.name` | `VARCHAR(100)` | `Zone 3 - Kothrud-Bavdhan` |
| `ZONE_CODE` | `parent.code` | `VARCHAR(50)` | `ZONE-03` |
| `OFFICE_ADDR` | `metadata.office` | `TEXT` | `PMC Ward Office, Paud Road, Pune` |
| `HELPLINE` | `metadata.helpline` | `VARCHAR(20)` | `020-25430000` |

### 5.3 Ingestion Pipeline Script (SQL / PostGIS)

```sql
-- 1. Create temporary staging table for incoming shapefile
CREATE TEMP TABLE staging_wards (
    ward_no VARCHAR(50),
    ward_name VARCHAR(100),
    zone_code VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326)
);

-- 2. Validate geometric integrity
DELETE FROM staging_wards WHERE ST_IsValid(geom) = false;

-- 3. Upsert official municipal boundaries into jurisdictions table
UPDATE jurisdictions j
SET boundary = s.geom,
    updated_at = NOW()
FROM staging_wards s
WHERE j.code = s.ward_no AND j.type = 'WARD';

-- 4. Rebuild spatial GIST index
REINDEX INDEX jurisdictions_boundary_gist;
```
