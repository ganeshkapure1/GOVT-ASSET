# GovAsset – Government Asset Maintenance Tracking & Civic Complaint Management Platform

[![Live Production Site](https://img.shields.io/badge/Live%20Platform-govt--asset.vercel.app-0B4FC2?style=for-the-badge&logo=vercel&logoColor=white)](https://govt-asset.vercel.app/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2.20-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.16-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## Table of Contents

1. [Project Title & Introduction](#1-project-title--introduction)
2. [Live Application](#2-live-application)
3. [Project Objectives](#3-project-objectives)
4. [Key Features by User Role](#4-key-features-by-user-role)
5. [Application Architecture](#5-application-architecture)
6. [Technology Stack](#6-technology-stack)
7. [System Requirements](#7-system-requirements)
8. [Local Installation and Setup](#8-local-installation-and-setup)
9. [Environment Variables Configuration](#9-environment-variables-configuration)
10. [Database Architecture & Setup](#10-database-architecture--setup)
11. [Main Application Modules](#11-main-application-modules)
12. [Complaint Lifecycle & Finite State Machine](#12-complaint-lifecycle--finite-state-machine)
13. [API Documentation](#13-api-documentation)
14. [Project Folder Structure](#14-project-folder-structure)
15. [Testing & Quality Assurance](#15-testing--quality-assurance)
16. [Deployment on Vercel](#16-deployment-on-vercel)
17. [Security & Compliance](#17-security--compliance)
18. [Current Project Status & Limitations](#18-current-project-status--limitations)
19. [Future Scope](#19-future-scope)
20. [Contributors & License](#20-contributors--license)

---

## 1. Project Title & Introduction

**GovAsset** is an enterprise-grade civic infrastructure maintenance and citizen grievance redressal platform engineered for Indian Municipal Corporations (such as Chhatrapati Sambhajinagar Municipal Corporation and Pune Municipal Corporation) and regional urban local bodies (ULBs).

### The Real-World Problem
Public asset maintenance across urban India historically suffers from critical operational bottlenecks:
* **Fragmented Reporting:** Civic defects (potholes, non-functional streetlights, ruptured water mains, uncollected garbage) are reported through unofficial WhatsApp groups, paper-based grievance registers, or phone calls, leading to lost or untracked reports.
* **Lack of Accountability & "Ghost Repairs":** Contractors and field teams frequently mark municipal work orders as "Resolved" without performing physical on-ground repairs. Supervisors lack timestamped before/after photographic proof and spatial audit capabilities.
* **Jurisdictional Silos:** Complaints bounce indefinitely between departments (e.g., Public Works Department vs. Electrical Engineering vs. Water Supply) because of ambiguous jurisdictional boundaries.
* **Zero Real-Time SLA Enforcement:** Citizens face radio silence after reporting an issue, while administrative commissioners have no real-time dashboard to monitor ward-level backlogs, overdue tickets, or recurring infrastructure failure hotspots.

### The GovAsset Solution
GovAsset transforms traditional civic grievance management into an automated, transparent, and deterministic digital workflow:
* **For Citizens:** Frictionless 60-second issue reporting with automatic browser GPS coordinate stamping, camera evidence capture, instant mobile OTP authentication, and transparent reference tracking with a 7-day dispute window.
* **For Municipal Officers & Supervisors:** Centralized operations queue with multi-corporation tenant isolation, automated duplicate detection within a 150-meter radius, SLA escalation monitors, and side-by-side photographic quality inspection before work orders can be certified.
* **For Field Crews:** Mobile-friendly, high-contrast task interface with one-click "Start Work" and mandatory geo-verified "After Repair" photograph submission.

---

## 2. Live Application

The complete platform is actively deployed and running 24/7 in production:

* **Production URL:** [https://govt-asset.vercel.app/](https://govt-asset.vercel.app/)
* **Operations Console:** [https://govt-asset.vercel.app/ops/complaints](https://govt-asset.vercel.app/ops/complaints)
* **Quality Verifications:** [https://govt-asset.vercel.app/ops/verifications](https://govt-asset.vercel.app/ops/verifications)
* **Field Crew Hub:** [https://govt-asset.vercel.app/ops/field](https://govt-asset.vercel.app/ops/field)
* **Citizen Grievance Intake:** [https://govt-asset.vercel.app/report](https://govt-asset.vercel.app/report)
* **Citizen Ticket Tracker:** [https://govt-asset.vercel.app/track](https://govt-asset.vercel.app/track)
* **Live System Health Probe:** [https://govt-asset.vercel.app/api/health](https://govt-asset.vercel.app/api/health)

---

## 3. Project Objectives

1. **Digital Civic Complaint Intake:** Provide a unified web interface for reporting physical municipal asset defects with automated coordinate geocoding.
2. **Infrastructure Defect Tracking:** Maintain a transparent, public audit trail from submission through active repair to final resolution.
3. **Deterministic State Governance:** Enforce a strict Finite State Machine (FSM) ensuring work orders cannot bypass administrative triage or physical inspection.
4. **Workforce Orchestration:** Empower municipal supervisors to dispatch work orders to qualified field technicians based on specific trade skills (Electrician, Asphalt Paving, Pipeline Maintenance).
5. **Anti-Tamper Quality Verification:** Mandate before/after photographic comparisons with GPS proximity validation before marking complaints as resolved.
6. **Automated SLA Monitoring:** Calculate response and resolution deadlines ($P1$ Critical to $P4$ Low) dynamically, flagging SLA breaches in real-time.
7. **Statutory Data Privacy:** Ensure full adherence to India's **Digital Personal Data Protection (DPDP) Act 2023** via telephone number masking and role-based data boundaries.

---

## 4. Key Features by User Role

### 🏛️ Citizen Portal
* **Mobile OTP Authentication:** Fast citizen sign-in using Indian mobile phone numbers with SMS delivery via the TextBee gateway and 60-second spam prevention cooldown.
* **60-Second Grievance Registration:** Guided defect intake form with automatic browser GPS location detection, landmark address mapping, and intake photo upload.
* **Civic Category Classification:** Categorized reporting across PWD Road Maintenance, Street Lighting, Water & Sewerage, Solid Waste Management, and Public Safety.
* **Unique Tracking Reference:** Instant generation of human-readable, sequential reference codes (e.g., `GOV-2026-00050`).
* **Real-Time Ticket Tracking:** Public lookup by reference number or mobile number displaying status progression, department ownership, and estimated resolution deadlines.
* **My Complaints Dashboard:** Personalized citizen overview of all historically submitted grievances and resolution histories.
* **7-Day Quality Dispute Window:** Ability for citizens to dispute substandard repairs within 7 days of resolution, automatically reopening the ticket for corrective maintenance.

### 👔 Government Operations Portal (Officers & Supervisors)
* **Executive KPI Dashboard:** Real-time metrics tracking Total Cases, $P1$ Critical Defects, SLA Breaches, and Tasks Awaiting Verification.
* **Operations Complaints Queue:** Filterable grievance table with search by citizen phone, category, landmark, priority, status, or municipal ward.
* **Smart Worker Assignment:** Modal dispatching work orders to eligible field workers based on municipal corporation matching and certified trade skills.
* **Automated Duplicate Detection:** Geospatial engine identifying complaints filed within a 150-meter radius, enabling 1-click master/child merging.
* **Supervisory Quality Audit Queue:** Side-by-side Before/After photograph comparison with GPS geofence distance auditing (`Verified on-site coordinates`).
* **Quality Sign-Off & Rework Dispatch:** Supervisors can certify resolution with one click or return incomplete tasks to field crews with mandatory corrective instructions.
* **Workforce Directory:** Onboard field crew leads, manage contact details, assign specialization skill tags, and track individual active workloads.

### 👷 Field Worker Console
* **Mobile-First High-Contrast Interface:** Optimized for field use on smartphones and rugged tablets under direct sunlight.
* **Assigned Work Order Queue:** Clear view of pending work orders containing defect location, citizen photo, priority badge, and dispatch notes.
* **Task Lifecycle Controls:** Worker initiates on-site repair with "Start Work" (transitions status from `ASSIGNED` to `IN_PROGRESS`).
* **Completion Proof Submission:** Worker uploads "After Repair" photograph, adds completion remarks, and submits for supervisory quality audit (`WORK_COMPLETED`).

---

## 5. Application Architecture

GovAsset is architected as a **Modular Monolith** using Next.js 14 App Router, providing end-to-end TypeScript type safety across the database, server actions, REST route handlers, and React Server Components.

```mermaid
flowchart TD
    subgraph Clients ["1. Client Layer (Responsive Web / PWA)"]
        CP["Citizen Portal (/report, /track)"]
        OP["Operations Console (/ops/complaints)"]
        SP["Supervisory Audit (/ops/verifications)"]
        FW["Field Crew Hub (/ops/field)"]
        AD["Admin Console (/admin)"]
    end

    subgraph EdgeRouting ["2. Application & API Routing Tier (Next.js 14)"]
        MW["Security Middleware (Session & RBAC Guard)"]
        AUTH_API["/api/v1/auth/* (OTP & Scrypt Login)"]
        COMP_API["/api/v1/complaints/* (Intake & Tracking)"]
        OPS_API["/api/v1/ops/* (Triage, Assign, Verify)"]
        ADMIN_API["/api/v1/admin/* (Auto-Close & SLA)"]
        HEALTH_API["/api/health (Liveness & Latency SRE Probe)"]
    end

    subgraph ServiceLayer ["3. Domain Services & Business Logic"]
        FSM["Finite State Machine (FSM + OCC Versioning)"]
        AUTH_SVC["Auth & Corporation Isolation Service"]
        GEO_SVC["Geospatial & Duplicate Finder Engine"]
        SLA_SVC["SLA Calculation & Escalation Engine"]
        OTP_SVC["OTP Generation & TextBee SMS Gateway"]
        STORAGE_SVC["Evidence Storage Adapter (S3 / R2 / Mock)"]
    end

    subgraph Persistence ["4. Data & Spatial Persistence Tier"]
        PRISMA["Prisma ORM 5.22 Client"]
        SUPA_PG[("Supabase Managed PostgreSQL 15")]
        POSTGIS["PostGIS Spatial Extension (EPSG:4326)"]
        CRON["Vercel Automated Cron Scheduler"]
    end

    Clients --> MW
    MW --> EdgeRouting
    EdgeRouting --> ServiceLayer
    ServiceLayer --> PRISMA
    PRISMA --> SUPA_PG
    SUPA_PG --- POSTGIS
    CRON -.->|Every 15 mins| ADMIN_API
```

---

## 6. Technology Stack

Verified directly against `package.json` and production codebase:

| Layer / Dependency | Technology | Verified Version | Implementation Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) | `14.2.20` | Server-Side Rendering (SSR), React Server Components, Route Handlers. |
| **UI Library** | React / React-DOM | `18.3.1` | Declarative UI components, state hooks, and client hydration. |
| **Language** | TypeScript | `5.7.2` | Full end-to-end type safety from database models to frontend components. |
| **Styling** | Tailwind CSS | `3.4.16` | Utility-first responsive styling with dark/light mode and WCAG contrast. |
| **CSS Processing** | PostCSS / Autoprefixer | `8.4.49` / `10.4.20` | Cross-browser CSS prefixing and optimization. |
| **ORM** | Prisma | `5.22.0` | Type-safe query building, schema migrations, and relational modeling. |
| **Database** | PostgreSQL + PostGIS | `15.x` | Managed on Supabase with PostGIS spatial geometry indexing (`GIST`). |
| **Password Security** | Node.js Crypto (`scrypt`) | Native | NIST-compliant password hashing with 16-byte cryptographically secure salt. |
| **Testing Engine** | Vitest | `2.1.8` | High-speed unit and integration testing with TypeScript execution. |
| **E2E Testing** | Playwright Test | `1.64.1` | Automated end-to-end browser lifecycle testing across Chrome and WebKit. |
| **Accessibility Audit** | `@axe-core/playwright` | `4.14.0` | Automated WCAG 2.1 AA accessibility compliance testing. |
| **Testing Utilities** | Testing Library | `16.0.1` | Component-level DOM and event verification. |
| **Hosting & CI/CD** | Vercel Serverless | Managed | Automatic GitHub deployment, edge caching, and serverless executions. |
| **SMS Gateway** | TextBee.dev API | v1 REST | SMS OTP dispatch to Indian mobile numbers (+91). |

---

## 7. System Requirements

### Development Environment
* **Node.js:** `v18.18.0` or `v20.x` LTS recommended.
* **Package Manager:** `npm` (v9.x or v10.x).
* **Git:** Installed and configured with your GitHub credentials.
* **Recommended Editor:** Visual Studio Code with the *Prisma*, *Tailwind CSS IntelliSense*, and *TypeScript* extensions.

### Cloud Services & Accounts
* **Supabase Account:** Free or Pro plan providing a PostgreSQL 15 database instance with PostGIS enabled.
* **Vercel Account:** For hosting serverless frontend and API route handlers.
* **TextBee Account (Optional for SMS):** For live SMS OTP delivery to mobile devices (development can run with `ENABLE_DEMO_OTP="true"`).

---

## 8. Local Installation and Setup

### 1. Clone the Repository
```bash
git clone https://github.com/ganeshkapurel/GOVT-ASSET.git
cd GOVT-ASSET
```

### 2. Install Project Dependencies
```bash
npm install
```

### 3. Configure Local Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Open `.env` in your editor and enter your Supabase database credentials (see Section 9 for details).

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Seed Demonstration Municipal Accounts (Optional)
```bash
npm run seed:demo
```
This populates sample demonstration data including Chhatrapati Sambhajinagar Municipal Corporation (CSMC), wards, departments, and pre-configured evaluation accounts.

### 6. Start the Next.js Development Server
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 9. Environment Variables Configuration

The repository includes a safe, sanitized template in [`.env.example`](./.env.example). **Never commit actual passwords or API secrets to version control.**

| Variable Name | Required | Default / Example Value | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://postgres.[REF]:[PWD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` | Supabase Transaction Pooler URL (Port 6543) for runtime queries. |
| `DIRECT_URL` | **Yes** | `postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres` | Supabase Direct Session URL (Port 5432) for Prisma migrations and schema push. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `https://[PROJECT-REF].supabase.co` | Supabase project endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | `eyJhbGciOi...` | Supabase public anonymous client key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `eyJhbGciOi...` | Supabase server-side service role key (kept strictly private). |
| `AUTH_SECRET` | **Yes** | `64-character-hex-string` | Secret key used to sign and seal HTTP-only session cookies. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` (Local) / `https://govt-asset.vercel.app` (Prod) | Canonical base URL of the application. |
| `TEXTBEE_API_KEY` | Optional | `txb_...` | TextBee.dev API key for live Indian SMS OTP delivery. |
| `TEXTBEE_DEVICE_ID` | Optional | `android-device-id` | Specific Android device gateway configured in TextBee dashboard. |
| `ENABLE_DEMO_OTP` | Optional | `"true"` | When enabled, permits sandbox OTP `123456` for rapid evaluation. |
| `NEXT_PUBLIC_ENABLE_DEMO_CREDENTIALS` | Optional | `"true"` | Renders 1-click pilot evaluation credentials below login forms. |
| `S3_MOCK` | Optional | `"1"` | Uses local simulated storage instead of live Cloudflare R2 / AWS S3 buckets. |
| `NEXT_PUBLIC_DEFAULT_LAT` | Optional | `"19.8762"` | Default map center latitude (Chhatrapati Sambhajinagar). |
| `NEXT_PUBLIC_DEFAULT_LNG` | Optional | `"75.3433"` | Default map center longitude. |

### Configuring in Vercel
1. Open your project in the **Vercel Dashboard**.
2. Navigate to **Settings** &rarr; **Environment Variables**.
3. Add the exact keys listed above for your **Production** and **Preview** environments.
4. Trigger a redeployment for variables to take effect.

---

## 10. Database Architecture & Setup

GovAsset uses **Prisma ORM** backed by **Supabase PostgreSQL 15** with spatial data handled by the **PostGIS** extension.

### Core Database Entities

```
+---------------------------------------------------------------------------------------------------+
|                                     GOVASSET DATABASE SCHEMA                                      |
+----------------------+----------------------------------------------------------------------------+
| Entity               | Implementation Details                                                     |
+----------------------+----------------------------------------------------------------------------+
| `Jurisdiction`       | Multi-level administrative bodies: STATE -> DISTRICT_CORP -> ZONE -> WARD. |
|                      | Stores boundary polygons via PostGIS `geometry(MultiPolygon, 4326)`.       |
+----------------------+----------------------------------------------------------------------------+
| `Department`         | Civic branches: Road Maintenance, Electrical, Water & Sewerage, etc.     |
+----------------------+----------------------------------------------------------------------------+
| `User`               | Role-Based Access Control entity (CITIZEN, OFFICER, SUPERVISOR,            |
|                      | FIELD_WORKER, DEPT_ADMIN, PLATFORM_ADMIN) with scrypt password hashes.    |
+----------------------+----------------------------------------------------------------------------+
| `ComplaintCategory`  | Taxonomy of civic defects with bilingual naming (English & Hindi).         |
+----------------------+----------------------------------------------------------------------------+
| `SlaPolicy`          | SLA response and resolution timeframes mapped per Category and Priority.  |
+----------------------+----------------------------------------------------------------------------+
| `Complaint`          | Central work order entity containing referenceNumber, PostGIS coordinates  |
|                      | `geometry(Point, 4326)`, FSM status, OCC version, and SLA deadlines.      |
+----------------------+----------------------------------------------------------------------------+
| `ComplaintEvidence`  | Photographic proofs for intake, repairs, and disputes with GPS metadata.  |
+----------------------+----------------------------------------------------------------------------+
| `ComplaintAssignment`| Work order dispatch records binding complaints to assigned field workers.  |
+----------------------+----------------------------------------------------------------------------+
| `ComplaintTimeline`  | Immutable, append-only audit trail logging every status transition.        |
+----------------------+----------------------------------------------------------------------------+
| `Notification`       | Delivery audit trail capturing outgoing SMS and email dispatch states.    |
+----------------------+----------------------------------------------------------------------------+
```

### Database Synchronization Commands
```bash
# Push Prisma schema directly to your Supabase PostgreSQL instance
npx prisma db push

# Launch Prisma Studio to inspect data visually in your browser
npx prisma studio
```

---

## 11. Main Application Modules

1. **Authentication & Session Module (`src/server/auth.ts`, `src/lib/auth-session.ts`):** Handles citizen OTP and official password verification, issuing sealed, encrypted HTTP-Only cookies. Includes dynamic DB freshness validation (`validateSessionFreshness`).
2. **Complaint Management Module (`src/server/complaint-service.ts`):** Manages grievance creation, priority calculation, duplicate linkage, and SLA deadline provisioning.
3. **Jurisdiction & Multi-Corporation Isolation (`src/server/auth.ts`):** Traverses the administrative hierarchy (`getCorporationIdForJurisdiction`) ensuring officers from one municipal corporation cannot view or alter complaints in another.
4. **Workforce Orchestration Module (`src/app/api/v1/ops/workers/`):** Manages technician profiles, specialized trade skills, and live work order capacity.
5. **Quality Verification Engine (`src/app/api/v1/ops/complaints/[id]/verify/`):** Audits photographic evidence and GPS proximity before permitting status progression to `VERIFIED_RESOLVED`.
6. **Automated SLA & Auto-Close Engine (`src/app/api/v1/admin/auto-close/`):** Automatically closes resolved complaints after 72 hours of citizen inactivity and flags overdue work orders.
7. **PII Masking & Privacy Module (`src/lib/pii.ts`):** Masks sensitive telephone numbers (`+91 98*** **381`) across all operational consoles in accordance with India's DPDP Act 2023.

---

## 12. Complaint Lifecycle & Finite State Machine

GovAsset prevents arbitrary database updates by enforcing a deterministic Finite State Machine (FSM) backed by **Optimistic Concurrency Control (OCC)** version checking in [`src/server/fsm.ts`](./src/server/fsm.ts):

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: Citizen Submits Report (Photo + GPS)

    SUBMITTED --> TRIAGED_VALIDATED: Triage Officer Validates Legitimacy
    SUBMITTED --> REJECTED_INVALID: Rejected with Reason (Spam / Out of Scope)
    SUBMITTED --> DUPLICATE_LINKED: Merged with Existing Case (within 150m)

    TRIAGED_VALIDATED --> ASSIGNED: Dispatched to Department Field Crew Lead
    ASSIGNED --> IN_PROGRESS: Field Worker Clicks "Start Work" On Site

    IN_PROGRESS --> WORK_COMPLETED: Worker Submits "After Repair" Photo Proof

    WORK_COMPLETED --> VERIFIED_RESOLVED: Field Quality Supervisor Inspects & Approves
    WORK_COMPLETED --> IN_PROGRESS: Supervisor Orders Rework (Substandard Repair)

    VERIFIED_RESOLVED --> CLOSED: Citizen Confirms or 72-Hour Auto-Close Timer
    VERIFIED_RESOLVED --> DISPUTED_REOPENED: Citizen Disputes Quality (within 7 Days)

    DISPUTED_REOPENED --> IN_PROGRESS: Reassigned for Corrective Maintenance
    CLOSED --> [*]
    REJECTED_INVALID --> [*]
```

---

## 13. API Documentation

All API routes follow REST conventions under `/api/v1/`:

| Endpoint | Method | Purpose | Authentication Required |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | SRE Liveness & Latency Probe (DB, Supabase, Commit Hash) | Public |
| `/api/v1/auth/otp/request` | `POST` | Generate and dispatch 6-digit SMS OTP to citizen mobile | Public (Rate-limited) |
| `/api/v1/auth/otp/verify` | `POST` | Verify OTP token and issue citizen session cookie | Public |
| `/api/v1/auth/login` | `POST` | Staff login via email/phone and password hash | Public |
| `/api/v1/auth/logout` | `POST` | Invalidate and clear active session cookie | Authenticated |
| `/api/v1/auth/me` | `GET` | Return authenticated user profile and permissions | Authenticated |
| `/api/v1/complaints` | `POST` | Submit a new citizen grievance with coordinate stamp | Public / Citizen |
| `/api/v1/complaints/track` | `GET` | Public lookup of complaint by reference code or phone | Public |
| `/api/v1/complaints/categories` | `GET` | List active municipal defect categories and SLA terms | Public |
| `/api/v1/complaints/[id]/dispute` | `POST` | Citizen dispute submission within 7-day window | Citizen / Public |
| `/api/v1/citizen/my-complaints` | `GET` | Retrieve complaint history for logged-in citizen | Citizen Role |
| `/api/v1/ops/complaints/[id]` | `GET` | Retrieve operational complaint details and eligible workers | Staff Roles |
| `/api/v1/ops/complaints/[id]/triage` | `POST` | Validate, adjust priority, or reject complaint | Officer / Supervisor |
| `/api/v1/ops/complaints/[id]/assign` | `POST` | Assign field maintenance worker to work order | Officer / Supervisor / Admin |
| `/api/v1/ops/complaints/[id]/verify` | `POST` | Approve resolution or return work order for rework | Supervisor / Admin |
| `/api/v1/ops/field/tasks` | `GET` | Retrieve active tasks assigned to logged-in worker | Field Worker Role |
| `/api/v1/ops/complaints/[id]/field-status` | `POST` | Update worker progress (`START_WORK`, `SUBMIT_WORK`) | Field Worker Role |
| `/api/v1/ops/queue` | `GET` | Filterable operations grievance queue and metrics | Staff Roles |
| `/api/v1/ops/verifications` | `GET` | List work orders awaiting supervisory quality review | Staff Roles |
| `/api/v1/ops/workers` | `GET`/`POST` | List and onboard field technicians | Officer / Supervisor / Admin |
| `/api/v1/admin/auto-close` | `POST` | Automated cron job to auto-close resolved complaints | Platform Admin / Cron Secret |

---

## 14. Project Folder Structure

```
GOVT-ASSET/
├── docs/                       # Comprehensive Architecture, PRD, Runbook & Audit Specs
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── OPERATIONS.md
│   ├── PRD.md
│   └── RUNBOOK.md
├── prisma/                     # Database Schema & Seed Data
│   ├── schema.prisma           # 9 Relational Models with PostGIS Geometries
│   └── seed-demo-accounts.ts   # Demonstration Pilot Account Seeder
├── public/                     # Static Brand Icons & Logos
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (admin)/            # Platform Administrator Portal
│   │   │   └── admin/          # SLA Matrix, Jurisdictions & System Logs
│   │   ├── (auth)/             # Authentication Flow
│   │   │   └── login/          # Multi-Tab Login Page (Citizen / Staff / Demos)
│   │   ├── (citizen)/          # Citizen Public Flow
│   │   │   ├── my-complaints/  # Citizen Personal Grievance Dashboard
│   │   │   ├── report/         # 60s Issue Submission with GPS & Camera
│   │   │   ├── track/          # Public Live Tracking & Dispute Screen
│   │   │   └── page.tsx        # Public Citizen Landing Page
│   │   ├── (ops)/              # Municipal Operations Portal
│   │   │   └── ops/
│   │   │       ├── assigned/   # Active Work Order Monitoring
│   │   │       ├── complaints/ # Central Complaints Queue & Crew Dispatch
│   │   │       ├── crew/       # Workforce Directory & Onboarding
│   │   │       ├── field/      # Mobile-Optimized Field Crew Task Console
│   │   │       └── verifications/ # Side-by-Side Photographic Quality Audit
│   │   └── api/                # REST API Route Handlers (/api/v1/*)
│   ├── components/             # Reusable UI Primitives & Domain Components
│   │   ├── citizen/            # Citizen Modals, Trackers & Feedback Cards
│   │   ├── ops/                # Case Drawers, Assignment & Rework Modals
│   │   ├── shared/             # Theme Toggle, Gauges & Trend Charts
│   │   └── ui/                 # Accessible Button, Input, Modal & Badge Tokens
│   ├── context/                # React State Contexts (OpsContext)
│   ├── lib/                    # Shared Technical Utilities
│   │   ├── auth-crypto.ts      # Scrypt Password Hashing & Timing-Safe Equality
│   │   ├── auth-session.ts     # Stateless Sealed Cookie Engine
│   │   ├── db.ts               # Resilient Prisma Client Singleton
│   │   ├── geo.ts              # Haversine GPS Distance Formulas
│   │   ├── pii.ts              # DPDP Act 2023 Masking Utilities
│   │   └── rbac.ts             # Role-Based Access Control Permissions Matrix
│   ├── server/                 # Core Server-Side Business Services
│   │   ├── auth.ts             # Multi-Corporation Isolation & Session Checks
│   │   ├── complaint-service.ts# Complaint Lifecycles & Dispatch Orchestrator
│   │   ├── duplicate-finder.ts # 150m Spatial Duplicate Grouping Engine
│   │   ├── fsm.ts              # Finite State Machine & OCC Version Locks
│   │   └── otp-service.ts      # OTP Generation & TextBee Gateway Engine
│   └── middleware.ts           # Next.js Edge Middleware for Route Protection
├── tests/                      # Automated Vitest & Playwright Test Suites
│   ├── e2e/                    # Playwright P0 Full Lifecycle Browser Specs
│   ├── integration/            # Multi-Corporation & Workflow Tests
│   └── unit/                   # FSM, Geocoding, RBAC & Crypto Unit Tests
├── .env.example                # Safe Sanitized Environment Template
├── package.json                # Project Dependencies & Build Scripts
├── tailwind.config.ts          # Tailwind Theme Tokens & Contrast Standards
├── tsconfig.json               # Strict TypeScript Compiler Configuration
└── vercel.json                 # Vercel Deployment & Cron Configuration
```

---

## 15. Testing & Quality Assurance

GovAsset maintains over 570 verified unit, integration, and end-to-end tests:

```bash
# Run the complete Vitest test suite
npm run test

# Run end-to-end Playwright browser tests
npm run test:e2e

# Run linter and type-checking
npm run lint
```

### Key Automated Verification Suites
* **FSM State Transitions (`tests/unit/fsm-transitions.test.ts`):** Confirms that invalid state transitions (e.g., jumping from `SUBMITTED` directly to `CLOSED`) are rejected.
* **Separation of Duties & RBAC (`tests/unit/rbac.test.ts`):** Asserts that Triage Officers cannot self-approve work orders and workers cannot assign complaints.
* **Multi-Corporation Tenant Isolation (`tests/unit/jurisdiction-isolation.test.ts`):** Guarantees that officials from one corporation cannot access data from another.
* **Accessibility Audit (`tests/unit/accessibility-audit.test.tsx`):** Confirms zero critical violations under WCAG 2.1 AA standards.

---

## 16. Deployment on Vercel

The application is deployed on Vercel with automated continuous deployment connected to the `main` branch:

1. **Framework Preset:** Next.js
2. **Build Command:** `prisma generate && next build`
3. **Output Directory:** `.next`
4. **Automated Scheduled Jobs (`vercel.json`):**
   ```json
   {
     "crons": [
       {
         "path": "/api/v1/admin/auto-close",
         "schedule": "*/15 * * * *"
       }
     ]
   }
   ```
   Runs every 15 minutes to inspect resolved grievances and automatically close tickets whose 72-hour dispute window has expired.

---

## 17. Security & Compliance

* **Role-Based Access Control (RBAC):** Every API route strictly verifies the caller's role (`CITIZEN`, `OFFICER`, `SUPERVISOR`, `FIELD_WORKER`, `PLATFORM_ADMIN`) and corporation boundary.
* **Stateless Sealed Cookies:** Authentication tokens are stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies, mitigating Cross-Site Scripting (XSS) token theft.
* **NIST-Grade Password Hashing:** Node.js native `crypto.scrypt` with a 16-byte random salt and constant-time buffer comparison (`crypto.timingSafeEqual`) prevents side-channel timing attacks.
* **DPDP Act 2023 Compliance:** Citizen telephone numbers are masked (`+91 98*** **381`) across all operational consoles.
* **SQL Injection Immunity:** 100% of database interactions are compiled through Prisma ORM parameterized queries.
* **CSRF Protection:** State-changing endpoints validate `Sec-Fetch-Site` and `Origin` headers against authorized hostnames.

---

## 18. Current Project Status & Limitations

### Fully Implemented
* Complete 7-step complaint lifecycle from citizen report to supervisory verification.
* Multi-corporation hierarchical scoping (CSMC and PMC).
* Smart skill-based technician assignment with category validation.
* Real-time GPS distance verification between citizen report and repair proof.
* TextBee SMS gateway integration for real Indian mobile OTP delivery.
* Automated 72-hour dispute window and cron auto-close execution.
* 1-click pilot evaluation demo accounts on the login screen.

### Known Limitations & Configurable Options
* **Storage Provider:** The system currently operates with a local mock storage adapter (`S3_MOCK="1"`) for zero-cost pilot demonstration. For enterprise scale, Cloudflare R2 or AWS S3 credentials can be supplied via environment variables without modifying source code.
* **SMS Gateway:** Live SMS delivery requires an active Android device bridge on TextBee; demo OTP (`ENABLE_DEMO_OTP="true"`) remains available as a reliable fallback.

---

## 19. Future Scope

* **Native Mobile Apps:** Offline-first Android and iOS applications using React Native for field workers in areas with intermittent connectivity.
* **AI Damage Classification:** Computer vision models to classify pothole severity and defect categories automatically from citizen intake photographs.
* **IoT Sensor Integration:** Automated grievance creation triggered by smart water pressure sensors and smart streetlight controllers.
* **Expanded GIS Boundary Polygons:** Interactive GeoJSON ward polygon mapping for municipal corporations across all Indian states.

---

## 20. Contributors & License

* **Developer:** **Ganesh Kapure** ([@ganeshkapurel](https://github.com/ganeshkapurel))
* **Repository:** [https://github.com/ganeshkapurel/GOVT-ASSET](https://github.com/ganeshkapurel/GOVT-ASSET)
* **Live Deployment:** [https://govt-asset.vercel.app/](https://govt-asset.vercel.app/)

*This project is developed for civic infrastructure optimization and government pilot evaluation.*
