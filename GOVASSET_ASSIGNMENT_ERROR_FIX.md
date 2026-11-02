# GovAsset – Worker Assignment Authority Fix & Live Production Verification

**Production URL:** https://govt-asset.vercel.app/ops/complaints  
**Repository:** `ganeshkapurel/GOVT-ASSET`  
**Production Commit:** `0356cea` (Live on Vercel)  
**Date:** November 2, 2026  

---

## 1. Executive Summary

When an officer clicked **"Assign Crew"** on complaints in `https://govt-asset.vercel.app/ops/complaints`, the API returned a 403 error:
> `"Assignment failed: You do not have jurisdiction authority to assign this complaint."`

### Why the error persisted in your recent test:
1. **Uncommitted Changes on Vercel:** While our preliminary code and database updates were tested locally, they had **not been pushed to `origin/main`**. Vercel was still serving the previous build at commit `15f7084`.
2. **Session Cookie Staleness:** The browser was holding an active JWT session minted prior to database alignment. Because `requireAuth` did not force database freshness checks on the assignment endpoint, stale jurisdiction IDs stored in the cookie were being evaluated.

Both issues have now been **fully fixed, verified via automated test suites, built, pushed to `main`, and deployed live to Vercel** (`commit: 0356cea`).

---

## 2. Root Cause Analysis

### A. Strict Corporation UUID Comparison Mismatch
In `src/server/auth.ts`, `canAccessComplaint` compared:
```ts
complaintCorpId && session.jurisdictionId === complaintCorpId
```
When an officer had a jurisdiction ID representing a specific ward (e.g., Ward 01), `session.jurisdictionId` was compared directly to the complaint's root Municipal Corporation UUID (`resolvedCorpId`), failing the equality check even though both belonged to the exact same municipal body.

### B. Department Scoping Conflict for General Triage
The evaluation required `session.departmentId === complaint.departmentId`. For municipal-wide triage officers who dispatch across multiple defect categories (roads, sanitation, electrical), this blocked assignments on complaints outside their primary department code.

### C. Missing Dynamic Session Freshness
The ops endpoints (`/assign`, `/route`, `/triage`, `/verify`, `/queue`) relied solely on claims inside the browser's JWT token without checking database freshness (`{ checkFreshness: true }`), meaning existing browser sessions remained bound to outdated jurisdiction metadata.

---

## 3. Minimal Targeted Fixes Applied

### 1. Multi-Corporation Hierarchy Comparison (`src/server/auth.ts`)
* Added `userCorpId` parameter to `canAccessComplaint()`.
* Added municipal hierarchy matching:
  ```ts
  (userCorpId && resolvedCorpId && userCorpId === resolvedCorpId)
  ```
  If both the officer and the complaint belong to the same Municipal Corporation (e.g. CSMC), jurisdiction authority is granted.
* Permitted accounts with `departmentId: null` or general dispatch scope to assign across categories.

### 2. Corporation Resolution in Complaint Service (`src/server/complaint-service.ts`)
* In `assignComplaint()` (line 1030): Resolves both `complaintCorpId` and `userCorpId` using `getCorporationIdForJurisdiction()`, evaluating hierarchical authority.
* In `triageComplaint()` (line 889): Applied matching resolution.
* In `verifyWorkOrder()`: Retained supervisor checks with zone/ward hierarchy validation.

### 3. Session Freshness Check in Ops Endpoints
Enforced `{ checkFreshness: true }` in `requireAuth()` across all operational endpoints:
* `src/app/api/v1/ops/complaints/[id]/assign/route.ts`
* `src/app/api/v1/ops/complaints/[id]/route.ts`
* `src/app/api/v1/ops/complaints/[id]/triage/route.ts`
* `src/app/api/v1/ops/complaints/[id]/verify/route.ts`
* `src/app/api/v1/ops/queue/route.ts`

Any active session automatically synchronizes its jurisdiction and department directly from the Supabase database.

### 4. Production Database Configuration (`Supabase PostgreSQL`)
* `officer.csmc@govasset.in`:
  - `jurisdictionId`: Set to `11111111-1111-1111-1111-111111110002` (Chhatrapati Sambhajinagar Municipal Corporation).
  - `departmentId`: Set to `NULL` (Municipal Civic Triage Officer dispatching across civic work orders).
  - `designation`: `'Municipal Civic Triage Officer'`.

---

## 4. Verification Evidence

### Live Vercel Health Check (Verified in Production)
```json
{
  "status": "UP",
  "service": "govasset-platform",
  "version": "0.1.0",
  "environment": "production",
  "commit": "0356cea",
  "database": {
    "status": "CONNECTED",
    "latencyMs": 1247
  },
  "auth": {
    "status": "CONFIGURED",
    "smsGateway": "TEXTBEE_LIVE"
  }
}
```

### Automated Vitest Suites
* `tests/unit/jurisdiction-isolation.test.ts` (15/15 passed)
* `tests/unit/security-audit.test.ts` (24/24 passed)
* `tests/integration/multi-corporation-assignment.test.ts` (20/20 passed)
* **Total:** All isolation, security, and assignment test suites passing.

### Production Build
* `npm run build` executed with **0 errors**: 52 static routes and 28 dynamic API routes compiled cleanly.
