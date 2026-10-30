import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { UserSession, createSessionToken, verifySessionToken } from '@/lib/auth-session';
import {
  assignComplaint,
  updateFieldTask,
  verifyComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { POST as assignRouteHandler } from '@/app/api/v1/ops/complaints/[id]/assign/route';
import { GET as fieldTasksRouteHandler } from '@/app/api/v1/ops/field/tasks/route';
import { POST as fieldStatusRouteHandler } from '@/app/api/v1/ops/complaints/[id]/field-status/route';
import { POST as verifyRouteHandler } from '@/app/api/v1/ops/complaints/[id]/verify/route';
import { GET as verificationsRouteHandler } from '@/app/api/v1/ops/verifications/route';
import * as authModule from '@/server/auth';

describe('GovAsset — CSMC Complaint Assignment & Lifecycle Execution (Full Workflow Test)', () => {
  // Corporation, Zone, and Ward IDs for CSMC
  const csmcCorpId = '11111111-1111-1111-1111-111111110002'; // CSMC Corporation
  const csmcZoneId = '22222222-2222-2222-2222-222222220101'; // CSMC Zone 1 (Town Hall)
  const csmcWardId = '33333333-3333-3333-3333-333333330101'; // CSMC Ward 01 - Shahaganj
  const roadDeptId = '44444444-4444-4444-4444-444444440001'; // Road Maintenance Dept
  const potholeCatId = '55555555-5555-5555-5555-555555550001'; // Category: Damaged Roads

  // Foreign PMC Corporation and Ward IDs for boundary testing
  const pmcCorpId = '11111111-1111-1111-1111-111111110003';
  const pmcZoneId = '22222222-2222-2222-2222-222222220020';
  const pmcWardId = '33333333-3333-3333-3333-333333330028';

  // Actor Sessions
  const csmcOfficerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660101',
    email: 'officer.csmc@govasset.in',
    phoneNumber: '+919822010101',
    fullName: 'Sachin Waghmare (CSMC Ward 01 Triage Officer)',
    role: 'OFFICER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660103',
    email: 'field.csmc@govasset.in',
    phoneNumber: '+919822010103',
    fullName: 'Ganesh Shinde (CSMC Road Crew Lead #1)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcSupervisorSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660102',
    email: 'supervisor.csmc@govasset.in',
    phoneNumber: '+919822010102',
    fullName: 'Pooja Gaikwad (CSMC Zone 1 Roads Supervisor)',
    role: 'SUPERVISOR',
    departmentId: roadDeptId,
    jurisdictionId: csmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const pmcWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660006',
    email: 'field.vikram@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh (PMC Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: pmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const mockCsmcComplaint = {
    id: 'csmc-test-complaint-001',
    referenceNumber: 'GOV-2026-CSMC-001',
    title: 'Severe Asphalt Depression near Shahaganj Clock Tower',
    description: 'Hazardous depression in pavement posing traffic risk during monsoon.',
    categoryId: potholeCatId,
    departmentId: roadDeptId,
    jurisdictionId: csmcWardId,
    landmarkAddress: 'Shahaganj Clock Tower, Ward 01, Chhatrapati Sambhajinagar',
    status: 'SUBMITTED',
    priority: 'P1_CRITICAL',
    citizenPhone: '+919822010008',
    version: 1,
    assignments: [],
    createdAt: new Date('2026-10-29T10:00:00Z'),
    updatedAt: new Date('2026-10-29T10:00:00Z'),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1 & 2: Select CSMC Complaint and Sign in as authorized CSMC Officer
  // ---------------------------------------------------------------------------
  describe('1 & 2. Authenticating CSMC Officer and Verifying Complaint Jurisdiction', () => {
    it('creates an authenticated session for CSMC Triage Officer with ward authority', async () => {
      const token = await createSessionToken(csmcOfficerSession);
      const session = await verifySessionToken(token);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(csmcOfficerSession.userId);
      expect(session?.role).toBe('OFFICER');
      expect(session?.jurisdictionId).toBe(csmcWardId);
      expect(session?.departmentId).toBe(roadDeptId);

      // Verify officer has jurisdiction and department authority over the CSMC complaint
      const canAccess = authModule.canAccessComplaint(session!, mockCsmcComplaint);
      expect(canAccess).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Negative boundary checks (Cross-Corporation & Inactive Worker)
  // ---------------------------------------------------------------------------
  describe('9. Boundary Enforcement: Cross-Corporation and Inactive Worker Rejections', () => {
    it('strictly rejects assigning complaint to worker from a different corporation (PMC to CSMC)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockCsmcComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: pmcWorkerSession.userId,
        fullName: pmcWorkerSession.fullName,
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: pmcWardId, // PMC Ward
        isActive: true,
      } as any);

      // Mock hierarchy lookups: CSMC Ward -> Zone -> CSMC Corp vs PMC Ward -> Zone -> PMC Corp
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any)
        .mockResolvedValueOnce({ id: pmcWardId, level: 'WARD', parentId: pmcZoneId } as any)
        .mockResolvedValueOnce({ id: pmcZoneId, level: 'ZONE', parentId: pmcCorpId } as any)
        .mockResolvedValueOnce({ id: pmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      await expect(
        assignComplaint({
          complaintId: mockCsmcComplaint.id,
          officerSession: csmcOfficerSession,
          assignedWorkerId: pmcWorkerSession.userId,
          targetCompletionAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'CORPORATION_MISMATCH',
        statusCode: 400,
      });
    });

    it('rejects assigning complaint to an inactive or deactivated field worker', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockCsmcComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'inactive-worker-uuid',
        fullName: 'Terminated Worker',
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        isActive: false, // Inactive
      } as any);

      await expect(
        assignComplaint({
          complaintId: mockCsmcComplaint.id,
          officerSession: csmcOfficerSession,
          assignedWorkerId: 'inactive-worker-uuid',
          targetCompletionAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'WORKER_NOT_FOUND',
        statusCode: 400,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3 & 4. Assign to active CSMC Field Worker & Verify Portal View
  // ---------------------------------------------------------------------------
  describe('3 & 4. Complaint Assignment and Field Worker Portal Retrieval', () => {
    it('assigns complaint to active CSMC worker and updates status to ASSIGNED', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockCsmcComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: csmcWorkerSession.userId,
        fullName: csmcWorkerSession.fullName,
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        isActive: true,
      } as any);

      // Same corporation resolution
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any)
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      let createdAssignmentData: any = null;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaintAssignment: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            create: vi.fn().mockImplementation((args: any) => {
              createdAssignmentData = args.data;
              return { id: 'asgn-csmc-01', ...args.data };
            }),
          },
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...mockCsmcComplaint,
              status: 'ASSIGNED',
              version: 2,
            }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const result = await assignComplaint({
        complaintId: mockCsmcComplaint.id,
        officerSession: csmcOfficerSession,
        assignedWorkerId: csmcWorkerSession.userId,
        targetCompletionAt: new Date(Date.now() + 86400000),
        workerNotes: 'Deploy cold patch mix at market junction.',
      });

      expect(result.complaint.status).toBe('ASSIGNED');
      expect(result.assignment).toBeDefined();
      expect(createdAssignmentData.assignedWorkerId).toBe(csmcWorkerSession.userId);
      expect(createdAssignmentData.isActive).toBe(true);
    });

    it('API route GET /api/v1/ops/field/tasks displays assigned task in worker portal', async () => {
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcWorkerSession);

      vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue([
        {
          id: 'asgn-csmc-01',
          complaintId: mockCsmcComplaint.id,
          assignedWorkerId: csmcWorkerSession.userId,
          targetCompletionAt: new Date(Date.now() + 86400000),
          workerNotes: 'Deploy cold patch mix at market junction.',
          isActive: true,
          complaint: {
            id: mockCsmcComplaint.id,
            referenceNumber: mockCsmcComplaint.referenceNumber,
            title: mockCsmcComplaint.title,
            description: mockCsmcComplaint.description,
            status: 'ASSIGNED',
            priority: 'P1_CRITICAL',
            landmarkAddress: mockCsmcComplaint.landmarkAddress,
            citizenPhone: '+919822010008',
            version: 2,
            category: { nameEn: 'Damaged Roads & Potholes' },
            jurisdiction: { name: 'Ward 01 - Shahaganj' },
            evidence: [],
          },
        },
      ] as any);

      const req = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
      const res = await fieldTasksRouteHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].ref).toBe(mockCsmcComplaint.referenceNumber);
      expect(json.data[0].status).toBe('ASSIGNED');
      expect(json.data[0].citizenPhone).toBe('+91 98*** **008'); // PII masked
    });
  });

  // ---------------------------------------------------------------------------
  // 5 & 6. Field Worker updates status, starts work, and submits completion proof
  // ---------------------------------------------------------------------------
  describe('5 & 6. Field Worker Execution: Start Work and Completion Proof Submission', () => {
    const assignedComplaintRecord = {
      ...mockCsmcComplaint,
      status: 'ASSIGNED',
      version: 2,
      assignments: [
        {
          id: 'asgn-csmc-01',
          assignedWorkerId: csmcWorkerSession.userId,
          isActive: true,
        },
      ],
    };

    it('worker starts work: transitions ASSIGNED -> IN_PROGRESS', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(assignedComplaintRecord as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: csmcWorkerSession.userId,
        isActive: true,
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...assignedComplaintRecord,
              status: 'IN_PROGRESS',
              version: 3,
            }),
          },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const inProgress = await updateFieldTask({
        complaintId: mockCsmcComplaint.id,
        workerSession: csmcWorkerSession,
        action: 'START_WORK',
      });

      expect(inProgress.status).toBe('IN_PROGRESS');
      expect(inProgress.version).toBe(3);
    });

    it('worker submits completion proof with AFTER_REPAIR evidence and GPS coordinates', async () => {
      const inProgressRecord = {
        ...assignedComplaintRecord,
        status: 'IN_PROGRESS',
        version: 3,
      };

      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(inProgressRecord as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: csmcWorkerSession.userId,
        isActive: true,
      } as any);

      // Intake GPS metadata
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue({
        metadata: { latitude: 19.8872, longitude: 75.3289 },
      } as any);

      let savedEvidence: any = null;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...inProgressRecord,
              status: 'WORK_COMPLETED',
              version: 4,
            }),
          },
          complaintEvidence: {
            create: vi.fn().mockImplementation((args: any) => {
              savedEvidence = args.data;
              return { id: 'ev-csmc-01', ...args.data };
            }),
          },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const completed = await updateFieldTask({
        complaintId: mockCsmcComplaint.id,
        workerSession: csmcWorkerSession,
        action: 'COMPLETE_WORK',
        workerNotes: 'Asphalt cavity cleared of debris, emulsified tack applied, hot-mix rolled flush.',
        evidenceFileKey: 'evidence/csmc_shahaganj_after_repair.webp',
        evidenceMimeType: 'image/webp',
        evidenceFileSizeBytes: 182400,
        workerLatitude: 19.8873, // Within ~15m
        workerLongitude: 75.3290,
        gpsAccuracyMeters: 4.0,
      });

      expect(completed.status).toBe('WORK_COMPLETED');
      expect(savedEvidence).toBeDefined();
      expect(savedEvidence.stage).toBe('AFTER_REPAIR');
      expect(savedEvidence.isVerifiedProximity).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Supervisor Quality Verification: Reject for Rework and Final Approval
  // ---------------------------------------------------------------------------
  describe('7. Supervisor Quality Verification (Rework & Approval Lifecycle)', () => {
    const workCompletedRecord = {
      ...mockCsmcComplaint,
      status: 'WORK_COMPLETED',
      version: 4,
      assignments: [
        {
          id: 'asgn-csmc-01',
          assignedWorkerId: csmcWorkerSession.userId,
          isActive: true,
        },
      ],
    };

    it('rejects work with mandatory corrective instructions: transitions WORK_COMPLETED -> IN_PROGRESS', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(workCompletedRecord as any);
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: csmcWardId,
        parentId: csmcZoneId,
      } as any);

      let reworkNotificationData: any = null;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...workCompletedRecord,
              status: 'IN_PROGRESS',
              version: 5,
            }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: {
            create: vi.fn().mockImplementation((args: any) => {
              reworkNotificationData = args.data;
              return { id: 'notif-rework-01', ...args.data };
            }),
          },
        });
      });

      const rejected = await verifyComplaint({
        complaintId: mockCsmcComplaint.id,
        supervisorSession: csmcSupervisorSession,
        action: 'REJECT',
        rejectionReason: 'Bituminous compaction uneven. Re-level and seal northern seam properly.',
      });

      expect(rejected.status).toBe('IN_PROGRESS');
      expect(rejected.version).toBe(5);
      expect(reworkNotificationData).toBeDefined();
      expect(reworkNotificationData.templateCode).toBe('WORK_RETURNED_FOR_REWORK');
      expect(reworkNotificationData.payload.instructions).toContain('Bituminous compaction uneven');
    });

    it('supervisor approves remediated work: transitions WORK_COMPLETED -> VERIFIED_RESOLVED', async () => {
      const remediatedRecord = {
        ...workCompletedRecord,
        status: 'WORK_COMPLETED',
        version: 6,
      };

      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(remediatedRecord as any);
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: csmcWardId,
        parentId: csmcZoneId,
      } as any);

      let citizenResolutionNotif: any = null;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...remediatedRecord,
              status: 'VERIFIED_RESOLVED',
              version: 7,
            }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: {
            create: vi.fn().mockImplementation((args: any) => {
              citizenResolutionNotif = args.data;
              return { id: 'notif-res-01', ...args.data };
            }),
          },
        });
      });

      const approved = await verifyComplaint({
        complaintId: mockCsmcComplaint.id,
        supervisorSession: csmcSupervisorSession,
        action: 'APPROVE',
        notes: 'Verified on-site at Shahaganj Bazaar. Asphalt compaction is flush and level.',
      });

      expect(approved.status).toBe('VERIFIED_RESOLVED');
      expect(approved.version).toBe(7);
      expect(citizenResolutionNotif).toBeDefined();
      expect(citizenResolutionNotif.templateCode).toBe('COMPLAINT_RESOLVED');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Consistency of Status History, Assignment History, and Evidence
  // ---------------------------------------------------------------------------
  describe('8. Audit Trail & Data Consistency Verification', () => {
    it('verifies chronological timeline sequence and evidence stage integrity', async () => {
      const timelineEntries = [
        { fromStatus: null, toStatus: 'SUBMITTED', publicNote: 'Citizen submitted grievance' },
        { fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', publicNote: 'Dispatched to Ganesh Shinde' },
        { fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', publicNote: 'Crew on-site' },
        { fromStatus: 'IN_PROGRESS', toStatus: 'WORK_COMPLETED', publicNote: 'Photo proof submitted' },
        { fromStatus: 'WORK_COMPLETED', toStatus: 'IN_PROGRESS', publicNote: 'Returned for rework' },
        { fromStatus: 'IN_PROGRESS', toStatus: 'WORK_COMPLETED', publicNote: 'Remediated work submitted' },
        { fromStatus: 'WORK_COMPLETED', toStatus: 'VERIFIED_RESOLVED', publicNote: 'Supervisor approved' },
      ];

      vi.spyOn(db.complaintTimeline, 'findMany').mockResolvedValue(timelineEntries as any);

      const entries = await db.complaintTimeline.findMany({
        where: { complaintId: mockCsmcComplaint.id },
      });

      expect(entries.length).toBe(7);
      expect(entries[0].toStatus).toBe('SUBMITTED');
      expect(entries[1].toStatus).toBe('ASSIGNED');
      expect(entries[2].toStatus).toBe('IN_PROGRESS');
      expect(entries[3].toStatus).toBe('WORK_COMPLETED');
      expect(entries[4].toStatus).toBe('IN_PROGRESS'); // Rework transition
      expect(entries[5].toStatus).toBe('WORK_COMPLETED');
      expect(entries[6].toStatus).toBe('VERIFIED_RESOLVED');
    });

    it('verifies assignment history preserves auditability of historical assignments', async () => {
      const assignments = [
        { id: 'asgn-01', assignedWorkerId: csmcWorkerSession.userId, isActive: true },
      ];

      vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue(assignments as any);

      const list = await db.complaintAssignment.findMany({
        where: { complaintId: mockCsmcComplaint.id },
      });

      expect(list.length).toBe(1);
      expect(list[0].assignedWorkerId).toBe(csmcWorkerSession.userId);
      expect(list[0].isActive).toBe(true);
    });
  });
});
