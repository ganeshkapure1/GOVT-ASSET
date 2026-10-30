# Product Requirements Document (PRD)
## Digital Tracking & Optimization of Government Asset Maintenance (GovAsset)

**Document Version:** 1.0.0  
**Status:** Approved for Implementation Planning  
**Last Updated:** October 2026  
**Target Delivery Window:** 16-Week Phased Rollout  
**Planned Capital Budget:** ₹10,00,000 (INR 10 Lakhs)  

---

### 1. Executive Summary & Product Vision

#### 1.1 Vision Statement
GovAsset is a unified, transparent, and auditable civic technology platform designed to transform public infrastructure maintenance across Indian municipal corporations and regional government bodies. The platform connects citizens, municipal operations personnel, and executive administrators into a single, closed-loop workflow for reporting, routing, repairing, and verifying physical public assets—including roads, streetlights, water supply networks, sanitation facilities, and public buildings.

#### 1.2 Purpose of this Specification
This Product Requirements Document establishes the unambiguous functional baseline, operational rules, security perimeters, and quality gates for GovAsset. It serves as the primary contract between product management, engineering agents, UI/UX designers, and civic stakeholders. Every architectural decision, data schema, and implementation task in subsequent documents directly traces back to the requirements defined herein.

---

### 2. Problem Statement & Current Challenges

Public infrastructure maintenance across Indian urban and semi-urban local bodies (ULBs) currently suffers from acute structural inefficiencies:

1. **Fragmented & Unofficial Reporting Channels:** Citizens report broken streetlights, hazardous potholes, or burst water mains via ad-hoc WhatsApp messages, personal visits to ward offices, or paper-based grievance registers. More than 65% of reports are lost or untracked.
2. **Jurisdictional Ambiguity & Inter-Departmental Friction:** Citizens rarely know whether a damaged road falls under the Public Works Department (PWD), the Municipal Corporation (ULB), the National Highways Authority (NHAI), or a local development authority. Complaints are routinely bounced between departments without ownership.
3. **Ghost Resolutions & Lack of Physical Verification:** Maintenance contractors and field staff frequently mark work orders as "Resolved" without performing work or after substandard repairs. Supervisors lack photo evidence, timestamped location proofs, and field verification loops.
4. **Opaque Citizen Visibility:** Citizens receive zero visibility into who is handling their complaint, the estimated resolution time, or the reason for rejection, breeding distrust in local governance.
5. **No SLA Enforcement or Executive Accountability:** Administrative leadership has no real-time visibility into ward-level backlogs, recurring asset failures, departmental turnaround times, or overdue work orders.

---

### 3. Objectives & Measurable Outcomes

All quantitative targets listed below are **provisional targets** established for the pilot municipal deployment and will be calibrated during initial staging:

| Objective | Metric | Baseline (Manual) | Provisional Target (GovAsset MVP) |
| :--- | :--- | :--- | :--- |
| **Rapid Triage** | Mean Time to Acknowledge (MTTA) | 5–10 business days | `< 24 hours` |
| **Turnaround Time** | Mean Time to Resolve (MTTR) - High Priority | 21+ business days | `< 72 hours` |
| **Turnaround Time** | Mean Time to Resolve (MTTR) - Normal Priority | 45+ business days | `< 7 calendar days` |
| **Verification Integrity** | Field Proof Rate (Before + After Geo-Photos) | `< 5%` | `100% of closed work orders` |
| **Citizen Trust** | First-Time Resolution & Satisfaction Score | Unmeasured (`< 30%` est.) | `> 80% citizen approval` |
| **Duplicate Elimination** | Automated Duplicate Detection Accuracy | `0%` (Manual duplication) | `> 85% grouping within 50m radius` |
| **Data Privacy** | Citizen PII Exposure on Public Endpoints | High risk | `Zero PII leakage (100% masked)` |

---

### 4. Budget, Resourcing & Financial Bounds

The platform operates under a planned capital expenditure and initial runway budget of **₹10,00,000 (INR 10 Lakhs)**. The engineering design must adhere to strict financial discipline, prioritizing managed open-source foundations, cost-effective serverless/container architectures, and zero-egress cloud storage to prevent budget overruns.

```
+-------------------------------------------------------------------------------+
| TOTAL PILOT BUDGET: ₹10,00,000                                                |
+-------------------------------------------------------------------------------+
| [1] Core Cloud Infrastructure & Managed PostgreSQL (12-Mo Pilot)  : ₹2,20,000 |
| [2] Private S3-Compatible Object Storage & CDN (Zero-Egress R2)    : ₹ 80,000 |
| [3] Transactional SMS (DLT-Approved) & Transactional Email Gateways : ₹1,00,000 |
| [4] Security Audit (VAPT), Static Code Analysis & SSL/Domain Setup: ₹1,80,000 |
| [5] Field Staff Training Collateral, Multilingual Localization    : ₹1,20,000 |
| [6] Operational Runway & Unforeseen Contingency Reserve (30%)     : ₹3,00,000 |
+-------------------------------------------------------------------------------+
```

*Architectural Directive:* No proprietary enterprise licenses (e.g., Oracle, Salesforce, ArcGIS) may be introduced. All geospatial operations must utilize open standards (PostGIS / OpenStreetMap / Leaflet).

---

### 5. Stakeholders & Target User Personas

```
+------------------+     +-------------------+     +--------------------+
|  CITIZEN PORTAL  |     |  GOV OPS PORTAL   |     |    ADMIN PORTAL    |
+------------------+     +-------------------+     +--------------------+
| * Rural/Urban    |     | * Triage Officer  |     | * Municipal Admin  |
|   Resident       |     | * Zonal Supervisor|     | * Platform Ops     |
| * Community Rep  |     | * Field Crew Lead |     | * Auditor          |
+------------------+     +-------------------+     +--------------------+
```

#### 5.1 Persona: Ramesh Kumar (Citizen / Resident)
- **Profile:** 38 years old, shop owner in Ward 14. Accesses the web primarily via a budget 4G Android smartphone.
- **Pain Points:** Disgusted by an open sewage drain outside his shop causing health hazards. Submitted paper letters with zero acknowledgment.
- **Needs:** Fast submission in Hindi or English, no mandatory complex app downloads (PWA/mobile web), photo upload, instant SMS reference number, and real-time SMS/WhatsApp status updates.

#### 5.2 Persona: Priya Sharma (Ward Desk / Triage Officer)
- **Profile:** 32 years old, Junior Engineer at Municipal Corporation. Handles triage on desktop while taking calls.
- **Pain Points:** Bombarded with vague complaints ("water bad near temple") with no photo or exact location.
- **Needs:** Clean desktop queue, map pin preview, duplicate grouping suggestions, one-click category re-tagging, and direct assignment to field supervisors with enforceable SLAs.

#### 5.3 Persona: Vikram Singh (Field Maintenance Supervisor / Crew Lead)
- **Profile:** 45 years old, leads a 6-person pothole repair crew. Uses a ruggedized mobile device in sunlight.
- **Pain Points:** Accused of not doing work when materials were delayed; lacks clear daily task lists.
- **Needs:** High-contrast mobile task view, GPS navigation link to site, direct camera capture of completed repair ("After" photo), and one-tap work submission.

#### 5.4 Persona: Dr. A. K. Verma (Platform Super Administrator & Municipal Commissioner)
- **Profile:** Executive leadership overseeing urban governance, civic budgets, and public accountability.
- **Pain Points:** No consolidated dashboard to compare Ward A vs Ward B performance during council meetings.
- **Needs:** Role-based access control, department configuration, SLA threshold management, exportable compliance audit logs, and ward-by-ward performance heatmaps.

---

### 6. User Roles & Permission Boundaries

The system enforces strict Role-Based Access Control (RBAC) combined with **Hierarchical Jurisdiction Scoping**. A government user's permissions are strictly bounded by their assigned `(Jurisdiction ID, Department ID)`.

| Role Code | Role Name | Allowed Portal | Jurisdiction Scope | Core Permissions |
| :--- | :--- | :--- | :--- | :--- |
| `CITIZEN` | Registered Citizen | Citizen Portal | Global (Own data) | Submit issue, view own history, track by ID, submit dispute, provide feedback. |
| `OFFICER` | Desk / Triage Officer | Gov Ops Portal | Assigned Ward / Zone | Review triage queue, validate/reject, assign supervisor, merge duplicates, view reports. |
| `SUPERVISOR` | Zonal Supervisor | Gov Ops Portal | Assigned Zone / Dept | Assign field worker, verify completed field work, return for rework, request deadline extension. |
| `FIELD_WORKER` | Field Crew Lead | Gov Ops Portal | Assigned Work Orders | View assigned tasks, mark in-progress, upload "After" photos/notes, submit for verification. |
| `DEPT_ADMIN` | Departmental Admin | Gov Ops + Admin | Department-wide | Manage departmental users, reassign cross-ward escalations, view departmental analytics. |
| `PLATFORM_ADMIN`| Super Administrator| Platform Admin | System-wide | Configure jurisdictions, departments, categories, SLAs, view audit logs, manage credentials. |

---

### 7. Functional Scope Across the Three Portals

#### 7.1 Portal A: Citizen Portal (Public & Authenticated)
- **Zero-Friction Authentication:** Dual mode:
  1. *Authenticated Citizen:* Fast phone number + OTP verification or Email/Password with JWT sessions.
  2. *Guest Tracking:* Instant lookup of any public reference number (`GOV-YYYY-XXXXX`) without logging in, rendering a sanitized public timeline with citizen PII masked.
- **Complaint Submission Wizard:**
  - Dynamic category selector (Roads, Water, Electrical, Sanitation, Buildings, etc.).
  - Interactive location picker with GPS geolocation auto-fill, map pin adjustment, and reverse-geocoded landmark/address input.
  - Multi-image camera/gallery evidence uploader (up to 3 photos, max 5MB each, client-side auto-compression).
  - Voice note or brief description (up to 500 characters).
  - Severity self-rating (Low, Medium, High / Public Safety Hazard).
- **Citizen Dashboard & History:**
  - Chronological list of user-submitted complaints with real-time status badges.
  - Interactive status timeline showing exact dates, acting departments, and public notes.
  - Before/After photo comparison viewer upon resolution.
- **Dispute & Feedback Engine:**
  - 5-star rating and satisfaction comments upon resolution.
  - "Dispute Resolution" trigger available within 7 calendar days of resolution if the physical issue persists, returning the complaint to senior supervisor review.

#### 7.2 Portal B: Government Operations Portal
- **Operational Triage Inbox:**
  - Filterable by Jurisdiction (Zone/Ward), Category, Severity, SLA Health (On-Track, At-Risk, Breached).
  - Side-by-side view of citizen photos, reverse-geocoded map location, and system-suggested duplicates within 100 meters.
- **Triage & Validation Actions:**
  - *Accept & Route:* Assign priority (P1-Critical to P4-Low), set target completion deadline, assign to field team.
  - *Reject with Reason:* Select standardized reason code (Out of Jurisdiction, Duplicate, Private Property, Insufficient Info) + mandatory explanation sent to citizen.
  - *Merge Duplicate:* Link secondary complaint to primary ticket; secondary citizen automatically receives master updates.
- **Field Worker Dispatch & Execution:**
  - Crew dispatch with direct worker contact linking.
  - Field Worker Mobile Web View: Low-bandwidth, high-contrast interface showing pending work orders, turn-by-turn map links, work checklists.
  - Mandatory "After Repair" photographic evidence upload with EXIF/device timestamp validation and GPS proximity check (warning if upload > 200m from complaint origin).
- **Supervisor Verification Workflow:**
  - Dedicated "Pending Verification" queue for completed field tasks.
  - One-click *Approve & Mark Resolved* or *Return for Rework* with mandatory rework instructions.

#### 7.3 Portal C: Platform Administrator Portal
- **Jurisdictional & Organizational Hierarchy Management:**
  - Dynamic tree management: State -> Municipal Corporation / District -> Zones -> Wards / Beats.
  - Department management: Public Works, Jal Board, Public Health & Sanitation, Electricity/Lighting, Parks & Horticulture.
- **Category & SLA Taxonomy Engine:**
  - Manage complaint categories and subcategories.
  - Define SLA targets per `(Category, Priority)` tuple:
    - *Example:* `Streetlight Broken` + `P3` = 48hr MTTR; `Water Main Burst` + `P1` = 12hr MTTR.
  - Configure multi-tier escalation hierarchy (Auto-alert Department Admin if ticket breached by 1.5x SLA).
- **User Directory & RBAC Provisioning:**
  - Invite government officers via email/SMS with temporary credentials.
  - Granular assignment of `(Role, Department, Jurisdiction)` tuples.
  - Instant account suspension and password revocation.
- **Security, Audit & System Observability:**
  - Immutable audit logs capturing every user login, status transition, assignment change, and PII view.
  - Notification delivery health dashboard tracking SMS/Email gateway failure rates and retry queues.
  - Executive KPI reports: Ward SLA compliance rankings, recurring pothole heatmaps, contractor turnaround times.

---

### 8. Detailed End-to-End Business Workflows

#### 8.1 Primary Golden Path (End-to-End Lifecycle)

```
[Citizen] Submits Complaint (Photo + GPS + Category)
    │
    ▼
[System] Validates Payload, Assigns Ref: GOV-2026-00482, Identifies Ward & Dept via GIS Rules
    │
    ▼
[Gov Ops] In-App Alert to Ward Triage Queue; SMS confirmation to Citizen
    │
    ▼
[Triage Officer] Validates Complaint, Sets Priority: P2, Assigns Zonal Supervisor
    │
    ▼
[Supervisor] Dispatches Work Order to Field Crew Lead (Vikram)
    │
    ▼
[Field Crew] Inspects, Performs Repair, Uploads "After" Photo + GPS stamp, Marks "Work Completed"
    │
    ▼
[Supervisor] Reviews Evidence in Verification Queue, Approves Resolution
    │
    ▼
[System] Marks Status: "Verified Resolved", Dispatches SMS to Citizen with Feedback Link
    │
    ▼
[Citizen] Reviews Before/After Photos, Submits 5-Star Rating, Ticket Auto-Closes after 7 Days
```

#### 8.2 Exception & Edge-Case Workflows

```
                        [Complaint Submitted]
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  [Invalid/Private]      [Duplicate Report]        [SLA Breach]
         │                        │                        │
         ▼                        ▼                        ▼
  Reject with Reason      Merge to Master ID       Escalation Engine
  (Citizen notified       (Citizen receives        Triggers Level-2
  with appeal option)     all master updates)      Alert to Dept Head
                                  │
                                  ▼
                        [Field Work Executed]
                                  │
                        [Supervisor Review]
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[Rework Required]                                 [Approved Resolved]
         │                                                 │
  Sent back to Worker                             Citizen 7-Day Window
  with corrective note                                     │
                                          ┌────────────────┴────────────────┐
                                          ▼                                 ▼
                                  [Dispute Raised]                  [Accepted / Timeout]
                                          │                                 │
                                   Supervisor Review              Ticket Closed (Archived)
```

1. **Invalid or Out-of-Jurisdiction Report:**
   - Officer marks complaint as `REJECTED_INVALID`.
   - Mandatory selection of rejection reason category + free-text remark (min 20 characters).
   - Citizen receives notification with full explanation and appeal link.
2. **Duplicate Grouping:**
   - When 2+ complaints are submitted for the same category within 50 meters in a 48-hour window, the system flags potential duplicates.
   - Officer links Child Complaint to Parent Complaint. Child complaint transitions to `DUPLICATE_LINKED`.
   - Any status transition on Parent Complaint broadcasts mirrored public updates to Child Complaint reporters.
3. **Field Rework Loop:**
   - If supervisor inspects "After" photo or physical site and finds substandard repair, supervisor marks `RETURNED_FOR_REWORK`.
   - Ticket reverts to `IN_PROGRESS` with mandatory rework instructions. SLA clock does not reset; overdue metrics highlight rework penalties.
4. **Citizen Dispute Workflow:**
   - Following `VERIFIED_RESOLVED`, citizen has 7 calendar days to inspect the site.
   - If pothole was merely filled with loose gravel and washed away, citizen taps "Dispute Resolution" and uploads a new photo.
   - Status transitions to `DISPUTED_REOPENED`. Ticket is routed directly to the Department Head / Executive Supervisor queue, bypassing the initial triage officer.
5. **Notification Delivery Failure:**
   - If transactional SMS gateway returns delivery failure (DND active, network out), system automatically falls back to transactional Email (if email exists).
   - The notification job logs delivery failure in the audit log; notification banner appears in Citizen web portal upon next visit.

---

### 9. Complete Complaint Lifecycle & State Machine

Every complaint strictly follows a deterministic finite state machine (FSM). Unauthorized transitions are rejected at the database and API layer.

```
+---------------+     +--------------------+     +------------------+
|   SUBMITTED   | --> | TRIAGED_VALIDATED  | --> |     ASSIGNED     |
+---------------+     +--------------------+     +------------------+
        │                       │                          │
        ├─> REJECTED_INVALID    └─> DUPLICATE_LINKED       ▼
        │                                          +------------------+
        │                                          |   IN_PROGRESS    |
        │                                          +------------------+
        │                                                  │
        │                                                  ▼
        │                                          +------------------+
        │                                          |  WORK_COMPLETED  |
        │                                          +------------------+
        │                                            │              ▲
        │                                            ▼              │ (Rework)
        │                                    +---------------+      │
        │                                    |   VERIFIED_   | ─────┘
        │                                    |   RESOLVED    |
        │                                    +---------------+
        │                                      │           │
        │                        (7-Day Timer) ▼           ▼ (Citizen Dispute)
        │                                +--------+     +-------------+
        │                                | CLOSED |     |  DISPUTED_  |
        │                                +--------+     |  REOPENED   |
        │                                               +-------------+
```

#### 9.1 State Transition Matrix

| Initial State | Target State | Permitted Actor Roles | Pre-conditions & Validation Rules | Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `[None]` | `SUBMITTED` | `CITIZEN`, `SYSTEM` | Valid title, category, ward, lat/lng, min 1 photo. | Generate reference number; run GIS routing; send confirmation SMS. |
| `SUBMITTED` | `TRIAGED_VALIDATED` | `OFFICER`, `DEPT_ADMIN`, `PLATFORM_ADMIN` | Officer belongs to assigned ward; priority assigned. | SLA target calculated; notify supervisor. |
| `SUBMITTED` | `REJECTED_INVALID` | `OFFICER`, `DEPT_ADMIN`, `PLATFORM_ADMIN` | Mandatory rejection reason code + explanation >= 20 chars. | Citizen notified with appeal instructions; SLA clock halted. |
| `SUBMITTED` | `DUPLICATE_LINKED` | `OFFICER`, `DEPT_ADMIN` | Valid parent complaint ID provided within same category. | Linked to parent; child citizen notified of tracking link. |
| `TRIAGED_VALIDATED`| `ASSIGNED` | `OFFICER`, `SUPERVISOR`, `DEPT_ADMIN` | Field worker/team ID assigned; target date specified. | Work order created; field worker alerted via push/SMS. |
| `ASSIGNED` | `IN_PROGRESS` | `FIELD_WORKER`, `SUPERVISOR` | Worker acknowledges work order. | Public timeline updated to "Work In Progress". |
| `IN_PROGRESS` | `WORK_COMPLETED` | `FIELD_WORKER`, `SUPERVISOR` | Min 1 "After" photo uploaded; completion notes recorded. | Supervisor moved to Verification queue; alert dispatched. |
| `WORK_COMPLETED` | `RETURNED_FOR_REWORK` | `SUPERVISOR`, `DEPT_ADMIN` | Verification rejected; mandatory rework remarks >= 20 chars. | Reverts to `IN_PROGRESS`; worker alerted; rework counter incremented. |
| `WORK_COMPLETED` | `VERIFIED_RESOLVED` | `SUPERVISOR`, `DEPT_ADMIN` | Supervisor approves evidence quality; physical inspection note. | Citizen notified; 7-day dispute window opens; feedback form sent. |
| `VERIFIED_RESOLVED`| `CLOSED` | `SYSTEM` (Timeout), `CITIZEN` | 7 calendar days elapsed without dispute, or citizen marked "Satisfied". | Permanent archive status; feedback metrics logged. |
| `VERIFIED_RESOLVED`| `DISPUTED_REOPENED`| `CITIZEN` | Within 7 days of resolution; mandatory dispute photo + text. | Escalated to Department Admin; rework alert triggered. |

---

### 10. Regional & Departmental Routing Engine

#### 10.1 Civic Administrative Hierarchy
The platform establishes a strict four-level spatial and administrative containment hierarchy:

$$\text{State (e.g., Maharashtra)} \longrightarrow \text{Municipal Corporation (e.g., Pune Municipal Corporation)}$$
$$\longrightarrow \text{Administrative Zone (e.g., Zone 4 - Kothrud)} \longrightarrow \text{Electoral Ward / Beat (e.g., Ward 28 - Mayur Colony)}$$

#### 10.2 Routing Algorithm Logic
When a complaint is submitted:
1. **Spatial Geocoding:** The coordinates `(latitude, longitude)` are evaluated against Ward boundary polygons stored in PostGIS.
2. **Fallback Geocoding:** If coordinates are outside known polygons (or GPS accuracy is coarse > 100m), the user-selected Ward dropdown takes precedence.
3. **Category-Department Mapping Matrix:**
   - `CAT_ROADS` (Potholes, broken pavers, cave-ins) $\rightarrow$ `DEPT_ROAD_MAINTENANCE` (PWD / Municipal Works)
   - `CAT_STREETLIGHT` (Dark bulb, open wire, timer fault) $\rightarrow$ `DEPT_ELECTRICAL`
   - `CAT_DRAINAGE_WATER` (Burst pipe, open drain, contaminated water) $\rightarrow$ `DEPT_WATER_SEWERAGE`
   - `CAT_SANITATION` (Garbage dump, animal carcass, public toilet) $\rightarrow$ `DEPT_SOLID_WASTE`
   - `CAT_BUILDINGS_PARKS` (Damaged boundary, broken play equipment) $\rightarrow$ `DEPT_HORTICULTURE_CIVIC_ASSETS`
4. **Queue Assignment:** The ticket is routed to `Queue(Ward_ID, Department_ID)`. All active Triage Officers assigned to that Ward and Department receive real-time dashboard notifications.
5. **Fallback Default Queue:** If no active officer exists for `(Ward_ID, Department_ID)`, the system routes the ticket to `Zone_Supervisor_Queue` with an `UNASSIGNED_JURISDICTION` alert.

---

### 11. User Stories & Acceptance Criteria

#### 11.1 Citizen User Stories
- **US-CIT-01:** *As a citizen, I want to submit a complaint with a photo and GPS location without creating a complex account, so that I can report civic hazards immediately while on the street.*
  - **Given** I am on the Citizen Portal landing page,
  - **When** I click "Report an Issue", select "Pothole", allow GPS permission, and upload a photo,
  - **Then** the system should display my pin on the map, resolve the address, allow me to enter my mobile number, and submit successfully within 45 seconds.
- **US-CIT-02:** *As a citizen, I want to track my complaint status using only my reference number, so that I can monitor progress without sharing personal credentials.*
  - **Given** I hold a reference number `GOV-2026-00123`,
  - **When** I enter this number in the public tracker,
  - **Then** I see the public timeline (Submitted $\rightarrow$ Assigned $\rightarrow$ In Progress), the assigned department, and estimated completion date, with all personal citizen phone numbers and names masked.
- **US-CIT-03:** *As a citizen, I want to dispute a marked resolution within 7 days, so that false or shoddy repairs are not swept under the rug.*
  - **Given** my complaint is marked `VERIFIED_RESOLVED` 3 days ago,
  - **When** I view the ticket and click "Dispute Resolution", upload a photo of the unrepaired site, and submit,
  - **Then** the complaint status transitions to `DISPUTED_REOPENED` and escalates to the Department Admin.

#### 11.2 Government Operations User Stories
- **US-GOV-01:** *As a Ward Triage Officer, I want to review incoming complaints for my ward in a consolidated list, so that I can prioritize emergencies and filter out spam.*
  - **Given** 15 new complaints arrive across my ward,
  - **When** I open my Triage Inbox,
  - **Then** complaints are sorted by priority and age, with high-priority safety hazards highlighted in red, accompanied by map thumbnails and potential duplicate badges.
- **US-GOV-02:** *As a Field Worker, I want to view my daily work orders on a mobile browser and upload "After" photos directly from my camera, so that I can prove work completion on site.*
  - **Given** a work order is assigned to my crew,
  - **When** I complete the physical road repair, open the GovAsset link on my phone, and snap an "After" photo,
  - **Then** the application captures the photo, verifies my browser GPS is within 200m of the site, records the timestamp, and transitions the status to `WORK_COMPLETED`.
- **US-GOV-03:** *As a Zonal Supervisor, I want to verify completed field work before resolving the ticket, so that public accountability is maintained.*
  - **Given** a work order is in `WORK_COMPLETED` status,
  - **When** I inspect the side-by-side "Before" and "After" photos in my verification drawer,
  - **Then** I can either click "Approve & Resolve" (triggering citizen resolution) or "Return for Rework" with mandatory corrective comments.

#### 11.3 Platform Administrator User Stories
- **US-ADM-01:** *As a Platform Administrator, I want to configure SLA policies per category and priority, so that turnaround standards reflect actual departmental capacities.*
  - **Given** I am in the Admin SLA Management screen,
  - **When** I set `Water Main Burst` + `Critical` to 12 hours response and 24 hours resolution,
  - **Then** any complaint filed under this category automatically calculates breach timestamps based on these rules.
- **US-ADM-02:** *As a Platform Administrator, I want an immutable audit log of all system actions, so that unauthorized data modifications or administrative abuses can be investigated.*
  - **Given** an officer reassigns or rejects a complaint,
  - **When** I view the Audit Log console,
  - **Then** I see the exact actor ID, role, IP address, timestamp, previous state, and new state.

---

### 12. Functional Requirements Matrix

```
+-------------------------------------------------------------------------------+
| FUNCTIONAL REQUIREMENTS SUMMARY                                               |
+-------------------+------------------------------------------+----------------+
| Requirement ID    | Module & Capability                      | Priority (MVP) |
+-------------------+------------------------------------------+----------------+
| FR-CIT-01         | OTP-Based Citizen Authentication         | P0 (Must Have) |
| FR-CIT-02         | Public Anonymous Reference Tracker       | P0 (Must Have) |
| FR-CIT-03         | Multi-Step Issue Submission Wizard       | P0 (Must Have) |
| FR-CIT-04         | Geo-Location Pin & Reverse Geocoding     | P0 (Must Have) |
| FR-CIT-05         | Multi-Image Photo Upload with Preview    | P0 (Must Have) |
| FR-CIT-06         | Public Status Timeline Component         | P0 (Must Have) |
| FR-CIT-07         | Citizen Dispute Submission (7-Day Win)   | P0 (Must Have) |
| FR-CIT-08         | Post-Resolution 5-Star Feedback Form     | P1 (Should)    |
| FR-GOV-01         | Role-Based Triage Inbox (Ward Scoped)    | P0 (Must Have) |
| FR-GOV-02         | Side-by-Side Validation & Duplicate Link | P0 (Must Have) |
| FR-GOV-03         | Work Order Assignment to Field Crew      | P0 (Must Have) |
| FR-GOV-04         | Mobile-Optimized Field Task View         | P0 (Must Have) |
| FR-GOV-05         | "After" Photo Capture with Proximity Warn| P0 (Must Have) |
| FR-GOV-06         | Supervisor Inspection & Rework Drawer    | P0 (Must Have) |
| FR-GOV-07         | Internal Team Notes (Private from Cit.)  | P0 (Must Have) |
| FR-GOV-08         | SLA Countdown Timer & Visual Breach Warn | P0 (Must Have) |
| FR-ADM-01         | Jurisdiction Hierarchy Manager (Ward/Zone) P0 (Must Have) |
| FR-ADM-02         | Department & Category Taxonomy Config    | P0 (Must Have) |
| FR-ADM-03         | User Management & RBAC Provisioning      | P0 (Must Have) |
| FR-ADM-04         | SLA Threshold Matrix Configuration       | P0 (Must Have) |
| FR-ADM-05         | Immutable System Audit Log Viewer        | P0 (Must Have) |
| FR-ADM-06         | Notification Provider Health & Queue Mon | P1 (Should)    |
| FR-SYS-01         | Unique Human-Readable Reference Gen      | P0 (Must Have) |
| FR-SYS-02         | Automated PostGIS Polygon Routing Engine | P0 (Must Have) |
| FR-SYS-03         | Background SLA Escalation Evaluator Cron | P0 (Must Have) |
| FR-SYS-04         | Presigned Direct-to-Storage Upload Pipeline P0 (Must Have) |
+-------------------+------------------------------------------+----------------+
```

---

### 13. Non-Functional Requirements (NFRs)

#### 13.1 Performance & Scalability
- **NFR-PERF-01:** **Page Load Time:** First Contentful Paint (FCP) `< 1.8 seconds` and Time to Interactive (TTI) `< 3.0 seconds` over standard 4G mobile connections.
- **NFR-PERF-02:** **API Latency:** 95th percentile API response time `< 350ms` for read operations and `< 600ms` for write/upload transactions.
- **NFR-PERF-03:** **Concurrency:** System must support at least 500 concurrent active citizen users and 100 concurrent municipal operators without throughput degradation.

#### 13.2 Reliability & Availability
- **NFR-REL-01:** **Uptime SLA:** 99.5% availability during pilot operational hours (06:00 to 22:00 IST).
- **NFR-REL-02:** **Data Durability & RPO/RTO:** Automated daily snapshot backups. Recovery Point Objective (RPO) `< 1 hour`; Recovery Time Objective (RTO) `< 4 hours`.

#### 13.3 Maintainability & Code Quality
- **NFR-MAINT-01:** Complete TypeScript strict typing across frontend and backend layers with zero `any` types in domain logic.
- **NFR-MAINT-02:** Test coverage $\ge 80\%$ on state transitions, jurisdiction authorization, and data isolation logic.

---

### 14. Security, Privacy & Compliance

#### 14.1 Digital Personal Data Protection (DPDP) Act Compliance
- **Data Minimization:** Citizens are required to provide only: Phone Number, GPS/Address, and Issue Photo. No Aadhaar numbers, biometric data, or financial details may be collected.
- **Citizen PII Masking:** Phone numbers must be masked as `+91 ******1234` in all government queues, public tracking endpoints, and audit previews. Full phone numbers are viewable only by authorized officers with an explicit, logged `AUDIT_PII_VIEW` event.
- **Right to Erasure / Archival:** After ticket closure + 180 days, citizen contact identifiers are decoupled from civic complaint records, retaining only anonymized asset failure data for municipal analytics.

#### 14.2 Authorization & Jurisdiction Isolation
- **Server-Side Security Perimeters:** Authorization checks must occur on every backend request. Never trust client-supplied `ward_id` or `department_id`.
- **IDOR Protection:** All entity IDs must use unpredictable UUIDv7 or nanoids. Sequential database integers must never be exposed over API boundaries.
- **Private Evidence Storage:** Photos are stored in private object storage buckets. Client access is strictly mediated via time-limited (15-minute TTL) presigned URLs generated server-side following permission verification.

---

### 15. Accessibility & Multilingual Usability Requirements

#### 15.1 WCAG 2.2 AA Standard
- **Contrast Ratios:** Text must maintain a minimum contrast ratio of `4.5:1` against backgrounds; interactive graphical controls must maintain `3.0:1`.
- **Touch Targets:** All clickable touch targets on mobile viewports must meet or exceed `48px x 48px` with at least 8px spacing.
- **Keyboard & Screen Reader Navigation:** Complete keyboard focus trap management in dialogs, visible focus rings, and explicit ARIA labels on all iconography and map controls.

#### 15.2 Multilingual i18n Architecture
- **Language Support:** Built-in internationalization (i18n) foundation supporting **English** and **Hindi** at MVP launch, with string dictionaries architected to add regional languages (Marathi, Tamil, Kannada, Bengali) via JSON translation files without code refactoring.
- **Font Rendering:** Native support for Unicode Devanagari script via Google Noto Sans / Inter fallback stacks.

---

### 16. Analytics, Dashboards & Reporting Requirements

The system must compute and surface the following core operational metrics:

1. **Departmental Performance Index:**
   $$\text{Compliance Rate} = \left( \frac{\text{Complaints Resolved within SLA}}{\text{Total Assigned Complaints}} \right) \times 100$$
2. **Recurring Defect Hotspots:** PostGIS clustering algorithm identifying spatial groupings of $\ge 5$ pothole or drainage complaints within a 150m radius over 30 days.
3. **Supervisor Verification Backlog:** Real-time count of work orders lingering in `WORK_COMPLETED` without supervisor approval $> 48$ hours.
4. **Dispute Rate:** Ratio of `DISPUTED_REOPENED` complaints relative to total `VERIFIED_RESOLVED` complaints per ward.

---

### 17. Scope Management: MVP vs Future Phases

```
+------------------------------------+------------------------------------+
| IN SCOPE: MVP (Phase 0-11)         | OUT OF SCOPE: Phase 2+ (Post-Pilot)|
+------------------------------------+------------------------------------+
| * 3 Portals (Citizen, Ops, Admin)  | * Automated AI pothole detection   |
| * 5 Civic Departments, Wards/Zones | * Drone video / Lidar ingestion    |
| * Photo Evidence & Presigned URLs  | * Legacy SAP / Municipal ERP sync  |
| * SMS & Email Notifications        | * Biometric field attendance       |
| * State Machine & Strict SLAs      | * Native iOS/Android App Store apps|
| * PostGIS Geocoding & Dupe Flags   | * Payment gateway for civic fines  |
| * English + Hindi Localization     | * Live GPS tracking of repair vans |
+------------------------------------+------------------------------------+
```

---

### 18. Assumptions, Dependencies, Risks & Mitigations

| Risk / Dependency | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Dep. on DLT SMS Registration:** Indian telecom regulations mandate DLT template approvals for bulk SMS. | High | High | Implement transaction email and in-app web notifications as immediate fallbacks; apply for DLT templates during Week 1 of implementation. |
| **Coarse Mobile GPS Accuracy:** Citizens indoors or under trees submit locations with 100m+ error. | Medium | High | Combine auto-GPS with an interactive draggable map pin and mandatory street/landmark text description. |
| **Field Worker Resistance:** Field staff unwilling or unable to use complex mobile software. | High | Medium | Build a zero-login, high-contrast magic-link mobile task interface requiring exactly 3 clicks: "Start", "Snap Photo", "Submit". |
| **Cloud Storage Cost Blowout:** High-resolution smartphone photos exhausting storage budget. | High | Low | Client-side Canvas image compression resizing images to max 1920px width and converting to WebP (`< 800KB`) prior to upload. |

---

### 19. Definition of Done (DoD)

A user story, feature, or phase is officially marked **Done** if and only if:
1. **Functional Completion:** All acceptance criteria under Section 11 are verified and passing.
2. **State Machine Integrity:** All transitions adhere to Section 9.1; invalid transitions throw HTTP 422 with structured error details.
3. **Security Verified:** Jurisdiction boundaries are enforced on the server; citizen PII is masked; presigned URLs have TTL $\le 15$ minutes.
4. **Automated Testing:** Unit and integration tests pass with $\ge 80\%$ branch coverage on core domain logic.
5. **Accessibility Validated:** Zero critical or serious accessibility violations flagged by automated WCAG 2.2 AA linters.
6. **Documentation Updated:** API contracts, database migrations, and operational runbooks reflect code state without discrepancies.
