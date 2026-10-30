import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import {
  canAccessComplaint,
  canAccessJurisdiction,
  verifyCsrfProtection,
  AuthError,
} from '@/server/auth';
import {
  createComplaint,
  getTrackedComplaint,
  triageComplaint,
  assignComplaint,
  updateFieldTask,
  verifyComplaint,
  disputeComplaint,
  recordCitizenFeedback,
  getCitizenFeedback,
  WorkflowError,
  DISPUTE_WINDOW_MS,
} from '@/server/complaint-service';
import { FsmError } from '@/server/fsm';
import { autoCloseResolvedComplaints } from '@/server/auto-close';
import {
  deleteJurisdiction,
  inspectWardBoundary,
  AdminServiceError,
} from '@/server/admin-service';
import { enqueueJob, getQueueMetrics, clearQueueStore } from '@/server/queue';
import {
  SYNTHETIC_BOUNDARY_DISCLAIMER,
  STORAGE_BACKEND_NOTICE,
  NOTIFICATION_MOCK_NOTICE,
} from '@/lib/constants';

describe('Phase 10: Security Hardening & End-to-End Workflow Verification', () => {
  // Test Actor Sessions
  const citizenA: UserSession = {
    userId: 'user-citizen-001',
    email: 'citizen.aarav@govasset.in',
    phoneNumber: '+919822010008',
    fullName: 'Aarav Mehta',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const citizenB: UserSession = {
    userId: 'user-citizen-002',
    email: 'citizen.sunita@govasset.in',
    phoneNumber: '+919822010009',
    fullName: 'Sunita Rao',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: 'ward-shivaji-12',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const ward28Officer: UserSession = {
    userId: 'user-officer-ward28',
    email: 'officer.kothrud@govasset.in',
    phoneNumber: '+919822010002',
    fullName: 'Rajesh Patil (Ward 28)',
    role: 'OFFICER',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const ward12Officer: UserSession = {
    userId: 'user-officer-ward12',
    email: 'officer.shivaji@govasset.in',
    phoneNumber: '+919822010003',
    fullName: 'Amit Deshmukh (Ward 12)',
    role: 'OFFICER',
    departmentId: 'dept-electrical',
    jurisdictionId: 'ward-shivaji-12',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const assignedWorker: UserSession = {
    userId: 'worker-vikram-01',
    email: 'worker.vikram@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh (Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const unassignedWorker: UserSession = {
    userId: 'worker-suresh-02',
    email: 'worker.suresh@govasset.in',
    phoneNumber: '+919822010007',
    fullName: 'Suresh Jadhav',
    role: 'FIELD_WORKER',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const supervisorSession: UserSession = {
    userId: 'supervisor-kavita-01',
    email: 'supervisor.kavita@govasset.in',
    phoneNumber: '+919822010004',
    fullName: 'Kavita Joshi (Supervisor)',
    role: 'SUPERVISOR',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const adminSession: UserSession = {
    userId: 'admin-rajesh-01',
    email: 'admin@govasset.in',
    phoneNumber: '+919822010001',
    fullName: 'Rajesh Sharma (Admin)',
    role: 'PLATFORM_ADMIN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    clearQueueStore();
  });

  // =========================================================================
  // Workflow 1: Citizen Complaint Submission & Reference Generation
  // =========================================================================
  describe('Workflow 1: Citizen Complaint Submission & Input Sanitization', () => {
    it('creates complaint and assigns valid reference ID format (GOV-YYYY-NNNNN)', async () => {
      vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue({
        id: 'cat-roads-01',
        code: 'CAT_POTHOLE',
        nameEn: 'Roads & Potholes',
        departmentId: 'dept-roads',
        defaultPriority: 'P2_HIGH',
        slaPolicies: [
          { priority: 'P2_HIGH', responseSlaHours: 12, resolutionSlaHours: 48, escalationHours: 36 },
        ],
      } as any);

      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValue([
        { id: 'ward-kothrud-28' },
      ]);
      vi.spyOn(db.complaint, 'count').mockResolvedValue(105);
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(null);

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
        cb({
          $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
          user: { findFirst: vi.fn().mockResolvedValue({ id: citizenA.userId }) },
        })
      );

      const result = await createComplaint({
        category: 'CAT_ROADS',
        description: 'Road surface collapsed creating 40cm cavity on arterial lane.',
        landmarkAddress: 'Near Kothrud Depot',
        citizenPhone: '+919822010008',
        citizenId: citizenA.userId,
      });

      expect(result.status).toBe('SUBMITTED');
      expect(result.referenceNumber).toMatch(/^GOV-20\d\d-\d{5}$/);
    });

    it('rejects empty or insufficiently descriptive defect descriptions', async () => {
      await expect(
        createComplaint({
          category: 'CAT_ROADS',
          description: '', // Empty
          landmarkAddress: 'Near Kothrud Depot',
          citizenPhone: '+919822010008',
        })
      ).rejects.toThrowError(WorkflowError);
    });

    it('rejects invalid or unparseable citizen contact phone numbers', async () => {
      await expect(
        createComplaint({
          category: 'CAT_ROADS',
          description: 'Pothole defect observed on 12th main road.',
          landmarkAddress: 'Indiranagar 100ft road',
          citizenPhone: '123', // Invalid length
        })
      ).rejects.toThrowError(WorkflowError);
    });
  });

  // =========================================================================
  // Workflow 2: Citizen Tracking & IDOR Protection
  // =========================================================================
  describe('Workflow 2: Citizen Tracking & Anti-IDOR Protections', () => {
    const complaintRecordA = {
      id: 'comp-idor-001',
      referenceNumber: 'GOV-2026-00088',
      citizenId: citizenA.userId,
      citizenPhone: citizenA.phoneNumber,
      jurisdictionId: 'ward-kothrud-28',
      departmentId: 'dept-roads',
      assignedWorkerId: assignedWorker.userId,
    };

    it('permits Citizen A to access their own complaint record', () => {
      expect(canAccessComplaint(citizenA, complaintRecordA)).toBe(true);
    });

    it('strictly denies Citizen B from accessing Citizen A complaint (Anti-IDOR)', () => {
      expect(canAccessComplaint(citizenB, complaintRecordA)).toBe(false);
    });

    it('masks citizen phone number in public complaint tracking responses', async () => {
      vi.spyOn(db.complaint, 'findFirst').mockResolvedValue({
        id: 'comp-idor-001',
        referenceNumber: 'GOV-2026-00088',
        title: 'Damaged footpath slab',
        citizenPhone: '+919822010008',
        landmarkAddress: 'Near Mayur Colony',
        status: 'SUBMITTED',
        priority: 'P3_MEDIUM',
        resolutionDueAt: new Date(),
        createdAt: new Date(),
        category: { nameEn: 'Footpaths', code: 'CAT_FOOTPATH' },
        department: { name: 'Roads & Infrastructure', code: 'ROAD_MAINTENANCE' },
        jurisdiction: { name: 'Ward 28 - Kothrud', code: 'PUN-Z02-W28' },
        timeline: [
          {
            toStatus: 'SUBMITTED',
            createdAt: new Date(),
            publicNote: 'Complaint registered.',
            actor: null,
          },
        ],
        evidence: [],
        assignments: [],
      } as any);

      const trackingResult = await getTrackedComplaint('GOV-2026-00088');
      expect(trackingResult).not.toBeNull();
      expect(trackingResult?.ref).toBe('GOV-2026-00088');
      expect(trackingResult?.reporterMasked).toBe('+91 98*** **008');
      expect(trackingResult?.reporterMasked).not.toBe('+919822010008');
    });
  });

  // =========================================================================
  // Workflow 3: Operations Triage & Jurisdiction Isolation
  // =========================================================================
  describe('Workflow 3: Ops Triage & Jurisdiction/Department Isolation', () => {
    const ward28RoadComplaint = {
      id: 'comp-triage-001',
      referenceNumber: 'GOV-2026-00101',
      jurisdictionId: 'ward-kothrud-28',
      departmentId: 'dept-roads',
      status: 'SUBMITTED',
      version: 1,
    };

    it('allows Ward 28 Officer to triage complaint in their ward and department', () => {
      expect(canAccessComplaint(ward28Officer, ward28RoadComplaint)).toBe(true);
    });

    it('forbids Ward 12 Officer from accessing or modifying Ward 28 complaint', () => {
      expect(canAccessComplaint(ward12Officer, ward28RoadComplaint)).toBe(false);
    });

    it('enforces optimistic concurrency control (OCC) during triage', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
        ...ward28RoadComplaint,
        version: 2, // Concurrent actor already bumped version to 2
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
        cb({
          complaint: {
            findUnique: vi.fn().mockResolvedValue({ id: 'comp-triage-001', status: 'SUBMITTED', version: 2 }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 0 updated due to OCC version mismatch
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        })
      );

      await expect(
        triageComplaint({
          complaintId: 'comp-triage-001',
          officerSession: ward28Officer,
          action: 'VALIDATE',
          priority: 'P2_HIGH',
          expectedVersion: 1, // Stale version mismatch
        })
      ).rejects.toThrowError(FsmError);
    });
  });

  // =========================================================================
  // Workflow 4: Field Worker Task Execution Security
  // =========================================================================
  describe('Workflow 4: Field Worker Task Execution Security', () => {
    const assignedTask = {
      id: 'task-field-001',
      jurisdictionId: 'ward-kothrud-28',
      departmentId: 'dept-roads',
      assignedWorkerId: assignedWorker.userId,
      status: 'ASSIGNED',
      version: 1,
    };

    it('permits the assigned field worker to access and update their task', () => {
      expect(canAccessComplaint(assignedWorker, assignedTask)).toBe(true);
    });

    it('strictly forbids unassigned field worker from modifying other worker task', () => {
      expect(canAccessComplaint(unassignedWorker, assignedTask)).toBe(false);
    });

    it('strictly forbids a regular citizen from updating field status', () => {
      expect(canAccessComplaint(citizenA, assignedTask)).toBe(false);
    });
  });

  // =========================================================================
  // Workflow 5: Completion Evidence & Supervisor Verification
  // =========================================================================
  describe('Workflow 5: Completion Evidence & Supervisor Verification', () => {
    const workOrderPendingVerification = {
      id: 'wo-verify-001',
      jurisdictionId: 'ward-kothrud-28',
      departmentId: 'dept-roads',
      status: 'WORK_COMPLETED',
      version: 2,
    };

    it('permits authorized supervisor in the zone to verify work order', () => {
      expect(canAccessComplaint(supervisorSession, workOrderPendingVerification)).toBe(true);
    });

    it('supervisor reject action requires rejection reason or technical instructions', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
        ...workOrderPendingVerification,
        assignments: [{ assignedWorkerId: assignedWorker.userId, isActive: true }],
      } as any);

      await expect(
        verifyComplaint({
          complaintId: 'wo-verify-001',
          supervisorSession,
          action: 'REJECT',
          rejectionReason: '', // Empty reason
          expectedVersion: 2,
        })
      ).rejects.toThrowError(WorkflowError);
    });
  });

  // =========================================================================
  // Workflow 6: Citizen Dispute & Feedback Window Closure
  // =========================================================================
  describe('Workflow 6: Citizen Dispute & Feedback Resolution Window', () => {
    it('dispute requires verified complaint and enforces minimum 15 character justification', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
        id: 'comp-dispute-001',
        referenceNumber: 'GOV-2026-00044',
        citizenId: citizenA.userId,
        status: 'VERIFIED_RESOLVED',
        version: 3,
        updatedAt: new Date(),
      } as any);

      await expect(
        disputeComplaint({
          complaintId: 'comp-dispute-001',
          citizenSession: citizenA,
          disputeReason: 'Bad repair.', // < 15 chars
        })
      ).rejects.toThrow();
    });

    it('validates feedback rating must be an integer between 1 and 5', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
        id: 'comp-001',
        referenceNumber: 'GOV-2026-00010',
        citizenId: citizenA.userId,
        status: 'VERIFIED_RESOLVED',
        version: 2,
      } as any);

      await expect(
        recordCitizenFeedback({
          complaintId: 'comp-001',
          citizenSession: citizenA,
          rating: 6, // Invalid > 5
          feedbackText: 'Great work',
        })
      ).rejects.toThrow();

      await expect(
        recordCitizenFeedback({
          complaintId: 'comp-001',
          citizenSession: citizenA,
          rating: 0, // Invalid < 1
          feedbackText: 'Poor work',
        })
      ).rejects.toThrow();
    });

    it('prevents Citizen B from disputing a ticket owned by Citizen A (Anti-IDOR)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
        id: 'comp-dispute-001',
        referenceNumber: 'GOV-2026-00044',
        citizenId: citizenA.userId, // Owned by Citizen A
        status: 'VERIFIED_RESOLVED',
        version: 3,
        updatedAt: new Date(),
      } as any);

      await expect(
        disputeComplaint({
          complaintId: 'comp-dispute-001',
          citizenSession: citizenB, // Attempted by Citizen B
          disputeReason: 'Pothole patch broke immediately upon heavy rains.',
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Workflow 7: Admin Jurisdiction & Privilege Escalation Prevention
  // =========================================================================
  describe('Workflow 7: Platform Admin & Safe Delete Protection', () => {
    it('prevents deleting a jurisdiction when active complaints are referenced', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-kothrud-28',
        name: 'Ward 28 - Kothrud',
        children: [],
        _count: { complaints: 5, users: 0 },
      } as any);

      await expect(
        deleteJurisdiction(adminSession, 'ward-kothrud-28')
      ).rejects.toThrowError(AdminServiceError);
    });

    it('boundary inspection carries mandatory SYNTHETIC_BOUNDARY_DISCLAIMER', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-kothrud-28',
        name: 'Ward 28 - Kothrud',
        code: 'W28',
        level: 'WARD',
        boundaryGeoJson: '{"type":"Polygon"}',
      } as any);

      const inspection = await inspectWardBoundary('ward-kothrud-28');
      expect(inspection.spatialStatus.disclaimer).toBe(SYNTHETIC_BOUNDARY_DISCLAIMER);
    });
  });

  // =========================================================================
  // Workflow 8: Scheduled Background Jobs & SLA Auto-Close
  // =========================================================================
  describe('Workflow 8: Background Job Reliability & SLA Auto-Close', () => {
    it('auto-closes verified complaints past the 7-day grace window', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const staleVerifiedComplaint = {
        id: 'comp-stale-001',
        referenceNumber: 'GOV-2026-00005',
        status: 'VERIFIED_RESOLVED',
        version: 3,
        updatedAt: eightDaysAgo,
      };

      vi.spyOn(db.complaint, 'findMany').mockResolvedValue([staleVerifiedComplaint] as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue({
        createdAt: eightDaysAgo,
      } as any);

      const mockTx = {
        complaint: {
          findUnique: vi.fn().mockResolvedValue({ status: 'VERIFIED_RESOLVED', version: 3 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({ ...staleVerifiedComplaint, status: 'CLOSED' }),
        },
        complaintTimeline: {
          create: vi.fn().mockResolvedValue({}),
        },
        notification: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      const result = await autoCloseResolvedComplaints();
      expect(result.processed).toBe(1);
      expect(result.closed).toBe(1);
      expect(mockTx.complaint.updateMany).toHaveBeenCalled();
    });

    it('background job queue tracks enqueued jobs and manages metrics', async () => {
      const { job } = await enqueueJob('SEND_NOTIFICATION', {
        recipient: '+919822010008',
        text: 'Work order verified',
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('PENDING');
      expect(job.attempts).toBe(0);

      const metrics = getQueueMetrics();
      expect(metrics.pendingCount).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Security Hardening: CSRF, Secret Protection & Mock Disclaimers
  // =========================================================================
  describe('Security Boundaries & Infrastructure Protections', () => {
    it('validates CSRF protection headers on state-changing requests', () => {
      const validSameOriginReq = new Request('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });
      expect(verifyCsrfProtection(validSameOriginReq)).toBe(true);

      const crossOriginReq = new Request('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://malicious-site.com',
        },
      });
      expect(verifyCsrfProtection(crossOriginReq)).toBe(false);
    });

    it('system constants include explicit disclaimers for synthetic boundaries and local storage', () => {
      expect(SYNTHETIC_BOUNDARY_DISCLAIMER).toBeDefined();
      expect(SYNTHETIC_BOUNDARY_DISCLAIMER).toContain('synthetic pilot approximations');
      expect(STORAGE_BACKEND_NOTICE).toBeDefined();
      expect(STORAGE_BACKEND_NOTICE).toContain('.storage_mock/');
      expect(NOTIFICATION_MOCK_NOTICE).toBeDefined();
      expect(NOTIFICATION_MOCK_NOTICE).toContain('Mock/Development sandbox mode');
    });
  });
});
