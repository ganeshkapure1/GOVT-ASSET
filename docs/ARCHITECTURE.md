# System Architecture & Technical Specification
## Digital Tracking & Optimization of Government Asset Maintenance (GovAsset)

**Document Version:** 1.1.0  
**Status:** Approved for Implementation (Supabase Backend)  
**Architecture Paradigm:** Modular Monolith (TypeScript Full-Stack)  
**Database Engine:** Supabase Managed PostgreSQL 15+ with PostGIS Extension  
**Hosting Target:** Next.js Full-Stack on Managed Cloud / Node.js LTS  

---

### 1. Architectural Vision & Greenfield Stack Justification

#### 1.1 Architectural Evaluation & Trade-Off Analysis
For a beginner-led team operating under a ₹10,00,000 budget to deliver a multi-portal civic platform, microservices and fragmented multi-repo frameworks introduce catastrophic DevOps overhead, network latency, distributed transaction failures, and complex deployment pipelines. 

A **Modular Monolith** built on a unified TypeScript stack with **Supabase Managed PostgreSQL** provides the optimal balance of velocity, architectural simplicity, type-safety, and operational maintainability.

```
+-----------------------------------------------------------------------------------------+
| ARCHITECTURAL EVALUATION MATRIX                                                         |
+--------------------+---------------------------+----------------------------------------+
| Option Considered  | Evaluation                | Decision & Rationale                   |
+--------------------+---------------------------+----------------------------------------+
| 1. Microservices   | High DevOps complexity,   | REJECTED. Incompatible with ₹10L budget|
|    (Go + Node)     | distributed sync overhead.| and beginner maintainability.          |
+--------------------+---------------------------+----------------------------------------+
| 2. Self-Hosted     | High maintenance burden,  | REJECTED. Requires manual patching,   |
|    Bare VM Docker  | no automated failover.    | backup scripts, and OS-level sysadmin. |
+--------------------+---------------------------+----------------------------------------+
| 3. Next.js 14/15   | Single cohesive repo,     | SELECTED. Zero-duplication types,      |
|    + Prisma ORM    | Supabase managed PostGIS, | enterprise connection pooling, direct  |
|    + Supabase PG   | SSR/PWA, low ops cost.    | migrations, zero DevOps overhead.      |
+--------------------+---------------------------+----------------------------------------+
```

#### 1.2 Selected Technology Stack Summary
- **Frontend Framework:** Next.js (App Router, React 18 / 19, TypeScript Strict Mode).
- **Styling & UI Primitives:** Tailwind CSS v3.4+, Accessible SVG icon system, WCAG 2.2 AA compliant tokens.
- **Backend & API Layer:** Next.js Route Handlers (`/api/v1/*`) and Server Actions with Zod schema validation.
- **ORM & Data Layer:** Prisma ORM with connection pooling support (`directUrl` + `DATABASE_URL`).
- **Database Engine:** Supabase Managed PostgreSQL (v15+) with native PostGIS extension (using Supavisor transaction pooler).
- **Authentication:** Stateless signed HTTP-Only session cookies via `@auth/core` / Iron-Session with Argon2id password hashing and SMS/OTP verification.
- **Object Storage:** S3-Compatible Private Object Storage (Cloudflare R2 recommended for ₹0 egress fees, or AWS S3).
- **Job Queue & Scheduling:** PostgreSQL-backed transactional worker (`pg-boss` or Inngest) avoiding Redis hosting costs.
- **Testing Suite:** Vitest for unit/integration tests, Playwright for end-to-end browser tests.

---

### 2. High-Level Architecture & Component Diagram

```mermaid
flowchart TD
    subgraph Clients["Client Access Layer"]
        CP["Citizen Portal (Mobile Web / PWA)"]
        GOP["Gov Ops Portal (Desktop Console / Mobile Field)"]
        AP["Admin Portal (Executive Web Console)"]
    end

    subgraph CDN_Gateway["Edge & Reverse Proxy Layer"]
        CF["Cloudflare Edge CDN / WAF / DDOS Shield"]
    end

    subgraph AppServer["Application Layer (Next.js Modular Monolith)"]
        direction TB
        MW["Auth & Jurisdiction Isolation Middleware"]
        Router["Next.js App Router (SSR & Route Handlers)"]
        
        subgraph DomainModules["Domain Service Modules"]
            AuthMod["Identity & RBAC Service"]
            ComplaintMod["Complaint Lifecycle & FSM Service"]
            RoutingMod["GIS & Jurisdiction Routing Engine"]
            EvidenceMod["Presigned Upload & Evidence Service"]
            SLAMod["SLA Engine & Escalation Service"]
            AuditMod["Audit Logger & DPDP Masking Service"]
        end
    end

    subgraph AsyncWorker["Background Processing Layer"]
        Worker["pg-boss Queue Worker"]
        Cron["SLA Breach & Escalation Scanner (Every 5 mins)"]
    end

    subgraph DataStorage["Persistence & External Services"]
        PG[("PostgreSQL 16 + PostGIS\n(Relational & Spatial Data)")]
        R2[("Cloudflare R2 / S3\n(Private Evidence Bucket)")]
        SMS["Transactional SMS Gateway\n(Fast2SMS / MSG91)"]
        Email["Transactional Email\n(AWS SES / Resend)"]
    end

    CP -->|HTTPS| CF
    GOP -->|HTTPS| CF
    AP -->|HTTPS| CF
    CF --> MW
    MW --> Router
    Router --> DomainModules

    ComplaintMod --> PG
    RoutingMod --> PG
    AuthMod --> PG
    AuditMod --> PG
    SLAMod --> PG
    EvidenceMod --> R2

    Worker --> PG
    Cron --> Worker
    Worker --> SMS
    Worker --> Email
```

---

### 3. Repository & Directory Structure

```
govasset/
├── docs/                                # Project Specifications & Documentation
│   ├── PRD.md
│   ├── UI_UX.md
│   ├── ARCHITECTURE.md
│   └── IMPLEMENTATION_PLAN.md
├── prisma/                              # Database Schema, Migrations & Seeds
│   ├── schema.prisma                    # Declarative Data Models (Supabase Pooler + Direct)
│   ├── migrations/                      # Version-controlled Prisma migrations
│   └── seed.ts                          # Canonical Municipal Seed Script
├── supabase/                            # Supabase CLI & Managed Cloud Configuration
│   ├── config.toml                      # Supabase Local/CLI Configuration
│   ├── migrations/                      # Version-controlled SQL DDL migrations
│   └── seed.sql                         # Raw SQL Pilot Seed Data
├── public/                              # Static Public Assets (Emblems, Icons)
│   ├── favicon.ico
│   ├── manifest.json                    # PWA Manifest
│   └── logos/
├── src/
│   ├── app/                             # Next.js App Router (Portal Pages & APIs)
│   │   ├── (auth)/                      # Authentication Routes
│   │   │   ├── login/
│   │   │   └── otp-verify/
│   │   ├── (citizen)/                   # Portal A: Citizen Routes
│   │   │   ├── page.tsx                 # Public Landing Page
│   │   │   ├── report/                  # Issue Submission Wizard
│   │   │   ├── track/                   # Reference Tracking & Status Timeline
│   │   │   └── my-complaints/           # Authenticated Citizen History
│   │   ├── (ops)/                       # Portal B: Government Operations Routes
│   │   │   ├── ops/
│   │   │   │   ├── triage/              # Ward Triage Queue
│   │   │   │   ├── complaints/[id]/     # Complaint Review & Assignment
│   │   │   │   ├── field/               # Field Crew Mobile Task View
│   │   │   │   └── verifications/       # Supervisor Approval Drawer
│   │   ├── (admin)/                     # Portal C: Platform Administrator Routes
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx             # System Health & SLA Metrics
│   │   │   │   ├── jurisdictions/       # Ward/Zone Hierarchy Tree
│   │   │   │   ├── sla-matrix/          # SLA Threshold Configuration
│   │   │   │   ├── users/               # Staff Directory & RBAC
│   │   │   │   └── audit-logs/          # Security & Compliance Audit Log
│   │   └── api/                         # Backend REST API Endpoints
│   │       └── v1/
│   │           ├── auth/
│   │           ├── complaints/
│   │           ├── evidence/
│   │           ├── jurisdictions/
│   │           ├── admin/
│   │           └── webhooks/
│   ├── components/                      # Shared & Portal UI Components
│   │   ├── ui/                          # Design System Primitives (Button, Modal, etc.)
│   │   ├── citizen/                     # Citizen-specific Components (MapPicker, etc.)
│   │   ├── ops/                         # Gov Ops Components (TriageTable, WorkerCard)
│   │   ├── admin/                       # Admin Components (SlaEditor, TreeView)
│   │   └── shared/                      # StatusBadge, Timeline, ImageCompare
│   ├── config/                          # App Constants, SLA Rules, Navigation Links
│   ├── lib/                             # Shared Core Utilities
│   │   ├── db.ts                        # Prisma Client Singleton
│   │   ├── storage.ts                   # S3/R2 Presigned URL Client
│   │   ├── notifications.ts             # SMS & Email Gateway Adapters
│   │   ├── geo.ts                       # Geolocation & PostGIS Math Helpers
│   │   └── pii.ts                       # DPDP Masking Utilities
│   ├── server/                          # Server-Side Business Services & FSM
│   │   ├── auth.ts                      # Session Verification & RBAC Guards
│   │   ├── complaint-service.ts         # Complaint Lifecycle State Machine
│   │   ├── routing-engine.ts            # Spatial & Departmental Routing
│   │   ├── sla-evaluator.ts             # Escalation Logic & SLA Timers
│   │   └── audit-service.ts             # Immutable Event Logger
│   ├── types/                           # TypeScript Enums, DTOs & Domain Types
│   │   ├── index.ts
│   │   └── api.ts
│   └── middleware.ts                    # Edge Route Protection & Jurisdiction Scoping
├── tests/                               # Test Suites
│   ├── unit/                            # State machine, RBAC, PII masking tests
│   ├── integration/                     # API route & database integration tests
│   └── e2e/                             # Playwright citizen/officer/admin journeys
├── .env.example                         # Environment Variables Template
├── docker-compose.yml                   # Local Dev PostgreSQL + PostGIS + LocalStack
├── package.json                         # Dependencies & Scripts
├── tailwind.config.ts                   # Design System Tokens
└── tsconfig.json                        # TypeScript Strict Configuration
```

---

### 4. Relational Database Schema & Entities

The relational data model enforces strict referential integrity, spatial indexing, and auditability.

```mermaid
erDiagram
    JURISDICTIONS ||--o{ DEPARTMENTS : contains
    JURISDICTIONS ||--o{ USERS : assigned_to
    DEPARTMENTS ||--o{ USERS : belongs_to
    DEPARTMENTS ||--o{ COMPLAINT_CATEGORIES : manages
    COMPLAINT_CATEGORIES ||--o{ SLA_POLICIES : governs
    JURISDICTIONS ||--o{ COMPLAINTS : located_in
    DEPARTMENTS ||--o{ COMPLAINTS : handled_by
    COMPLAINT_CATEGORIES ||--o{ COMPLAINTS : categorized_as
    USERS ||--o{ COMPLAINTS : filed_by
    COMPLAINTS ||--o{ COMPLAINT_ASSIGNMENTS : assigned_with
    USERS ||--o{ COMPLAINT_ASSIGNMENTS : assigned_worker
    COMPLAINTS ||--o{ COMPLAINT_EVIDENCE : contains_proof
    COMPLAINTS ||--o{ COMPLAINT_TIMELINE : audit_trail
    USERS ||--o{ COMPLAINT_TIMELINE : triggered_by
    COMPLAINTS ||--o{ NOTIFICATIONS : triggers
```

#### 4.1 Schema Definitions (PostgreSQL DDL)

```sql
-- Enable PostGIS & UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Jurisdictions (Hierarchical Wards, Zones, Districts)
CREATE TYPE jurisdiction_level AS ENUM ('STATE', 'DISTRICT_CORP', 'ZONE', 'WARD');

CREATE TABLE jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL, -- e.g., 'PUN-Z04-W28'
    level jurisdiction_level NOT NULL,
    parent_id UUID REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    boundary geometry(MultiPolygon, 4326), -- PostGIS boundary coordinates
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_jurisdictions_parent ON jurisdictions(parent_id);
CREATE INDEX idx_jurisdictions_geom ON jurisdictions USING GIST(boundary);

-- 2. Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'ROAD_MAINTENANCE'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users & RBAC
CREATE TYPE user_role AS ENUM (
    'CITIZEN',
    'OFFICER',
    'SUPERVISOR',
    'FIELD_WORKER',
    'DEPT_ADMIN',
    'PLATFORM_ADMIN'
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL, -- Masked on public endpoints
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255), -- Null for OTP-only citizens
    role user_role NOT NULL DEFAULT 'CITIZEN',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_role_jurisdiction ON users(role, jurisdiction_id, department_id);

-- 4. Complaint Categories & SLA Policies
CREATE TYPE complaint_priority AS ENUM ('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW');

CREATE TABLE complaint_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'CAT_POTHOLE'
    name_en VARCHAR(100) NOT NULL,
    name_hi VARCHAR(100) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    default_priority complaint_priority NOT NULL DEFAULT 'P3_MEDIUM',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES complaint_categories(id) ON DELETE CASCADE,
    priority complaint_priority NOT NULL,
    response_sla_hours INT NOT NULL,  -- Time to triage & acknowledge
    resolution_sla_hours INT NOT NULL, -- Time to fully resolve
    escalation_hours INT NOT NULL,   -- Time before Level-2 alert
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_category_priority UNIQUE (category_id, priority)
);

-- 5. Complaints
CREATE TYPE complaint_status AS ENUM (
    'SUBMITTED',
    'TRIAGED_VALIDATED',
    'ASSIGNED',
    'IN_PROGRESS',
    'WORK_COMPLETED',
    'VERIFIED_RESOLVED',
    'CLOSED',
    'REJECTED_INVALID',
    'DUPLICATE_LINKED',
    'DISPUTED_REOPENED'
);

CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(25) UNIQUE NOT NULL, -- e.g., 'GOV-2026-00482'
    citizen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    citizen_phone VARCHAR(15) NOT NULL, -- Stored encrypted/raw, masked on reads
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES complaint_categories(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    location_coords geometry(Point, 4326) NOT NULL,
    landmark_address TEXT NOT NULL,
    status complaint_status NOT NULL DEFAULT 'SUBMITTED',
    priority complaint_priority NOT NULL DEFAULT 'P3_MEDIUM',
    parent_complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL, -- Duplicate linking
    rejection_reason TEXT,
    response_due_at TIMESTAMPTZ NOT NULL,
    resolution_due_at TIMESTAMPTZ NOT NULL,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
    dispute_count INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1, -- Optimistic Concurrency Control
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_complaints_status_jurisdiction ON complaints(status, jurisdiction_id, department_id);
CREATE INDEX idx_complaints_geo ON complaints USING GIST(location_coords);
CREATE INDEX idx_complaints_sla_tracking ON complaints(sla_breached, resolution_due_at) WHERE status NOT IN ('VERIFIED_RESOLVED', 'CLOSED', 'REJECTED_INVALID');

-- 6. Complaint Evidence (Photographs & Geolocation Stamps)
CREATE TYPE evidence_stage AS ENUM ('BEFORE_SUBMISSION', 'AFTER_REPAIR', 'SUPERVISOR_INSPECTION', 'DISPUTE_PROOF');

CREATE TABLE complaint_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    stage evidence_stage NOT NULL,
    file_key VARCHAR(500) NOT NULL, -- Object storage key (private bucket)
    mime_type VARCHAR(50) NOT NULL,
    file_size_bytes INT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    capture_coords geometry(Point, 4326),
    is_verified_proximity BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_evidence_complaint ON complaint_evidence(complaint_id);

-- 7. Assignments & Work Orders
CREATE TABLE complaint_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    assigned_worker_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_completion_at TIMESTAMPTZ NOT NULL,
    worker_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_assignments_worker ON complaint_assignments(assigned_worker_id, is_active);

-- 8. Audit Trail & State Timeline
CREATE TABLE complaint_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    from_status complaint_status,
    to_status complaint_status NOT NULL,
    public_note TEXT, -- Visible on Citizen Portal
    internal_note TEXT, -- Visible ONLY on Gov Ops Portal
    metadata JSONB, -- Contextual diffs, IP address, user-agent
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_timeline_complaint ON complaint_timeline(complaint_id, created_at ASC);

-- 9. Notification Delivery Log
CREATE TYPE notification_channel AS ENUM ('SMS', 'EMAIL', 'IN_APP');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone VARCHAR(15),
    recipient_email VARCHAR(255),
    channel notification_channel NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status notification_status NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_status ON notifications(status, retry_count);
```

---

### 5. Server-Side Security, Permissions & Jurisdiction Isolation

#### 5.1 Defense-in-Depth Authorization Architecture
Authorization is strictly enforced in server-side API handlers and database queries. The frontend UI only reflects permissions for visual convenience; it is never trusted for security.

```mermaid
flowchart TD
    Req["Incoming API Request"] --> MW["Next.js Edge Middleware\n(Validates Session Token & Expiry)"]
    MW --> Handler["Server Action / Route Handler"]
    Handler --> Guard["RBAC Guard: Role Permitted?"]
    Guard -->|No| E403["403 Forbidden"]
    Guard -->|Yes| Scope["Jurisdiction & Department Scoping\n(Enforced in SQL Query)"]
    Scope --> Execution["Execute Transaction / FSM Transition"]
    Execution --> Audit["Log to Immutable Audit Trail"]
    Audit --> Mask["Mask Citizen PII in Response"]
    Mask --> Client["HTTP 200 Return Payload"]
```

#### 5.2 Jurisdiction Scoping Query Contract
Every operational database query enforces jurisdiction isolation by appending server-derived scope filters:

```typescript
// Example: Server-side secure query builder for Gov Ops Queue
export async function getComplaintsForOfficer(session: UserSession, filters: FilterParams) {
  // session.jurisdiction_id and session.department_id are cryptographically signed
  const whereConditions: Prisma.ComplaintWhereInput = {
    department_id: session.department_id,
    jurisdiction_id: session.jurisdiction_id,
    status: filters.status ? { in: filters.status } : undefined,
  };

  // If officer is Zonal Supervisor, permit all child wards in the zone
  if (session.role === 'SUPERVISOR') {
    whereConditions.jurisdiction = {
      parent_id: session.jurisdiction_id, // Includes all wards under supervisor's zone
    };
  }

  return await prisma.complaint.findMany({
    where: whereConditions,
    select: {
      id: true,
      reference_number: true,
      title: true,
      status: true,
      priority: true,
      resolution_due_at: true,
      landmark_address: true,
      citizen_phone: false, // PII OMITTED BY DEFAULT
    },
    orderBy: { resolution_due_at: 'asc' },
  });
}
```

---

### 6. API Contracts & Endpoint Specifications

All endpoints use RESTful conventions, JSON payloads, and standardized error envelopes.

```
Standard Error Envelope:
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Cannot transition complaint from SUBMITTED directly to WORK_COMPLETED.",
    "details": { "current_status": "SUBMITTED", "attempted_status": "WORK_COMPLETED" }
  }
}
```

#### 6.1 Core API Endpoints

| Method | Endpoint Path | Auth Required | Permitted Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/complaints` | Optional (Guest/User)| `ANY`, `CITIZEN` | Submit new civic complaint with coordinates & evidence |
| `GET` | `/api/v1/complaints/track/:ref` | Public (No Auth) | `PUBLIC` | Get sanitized public timeline by reference number |
| `GET` | `/api/v1/ops/queue` | Yes | `OFFICER`, `SUPERVISOR`| Get jurisdiction-scoped triage/assignment queue |
| `PATCH`| `/api/v1/ops/complaints/:id/triage`| Yes | `OFFICER`, `DEPT_ADMIN` | Triage complaint (Accept/Reject/Duplicate) |
| `POST` | `/api/v1/ops/complaints/:id/assign`| Yes | `OFFICER`, `SUPERVISOR`| Assign work order to field worker with target deadline |
| `POST` | `/api/v1/ops/complaints/:id/complete`| Yes | `FIELD_WORKER` | Submit completed repair with "After" photo proof |
| `POST` | `/api/v1/ops/complaints/:id/verify`| Yes | `SUPERVISOR`, `DEPT_ADMIN`| Approve resolution or return for rework |
| `POST` | `/api/v1/complaints/:id/dispute` | Yes | `CITIZEN` | Dispute resolution within 7 calendar days |
| `POST` | `/api/v1/evidence/presign` | Yes | `CITIZEN`, `FIELD_WORKER`| Generate short-lived (15-min) S3 upload URL |
| `GET` | `/api/v1/admin/audit-logs` | Yes | `PLATFORM_ADMIN` | View immutable system compliance and security logs |

---

### 7. Secure File Storage & Direct Upload Pipeline

To protect the ₹10L budget and server memory, file binaries are **never streamed through the Next.js application server**. Clients upload directly to private object storage using time-limited presigned URLs.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Citizen / Field Mobile
    participant App as Next.js API Server
    participant S3 as Private Storage (Cloudflare R2)
    participant DB as PostgreSQL Database

    Client->>App: POST /api/v1/evidence/presign (file_name, mime_type, file_size)
    Note over App: Validates session, MIME in ['image/jpeg','image/png','image/webp'], size <= 5MB
    App->>S3: Generate Presigned PUT URL (TTL: 15 minutes, Content-Length bounded)
    S3-->>App: Return Signed URL + Unique Object Key
    App-->>Client: HTTP 200 { upload_url, file_key }
    
    Client->>S3: Direct HTTP PUT Image Binary (with Content-Type header)
    S3-->>Client: HTTP 200 OK
    
    Client->>App: POST /api/v1/complaints (Payload includes file_key & coordinates)
    App->>DB: INSERT INTO complaint_evidence (file_key, stage, coords)
    App-->>Client: HTTP 201 Created (GOV-2026-XXXXX)
```

#### 7.1 Private Evidence Viewing & Presigned Read URLs
- Files in the bucket are private (`private-read`). Direct public bucket access is disabled.
- When an authorized officer or citizen views a photo, the server generates a time-limited **presigned GET URL with a 15-minute TTL**.
- Internal inspection evidence uploaded by supervisors is strictly inaccessible to Citizen roles.

---

### 8. Concurrency, Race Conditions & State Machine Integrity

In municipal operations, multiple triage officers or supervisors may attempt to assign or resolve the same complaint simultaneously. 

1. **Optimistic Concurrency Control (OCC):**
   - The `complaints` table includes a `version INT NOT NULL DEFAULT 1` column.
   - Every status transition or assignment query specifies `WHERE id = :id AND version = :expected_version`.
   - If two officers update simultaneously, the second transaction matches 0 rows and returns `HTTP 409 Conflict: Ticket was updated by another officer. Refreshing...`
2. **Deterministic State Guard in Service Layer:**
   - The `ComplaintFSM` service class defines a strict transition map. If a transition is not explicitly allowed in the matrix, an `InvalidStateTransitionException` is thrown before any database query executes.

---

### 9. Background Jobs, Notifications & Idempotency

#### 9.1 Transactional Background Worker (`pg-boss`)
Rather than paying for separate Redis/RabbitMQ infrastructure, GovAsset leverages `pg-boss`, a robust, transaction-safe background job queue running on the existing PostgreSQL database.

```
Background Jobs Queue Architecture:
├── queue.sla_monitor         : Cron job triggered every 5 minutes. Scans active complaints.
│                               If now() > resolution_due_at, sets sla_breached=true and
│                               enqueues escalation alert.
├── queue.notifications.sms   : Dispatches transactional SMS with exponential backoff
│                               (Retries at 1m, 5m, 15m).
└── queue.notifications.email : Dispatches transactional emails for executive reports.
```

#### 9.2 Notification Idempotency
Each notification record uses a deterministic idempotency key formatted as:
`IDEMP-NOTIF-{COMPLAINT_ID}-{TARGET_STATUS}-{RECIPIENT_PHONE}`
This guarantees that even during network retries or worker restarts, a citizen or officer will never receive duplicate SMS messages for the same event.

---

### 10. Security Threat Analysis & Mitigations (OWASP Top 10)

| Threat / Vulnerability | Risk Level | Architectural Mitigation |
| :--- | :--- | :--- |
| **BOLA / IDOR (Insecure Direct Object References)** | High | All entity identifiers use random UUIDv7. Every access query is scoped by the caller's server-verified `jurisdiction_id` and `department_id`. |
| **Citizen PII Harvester Attacks** | High | Rate limiting on public tracker (`15 requests / IP / min`). Phone numbers masked as `+91 ******1234` in responses. Full phone views logged with audit alert. |
| **Malicious File Uploads (Web Shells)** | High | Direct client-to-storage upload bypasses app server. S3 bucket restricts MIME types; executables (`.exe`, `.php`, `.js`) rejected. Content-Disposition set to `inline; no-sniff`. |
| **SQL Injection** | Critical | 100% of relational queries use Prisma parameterized prepared statements. Raw SQL used only for PostGIS spatial queries with strict `$1, $2` parameter binding. |
| **Spam / Automated Complaint Floods** | Medium | Cloudflare Turnstile CAPTCHA enabled on citizen submission endpoint; IP-based rate limiting (max 5 submissions per phone number per day). |

---

### 11. Environment Variables & Secrets Management

Secrets are managed via environment variables and never checked into source control. Frontend client bundles receive only variables prefixed with `NEXT_PUBLIC_`.

```bash
# ==============================================================================
# SUPABASE MANAGED DATABASE CONFIGURATION (PostgreSQL 15+ with PostGIS)
# ==============================================================================
# 1. Transaction Pooler URL (Supavisor, port 6543) for runtime queries:
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# 2. Direct Session URL (port 5432) for Prisma migrations and schema push:
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# ==============================================================================
# SUPABASE CLIENT & API CREDENTIALS
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ==============================================================================
# AUTHENTICATION & SECURITY
# ==============================================================================
AUTH_SECRET="f9a8d7c6b5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8" # 64-char hex
AUTH_COOKIE_DOMAIN="govasset.in"
SESSION_TTL_HOURS="12"

# ==============================================================================
# OBJECT STORAGE (Cloudflare R2 / AWS S3)
# ==============================================================================
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_ACCESS_KEY_ID="r2_access_key_placeholder"
S3_SECRET_ACCESS_KEY="r2_secret_key_placeholder"
S3_BUCKET_NAME="govasset-evidence-pilot"

# ==============================================================================
# NOTIFICATION GATEWAYS (SMS & Email)
# ==============================================================================
SMS_PROVIDER="MSG91" # Or 'FAST2SMS' or 'MOCK'
SMS_API_KEY="msg91_secure_api_key_placeholder"
SMS_SENDER_ID="GOVPMC"
SMS_DLT_TE_ID_SUBMITTED="1707161234567890123"
EMAIL_FROM="alerts@govasset.in"
RESEND_API_KEY="re_placeholder_key"

# ==============================================================================
# PUBLIC CLIENT CONFIGURATION (Exposed to Browser)
# ==============================================================================
NEXT_PUBLIC_APP_URL="https://govasset.in"
NEXT_PUBLIC_DEFAULT_LAT="18.5204" # Pune Municipal Corporation Center
NEXT_PUBLIC_DEFAULT_LNG="73.8567"
NEXT_PUBLIC_MUNICIPAL_NAME="Pune Municipal Corporation"
```

---

### 12. Architectural Decision Records (ADRs)

#### ADR-01: Full-Stack Next.js (App Router) instead of Split React SPA + Node API
- **Context:** Project requires 3 portals, high SEO/PWA capabilities for citizens, and operational density for government staff under a ₹10L budget.
- **Decision:** Use Next.js with App Router in a single monorepo.
- **Consequences:** Eliminates API client drift, enables end-to-end TypeScript interfaces, simplifies CI/CD to a single deployment target, drastically reduces cloud hosting costs.

#### ADR-02: PostgreSQL + PostGIS instead of Separate GIS Service (ArcGIS / GeoServer)
- **Context:** Complaints require spatial boundary matching (Ward containment) and duplicate distance clustering.
- **Decision:** Utilize native PostGIS extensions inside PostgreSQL.
- **Consequences:** Eliminates external GIS server licensing and sync pipelines. Spatial queries (`ST_Contains`, `ST_DWithin`) execute directly inside SQL transactions.

#### ADR-03: Cloudflare R2 Presigned Direct Uploads instead of App Server Uploads
- **Context:** Photo evidence uploads must be reliable on 4G networks without choking application web worker memory.
- **Decision:** Client uploads directly to Cloudflare R2 via presigned URLs with 15-minute TTL.
- **Consequences:** Zero server bandwidth used for multi-megabyte image binaries; zero egress fees on Cloudflare R2 saves ₹50,000+ annually compared to standard S3 egress.

#### ADR-04: Stateless Sealed Session Cookies instead of Stateful JWT in Redis
- **Context:** Need secure, revocable sessions without paying for a managed Redis cluster.
- **Decision:** Use encrypted, HTTP-Only session cookies containing user ID, role, jurisdiction, and department, signed with `AUTH_SECRET`.
- **Consequences:** Eliminates Redis dependency; immediate horizontal scaling of application containers; role or jurisdiction changes invalidate session by checking user `updated_at` against cookie timestamp.

#### ADR-05: Transactional Background Workers on PostgreSQL instead of External Message Broker
- **Context:** SLA breach timers, notification dispatches, and audit events must be processed reliably without maintaining Kafka or RabbitMQ clusters.
- **Decision:** Use PostgreSQL-backed transactional worker table (`pg-boss` or DB polling worker).
- **Consequences:** Database writes and background jobs are transactional (jobs are created within the same SQL transaction as complaint status changes); zero additional broker hosting costs.

#### ADR-06: Supabase as Managed PostgreSQL and Spatial Infrastructure Provider
- **Context:** The team is beginner-led and local machine configurations lack Docker desktop or container runtime. Self-hosting PostgreSQL 16 + PostGIS requires manual backup configurations, failover scripts, and OS patch management that exceed budget and operational capacity.
- **Decision:** Adopt Supabase as the managed PostgreSQL database provider with native PostGIS extension and Supavisor transaction connection pooling.
- **Consequences:** 
  1. Instant cloud PostgreSQL instance with PostGIS enabled in one click.
  2. Built-in connection pooler (port 6543) enables scalable serverless/Next.js execution without database connection exhaustion.
  3. Direct connection (port 5432) supports standard Prisma migrations and DDL operations.
  4. Automatic point-in-time backups and dashboard observability at zero upfront cost.
  5. Preserves Prisma ORM, TypeScript strict type safety, and existing Next.js full-stack architecture.
