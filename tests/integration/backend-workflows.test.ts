import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createComplaint,
  getTrackedComplaint,
  triageComplaint,
  assignComplaint,
  updateFieldTask,
  verifyComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import { verifyCsrfProtection } from '@/server/auth';
import { POST as submitComplaintHandler } from '@/app/api/v1/complaints/route';
import { POST as triageHandler } from '@/app/api/v1/ops/complaints/[id]/triage/route';
import { POST as assignHandler } from '@/app/api/v1/ops/complaints/[id]/assign/route';
import { POST as fieldStatusHandler } from '@/app/api/v1/ops/complaints/[id]/field-status/route';
import { POST as verifyHandler } from '@/app/api/v1/ops/complaints/[id]/verify/route';
import { NextRequest } from 'next/server';

describe('Phase 4: Backend Workflows & State Machine Integration', () => {
  const citizenSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660008',
    email: 'citizen.aarav@govasset.in',
    phoneNumber: '+919822010008',
    fullName: 'Aarav Mehta',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const officerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660002',
    email: 'officer.kothrud@govasset.in',
    phoneNumber: '+919822010002',
    fullName: 'Rajesh Patil (Ward 28 Officer)',
    role: 'OFFICER',
    departmentId: '44444444-4444-4444-4444-444444440001', // Road Maintenance
    jurisdictionId: '33333333-3333-3333-3333-333333330028', // Ward 28 - Kothrud
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const foreignOfficerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660003',
    email: 'officer.shivaji@govasset.in',
    phoneNumber: '+919822010003',
    fullName: 'Amit Deshmukh (Ward 12 Officer)',
    role: 'OFFICER',
    departmentId: '44444444-4444-4444-4444-444444440002', // Electrical
    jurisdictionId: '33333333-3333-3333-3333-333333330012', // Ward 12
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const supervisorSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660004',
    email: 'supervisor.roads@govasset.in',
    phoneNumber: '+919822010004',
    fullName: 'Kavita Joshi (Supervisor)',
    role: 'SUPERVISOR',
    departmentId: '44444444-4444-4444-4444-444444440001',
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const fieldWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660006',
    email: 'field.vikram@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh (Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: '44444444-4444-4444-4444-444444440001',
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Citizen Complaint Intake & Validation
  // =========================================================================
  describe('1. Citizen Complaint Intake & SLA Provisioning', () => {
    it('validates required fields: rejects empty defect description', async () => {
      await expect(
        createComplaint({
          category: 'CAT_ROADS',
          description: '',
          landmarkAddress: 'Mayur Colony, Kothrud',
          citizenPhone: '+919822010008',
        })
      ).rejects.toThrowError(WorkflowError);
    });

    it('validates required fields: rejects empty landmark address', async () => {
      await expect(
        createComplaint({
          category: 'CAT_ROADS',
          description: 'Deep hazardous trench across arterial lane',
          landmarkAddress: '',
          citizenPhone: '+919822010008',
        })
      ).rejects.toThrowError(WorkflowError);
    });

    it('validates required fields: rejects invalid contact phone number', async () => {
      await expect(
        createComplaint({
          category: 'CAT_ROADS',
          description: 'Deep hazardous trench across arterial lane',
          landmarkAddress: 'Mayur Colony, Kothrud',
          citizenPhone: '123',
        })
      ).rejects.toThrowError(WorkflowError);
    });

    it('creates complaint with P1 priority elevation when hazard is flagged', async () => {
      // Mock db queries
      vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValueOnce({
        id: '55555555-5555-5555-5555-555555550001',
        code: 'CAT_POTHOLE',
        nameEn: 'Damaged Roads & Potholes',
        departmentId: '44444444-4444-4444-4444-444444440001',
        defaultPriority: 'P2_HIGH',
        slaPolicies: [
          { priority: 'P1_CRITICAL', responseSlaHours: 2, resolutionSlaHours: 24, escalationHours: 18 },
        ],
      } as any);

      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValueOnce([
        { id: '33333333-3333-3333-3333-333333330028' },
      ]);

      vi.spyOn(db.complaint, 'count').mockResolvedValueOnce(482);
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(null);

      // Mock transaction
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
          user: { findFirst: vi.fn().mockResolvedValue({ id: citizenSession.userId }) },
        });
      });

      const result = await createComplaint({
        category: 'CAT_ROADS',
        description: 'Dangerous cavernous pothole causing vehicle damage',
        landmarkAddress: 'Mayur Colony, Opp. Krishna Hospital',
        citizenPhone: '+919822010008',
        citizenId: citizenSession.userId,
        isHazard: true,
      });

      expect(result.status).toBe('SUBMITTED');
      expect(result.priority).toBe('P1_CRITICAL');
      expect(result.referenceNumber).toMatch(/^GOV-20\d\d-\d{5}$/);
    });
  });

  // =========================================================================
  // 2. Public Tracking & Timeline Sanitization
  // =========================================================================
  describe('2. Public Tracking & Audit Timeline', () => {
    it('returns sanitized tracking timeline with masked citizen phone', async () => {
      vi.spyOn(db.complaint, 'findFirst').mockResolvedValueOnce({
        id: '77777777-7777-7777-7777-777777770001',
        referenceNumber: 'GOV-2026-00482',
        title: 'Deep Pothole on Main Arterial Road',
        citizenPhone: '+919822010008',
        landmarkAddress: 'Mayur Colony, Opp. Krishna Hospital',
        status: 'IN_PROGRESS',
        priority: 'P1_CRITICAL',
        resolutionDueAt: new Date(),
        createdAt: new Date(),
        category: { nameEn: 'Damaged Roads & Potholes', code: 'CAT_POTHOLE' },
        department: { name: 'Road Maintenance (PWD)', code: 'ROAD_MAINTENANCE' },
        jurisdiction: { name: 'Ward 28 - Kothrud', code: 'PUN-Z02-W28' },
        timeline: [
          {
            toStatus: 'SUBMITTED',
            createdAt: new Date(),
            publicNote: 'Complaint registered.',
            actor: null,
          },
          {
            toStatus: 'IN_PROGRESS',
            createdAt: new Date(),
            publicNote: 'Repair underway.',
            actor: { fullName: 'Rajesh Patil', role: 'OFFICER' },
          },
        ],
        evidence: [],
        assignments: [],
      } as any);

      const tracked = await getTrackedComplaint('GOV-2026-00482');
      expect(tracked).not.toBeNull();
      expect(tracked?.ref).toBe('GOV-2026-00482');
      expect(tracked?.reporterMasked).toBe('+91 98*** **008');
      expect(tracked?.timeline.length).toBe(2);
      expect(tracked?.timeline[0].actingParty).toBe('Citizen Reporter');
    });

    it('returns null when tracking a non-existent reference number', async () => {
      vi.spyOn(db.complaint, 'findFirst').mockResolvedValueOnce(null);
      const tracked = await getTrackedComplaint('GOV-9999-99999');
      expect(tracked).toBeNull();
    });
  });

  // =========================================================================
  // 3. Operations Triage & State Machine Guards
  // =========================================================================
  describe('3. Operations Triage & Jurisdiction Enforcement', () => {
    it('allows authorized ward officer to triage complaint and update priority', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'SUBMITTED',
        priority: 'P2_HIGH',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: { update: vi.fn().mockResolvedValue({ id: 'c-001', status: 'TRIAGED_VALIDATED', priority: 'P1_CRITICAL' }) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const updated = await triageComplaint({
        complaintId: 'c-001',
        officerSession,
        action: 'VALIDATE',
        priority: 'P1_CRITICAL',
      });

      expect(updated.status).toBe('TRIAGED_VALIDATED');
    });

    it('rejects triage by foreign ward officer outside authorized jurisdiction', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'SUBMITTED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028', // Ward 28
        departmentId: '44444444-4444-4444-4444-444444440001',
      } as any);

      await expect(
        triageComplaint({
          complaintId: 'c-001',
          officerSession: foreignOfficerSession, // Ward 12 Officer
          action: 'VALIDATE',
        })
      ).rejects.toThrowError('You do not have jurisdiction authority over this complaint.');
    });

    it('requires mandatory rejection reason when rejecting a complaint', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'SUBMITTED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
      } as any);

      await expect(
        triageComplaint({
          complaintId: 'c-001',
          officerSession,
          action: 'REJECT',
          rejectionReason: '', // Empty reason
        })
      ).rejects.toThrowError('A comprehensive explanation is mandatory');
    });

    it('prevents illegal state transitions (cannot triage already completed work)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'WORK_COMPLETED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
      } as any);

      await expect(
        triageComplaint({
          complaintId: 'c-001',
          officerSession,
          action: 'VALIDATE',
        })
      ).rejects.toThrowError(/Cannot triage a complaint currently in "WORK_COMPLETED"/);
    });
  });

  // =========================================================================
  // 4. Operations Assignment to Field Staff
  // =========================================================================
  describe('4. Field Worker Assignment & Department Scoping', () => {
    it('dispatches work order to active field worker in matching department', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        referenceNumber: 'GOV-2026-00482',
        status: 'TRIAGED_VALIDATED',
        citizenPhone: '+919822010008',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: fieldWorkerSession.userId,
        fullName: 'Vikram Singh',
        role: 'FIELD_WORKER',
        departmentId: '44444444-4444-4444-4444-444444440001',
        isActive: true,
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaintAssignment: {
            updateMany: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({ id: 'asgn-01' }),
          },
          complaint: { update: vi.fn().mockResolvedValue({ id: 'c-001', status: 'ASSIGNED' }) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const result = await assignComplaint({
        complaintId: 'c-001',
        officerSession,
        assignedWorkerId: fieldWorkerSession.userId,
        targetCompletionAt: new Date(Date.now() + 14400000),
      });

      expect(result.complaint.status).toBe('ASSIGNED');
    });

    it('rejects assignment if target user is not a FIELD_WORKER', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'SUBMITTED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: citizenSession.userId,
        fullName: 'Aarav Mehta',
        role: 'CITIZEN', // Not a field worker!
        isActive: true,
      } as any);

      await expect(
        assignComplaint({
          complaintId: 'c-001',
          officerSession,
          assignedWorkerId: citizenSession.userId,
          targetCompletionAt: new Date(),
        })
      ).rejects.toThrowError('Assigned user must hold the FIELD_WORKER role.');
    });

    it('rejects assignment if worker belongs to an incompatible department', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'SUBMITTED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001', // Road PWD
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'usr-electrical-worker',
        fullName: 'Suresh Jadhav',
        role: 'FIELD_WORKER',
        departmentId: '44444444-4444-4444-4444-444444440002', // Electrical Dept!
        isActive: true,
      } as any);

      await expect(
        assignComplaint({
          complaintId: 'c-001',
          officerSession,
          assignedWorkerId: 'usr-electrical-worker',
          targetCompletionAt: new Date(),
        })
      ).rejects.toThrowError('Field worker must belong to the same department');
    });
  });

  // =========================================================================
  // 5. Field Worker Execution Workflow
  // =========================================================================
  describe('5. Field Worker Task Transitions', () => {
    it('field worker starts work order: moves to IN_PROGRESS', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'ASSIGNED',
        assignments: [
          { assignedWorkerId: fieldWorkerSession.userId, isActive: true },
        ],
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: { update: vi.fn().mockResolvedValue({ id: 'c-001', status: 'IN_PROGRESS' }) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const updated = await updateFieldTask({
        complaintId: 'c-001',
        workerSession: fieldWorkerSession,
        action: 'START_WORK',
      });

      expect(updated.status).toBe('IN_PROGRESS');
    });

    it('blocks field worker from modifying a task assigned to someone else', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'ASSIGNED',
        assignments: [
          { assignedWorkerId: 'another-worker-id', isActive: true },
        ],
      } as any);

      await expect(
        updateFieldTask({
          complaintId: 'c-001',
          workerSession: fieldWorkerSession,
          action: 'START_WORK',
        })
      ).rejects.toThrowError('This work order is not assigned to your worker profile.');
    });

    it('field worker completes task: moves to WORK_COMPLETED and records evidence', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'IN_PROGRESS',
        assignments: [
          { id: 'asgn-01', assignedWorkerId: fieldWorkerSession.userId, isActive: true },
        ],
      } as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        metadata: { latitude: 18.5089, longitude: 73.8077 },
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: { update: vi.fn().mockResolvedValue({ id: 'c-001', status: 'WORK_COMPLETED' }) },
          complaintEvidence: { create: vi.fn().mockResolvedValue({}) },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const updated = await updateFieldTask({
        complaintId: 'c-001',
        workerSession: fieldWorkerSession,
        action: 'COMPLETE_WORK',
        workerNotes: 'Bitumen packed and sealed with vibratory roller.',
        evidenceFileKey: 'evidence/repair_finish.webp',
      });

      expect(updated.status).toBe('WORK_COMPLETED');
    });
  });

  // =========================================================================
  // 6. Supervisor Quality Audit & Rework Loop
  // =========================================================================
  describe('6. Supervisor Verification & Rework Loop', () => {
    it('supervisor approves completed work: transitions to VERIFIED_RESOLVED', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        referenceNumber: 'GOV-2026-00482',
        title: 'Deep Pothole',
        citizenPhone: '+919822010008',
        status: 'WORK_COMPLETED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
        assignments: [{ assignedWorkerId: fieldWorkerSession.userId, isActive: true }],
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: { update: vi.fn().mockResolvedValue({ id: 'c-001', status: 'VERIFIED_RESOLVED' }) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const verified = await verifyComplaint({
        complaintId: 'c-001',
        supervisorSession,
        action: 'APPROVE',
        notes: 'Quality passed engineering audit.',
      });

      expect(verified.status).toBe('VERIFIED_RESOLVED');
    });

    it('supervisor rejects sub-standard work: reverts to IN_PROGRESS with corrective instructions', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        referenceNumber: 'GOV-2026-00482',
        status: 'WORK_COMPLETED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
        assignments: [{ assignedWorkerId: fieldWorkerSession.userId, isActive: true }],
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: { update: vi.fn().mockResolvedValue({ id: 'c-001', status: 'IN_PROGRESS' }) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const reworked = await verifyComplaint({
        complaintId: 'c-001',
        supervisorSession,
        action: 'REJECT',
        rejectionReason: 'Surface leveling is uneven. Re-roll perimeter seams with roller.',
      });

      expect(reworked.status).toBe('IN_PROGRESS');
    });

    it('rejects verification if mandatory rework instructions are missing', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-001',
        status: 'WORK_COMPLETED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
        assignments: [],
      } as any);

      await expect(
        verifyComplaint({
          complaintId: 'c-001',
          supervisorSession,
          action: 'REJECT',
          rejectionReason: '', // missing
        })
      ).rejects.toThrowError('Mandatory corrective instructions are required');
    });
  });

  // =========================================================================
  // 7. CSRF Protections on State-Changing API Endpoints
  // =========================================================================
  describe('7. CSRF Protection on Workflow API Mutations', () => {
    it('POST /api/v1/complaints blocks cross-origin submission requests', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'govasset.in',
          origin: 'https://malicious-site.com',
        },
        body: JSON.stringify({ category: 'CAT_ROADS', description: 'Test' }),
      });

      const res = await submitComplaintHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('POST /api/v1/ops/complaints/[id]/triage blocks cross-site mutations', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/ops/complaints/c-001/triage', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
        },
      });

      const res = await triageHandler(req, { params: { id: 'c-001' } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('POST /api/v1/ops/complaints/[id]/assign blocks cross-site mutations', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/ops/complaints/c-001/assign', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
        },
      });

      const res = await assignHandler(req, { params: { id: 'c-001' } });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/ops/complaints/[id]/field-status blocks cross-site mutations', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/ops/complaints/c-001/field-status', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
        },
      });

      const res = await fieldStatusHandler(req, { params: { id: 'c-001' } });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/ops/complaints/[id]/verify blocks cross-site mutations', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/ops/complaints/c-001/verify', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
        },
      });

      const res = await verifyHandler(req, { params: { id: 'c-001' } });
      expect(res.status).toBe(403);
    });
  });
});
