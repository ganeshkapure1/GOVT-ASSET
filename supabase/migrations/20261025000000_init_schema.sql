-- ==============================================================================
-- GovAsset — Phase 2 Database Schema Migration
-- Managed PostgreSQL 15+ with PostGIS for Supabase
-- ==============================================================================

-- Enable PostGIS & UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------------------------
CREATE TYPE jurisdiction_level AS ENUM ('STATE', 'DISTRICT_CORP', 'ZONE', 'WARD');

CREATE TYPE user_role AS ENUM (
    'CITIZEN',
    'OFFICER',
    'SUPERVISOR',
    'FIELD_WORKER',
    'DEPT_ADMIN',
    'PLATFORM_ADMIN'
);

CREATE TYPE complaint_priority AS ENUM ('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW');

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

CREATE TYPE evidence_stage AS ENUM (
    'BEFORE_SUBMISSION',
    'AFTER_REPAIR',
    'SUPERVISOR_INSPECTION',
    'DISPUTE_PROOF'
);

CREATE TYPE notification_channel AS ENUM ('SMS', 'EMAIL', 'IN_APP');

CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');

-- ------------------------------------------------------------------------------
-- 1. JURISDICTIONS (Pune Municipal Corporation, Zones & Electoral Wards)
-- ------------------------------------------------------------------------------
CREATE TABLE jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    level jurisdiction_level NOT NULL,
    parent_id UUID REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    boundary geometry(MultiPolygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jurisdictions_parent ON jurisdictions(parent_id);
CREATE INDEX idx_jurisdictions_geom ON jurisdictions USING GIST(boundary);

-- ------------------------------------------------------------------------------
-- 2. DEPARTMENTS (Civic Works, Electrical, Water/Sanitation, etc.)
-- ------------------------------------------------------------------------------
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. USERS & RBAC (Role-Based Access Control)
-- ------------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'CITIZEN',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role_jurisdiction ON users(role, jurisdiction_id, department_id);

-- ------------------------------------------------------------------------------
-- 4. COMPLAINT CATEGORIES & SLA POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE complaint_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
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
    response_sla_hours INT NOT NULL,
    resolution_sla_hours INT NOT NULL,
    escalation_hours INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_category_priority UNIQUE (category_id, priority)
);

-- ------------------------------------------------------------------------------
-- 5. COMPLAINTS (FSM Core Table with Spatial PostGIS Coordinates)
-- ------------------------------------------------------------------------------
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(25) UNIQUE NOT NULL,
    citizen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    citizen_phone VARCHAR(15) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES complaint_categories(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    location_coords geometry(Point, 4326) NOT NULL,
    landmark_address TEXT NOT NULL,
    status complaint_status NOT NULL DEFAULT 'SUBMITTED',
    priority complaint_priority NOT NULL DEFAULT 'P3_MEDIUM',
    parent_complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    response_due_at TIMESTAMPTZ NOT NULL,
    resolution_due_at TIMESTAMPTZ NOT NULL,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
    dispute_count INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_complaints_status_jurisdiction ON complaints(status, jurisdiction_id, department_id);
CREATE INDEX idx_complaints_geo ON complaints USING GIST(location_coords);
CREATE INDEX idx_complaints_sla_tracking ON complaints(sla_breached, resolution_due_at)
    WHERE status NOT IN ('VERIFIED_RESOLVED', 'CLOSED', 'REJECTED_INVALID');

-- ------------------------------------------------------------------------------
-- 6. COMPLAINT EVIDENCE (Photo Proofs & Proximity Audits)
-- ------------------------------------------------------------------------------
CREATE TABLE complaint_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    stage evidence_stage NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    file_size_bytes INT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    capture_coords geometry(Point, 4326),
    is_verified_proximity BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidence_complaint ON complaint_evidence(complaint_id);

-- ------------------------------------------------------------------------------
-- 7. COMPLAINT ASSIGNMENTS (Field Work Orders)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 8. COMPLAINT TIMELINE (Deterministic Lifecycle Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE complaint_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    from_status complaint_status,
    to_status complaint_status NOT NULL,
    public_note TEXT,
    internal_note TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timeline_complaint ON complaint_timeline(complaint_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 9. NOTIFICATIONS (DLT SMS & Email Delivery Monitoring)
-- ------------------------------------------------------------------------------
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
