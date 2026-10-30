import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateFieldTask,
  verifyComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import * as authModule from '@/server/auth';
import { evaluateGpsProximity, calculateHaversineDistanceMeters, GPS_PROXIMITY_THRESHOLD_METERS } from '@/lib/geo';
import { POST as fieldStatusHandler } from '@/app/api/v1/ops/complaints/[id]/field-status/route';
import { POST as verifyHandler } from '@/app/api/v1/ops/complaints/[id]/verify/route';
import { NextRequest } from 'next/server';

describe('Phase 6: Field Worker Execution & Supervisor Verification', () => {
  const assignedWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660006',
    email: 'field.vikram@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh (Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: '44444444-4444-4444-4444-444444440001', // Road Maintenance
    jurisdictionId: '33333333-3333-3333-3333-333333330028', // Ward 28 - Kothrud
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const otherWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660007',
    email: 'field.ramesh@govasset.in',
    phoneNumber: '+919822010007',
    fullName: 'Ramesh Pawar (Field Crew)',
    role: 'FIELD_WORKER',
    departmentId: '44444444-4444-4444-4444-444444440001',
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
    departmentId: '44444444-4444-4444-4444-444444440001',
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const supervisorSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660004',
    email: 'supervisor.roads@govasset.in',
    phoneNumber: '+919822010004',
    fullName: 'Kavita Joshi (Ward 28 Supervisor)',
    role: 'SUPERVISOR',
    departmentId: '44444444-4444-4444-4444-444444440001',
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const foreignSupervisorSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660005',
    email: 'supervisor.shivaji@govasset.in',
    phoneNumber: '+919822010005',
    fullName: 'Suresh More (Ward 12 Supervisor)',
    role: 'SUPERVISOR',
    departmentId: '44444444-4444-4444-4444-444444440001',
    jurisdictionId: '33333333-3333-3333-3333-333333330012', // Different Ward
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const adminSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660001',
    email: 'admin@govasset.in',
    phoneNumber: '+919822010001',
    fullName: 'Chief Municipal Admin',
    role: 'PLATFORM_ADMIN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const mockComplaint = {
    id: 'c-field-101',
    referenceNumber: 'GOV-2026-00482',
    title: 'Deep Pothole Patching & Surface Leveling',
    status: 'ASSIGNED',
    priority: 'P1_CRITICAL',
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    departmentId: '44444444-4444-4444-4444-444444440001',
    citizenPhone: '+919822010008',
    version: 1,
    assignments: [
      {
        id: 'asgn-101',
        complaintId: 'c-field-101',
        assignedWorkerId: assignedWorkerSession.userId,
        isActive: true,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. GPS Proximity Math & Classification Utility Tests
  // =========================================================================
  describe('1. GPS Proximity Math & Edge Cases', () => {
    it('calculates Haversine distance correctly for near and distant points', () => {
      // Pune Mayur Colony test points (~55m apart)
      const distNear = calculateHaversineDistanceMeters(18.5089, 73.8112, 18.5093, 73.8115);
      expect(distNear).toBeGreaterThan(40);
      expect(distNear).toBeLessThan(70);

      // Distant points (~1.2 km)
      const distFar = calculateHaversineDistanceMeters(18.5089, 73.8112, 18.5189, 73.8150);
      expect(distFar).toBeGreaterThan(1000);
    });

    it('returns VERIFIED when worker is within 200m threshold', () => {
      const result = evaluateGpsProximity(
        { latitude: 18.5090, longitude: 73.8113 },
        { latitude: 18.5089, longitude: 73.8112 }
      );
      expect(result.status).toBe('VERIFIED');
      expect(result.isWithinThreshold).toBe(true);
      expect(result.distanceMeters).toBeLessThan(GPS_PROXIMITY_THRESHOLD_METERS);
    });

    it('returns WARNING_EXCEEDS_THRESHOLD when distance exceeds 200m', () => {
      const result = evaluateGpsProximity(
        { latitude: 18.5125, longitude: 73.8150 }, // ~550m away
        { latitude: 18.5089, longitude: 73.8112 }
      );
      expect(result.status).toBe('WARNING_EXCEEDS_THRESHOLD');
      expect(result.isWithinThreshold).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(GPS_PROXIMITY_THRESHOLD_METERS);
      expect(result.message).toContain('GPS Proximity Advisory');
      expect(result.message).toContain(`> ${GPS_PROXIMITY_THRESHOLD_METERS}m`);
    });

    it('returns LOCATION_UNAVAILABLE when coordinates are null or missing', () => {
      const result = evaluateGpsProximity(
        { latitude: null, longitude: null },
        { latitude: 18.5089, longitude: 73.8112 }
      );
      expect(result.status).toBe('LOCATION_UNAVAILABLE');
      expect(result.isWithinThreshold).toBe(false);
      expect(result.distanceMeters).toBeNull();
      expect(result.message).toContain('unavailable');
    });

    it('returns COARSE_ACCURACY when GPS sensor accuracy is poorer than 150m', () => {
      const result = evaluateGpsProximity(
        { latitude: 18.5090, longitude: 73.8113, accuracy: 160 },
        { latitude: 18.5089, longitude: 73.8112 }
      );
      expect(result.status).toBe('COARSE_ACCURACY');
      expect(result.isWithinThreshold).toBe(true);
      expect(result.message).toContain('Coarse');
    });
  });

  // =========================================================================
  // 2. Field Worker Task Progress (START_WORK)
  // =========================================================================
  describe('2. Field Worker Task Progress (START_WORK)', () => {
    it('assigned worker starts work: transitions ASSIGNED -> IN_PROGRESS', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockComplaint as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'IN_PROGRESS', version: 2 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const result = await updateFieldTask({
        complaintId: mockComplaint.id,
        workerSession: assignedWorkerSession,
        action: 'START_WORK',
        workerNotes: 'On-site check-in. Deployed safety cones and began cavity chipping.',
        expectedVersion: 1,
      });

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('rejects starting work if task is not in ASSIGNED status', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'SUBMITTED', // not yet assigned
      } as any);

      await expect(
        updateFieldTask({
          complaintId: mockComplaint.id,
          workerSession: assignedWorkerSession,
          action: 'START_WORK',
        })
      ).rejects.toThrowError('Cannot start work on a complaint in "SUBMITTED" status.');
    });

    it('rejects update if worker is not assigned to this work order', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockComplaint as any);

      await expect(
        updateFieldTask({
          complaintId: mockComplaint.id,
          workerSession: otherWorkerSession, // Different worker
          action: 'START_WORK',
        })
      ).rejects.toThrowError('Access denied. This work order is not assigned to your worker profile.');
    });

    it('rejects non-field workers (e.g. Officer or Citizen) from executing field updates', async () => {
      await expect(
        updateFieldTask({
          complaintId: mockComplaint.id,
          workerSession: officerSession as any,
          action: 'START_WORK',
        })
      ).rejects.toThrowError('Only field workers can execute task progress updates.');
    });

    it('allows Platform Admin to update work order regardless of assigned worker', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockComplaint as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'IN_PROGRESS', version: 2 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const result = await updateFieldTask({
        complaintId: mockComplaint.id,
        workerSession: adminSession,
        action: 'START_WORK',
      });

      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  // =========================================================================
  // 3. Completion Proof & GPS Proximity Validation
  // =========================================================================
  describe('3. Completion Proof & GPS Proximity Validation', () => {
    it('completes work with verified proximity (<= 200m) and records AFTER_REPAIR evidence', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'IN_PROGRESS',
      } as any);

      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        metadata: { latitude: 18.5089, longitude: 73.8112 },
      } as any);

      let createdEvidence: any = null;
      let timelineMeta: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'WORK_COMPLETED', version: 3 }),
          },
          complaintEvidence: {
            create: vi.fn().mockImplementation((args: any) => {
              createdEvidence = args.data;
              return { id: 'ev-after-01', ...args.data };
            }),
          },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: {
            create: vi.fn().mockImplementation((args: any) => {
              timelineMeta = args.data.metadata;
              return {};
            }),
          },
        });
      });

      const updated = await updateFieldTask({
        complaintId: mockComplaint.id,
        workerSession: assignedWorkerSession,
        action: 'COMPLETE_WORK',
        workerNotes: 'Excavated 1.5m pothole, compacted cold mix bituminous asphalt flush with grade.',
        evidenceFileKey: 'evidence/after_repair_pothole.webp',
        evidenceMimeType: 'image/webp',
        evidenceFileSizeBytes: 420000,
        workerLatitude: 18.5090, // ~15m from defect
        workerLongitude: 73.8113,
        gpsAccuracyMeters: 4.2,
      });

      expect(updated.status).toBe('WORK_COMPLETED');
      expect(createdEvidence).not.toBeNull();
      expect(createdEvidence.stage).toBe('AFTER_REPAIR');
      expect(createdEvidence.isVerifiedProximity).toBe(true);
      expect(timelineMeta.proximityStatus).toBe('VERIFIED');
      expect(timelineMeta.proximityMeters).toBeLessThan(200);
    });

    it('completes work with proximity warning (> 200m): non-blocking advisory', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'IN_PROGRESS',
      } as any);

      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        metadata: { latitude: 18.5089, longitude: 73.8112 },
      } as any);

      let createdEvidence: any = null;
      let timelineMeta: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'WORK_COMPLETED', version: 3 }),
          },
          complaintEvidence: {
            create: vi.fn().mockImplementation((args: any) => {
              createdEvidence = args.data;
              return { id: 'ev-after-02', ...args.data };
            }),
          },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: {
            create: vi.fn().mockImplementation((args: any) => {
              timelineMeta = args.data.metadata;
              return {};
            }),
          },
        });
      });

      // Worker is 450m away (e.g. at asphalt depot or long continuous work zone)
      const updated = await updateFieldTask({
        complaintId: mockComplaint.id,
        workerSession: assignedWorkerSession,
        action: 'COMPLETE_WORK',
        workerNotes: 'Pipeline segment replaced at sector junction.',
        evidenceFileKey: 'evidence/pipeline_after.webp',
        workerLatitude: 18.5125,
        workerLongitude: 73.8135,
        gpsAccuracyMeters: 5.0,
      });

      // Crucial: Task completion must NOT be blocked!
      expect(updated.status).toBe('WORK_COMPLETED');
      expect(createdEvidence.isVerifiedProximity).toBe(false);
      expect(timelineMeta.proximityStatus).toBe('WARNING_EXCEEDS_THRESHOLD');
      expect(timelineMeta.proximityMeters).toBeGreaterThan(200);
    });

    it('completes work when GPS coordinates are unavailable/denied: non-blocking', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'IN_PROGRESS',
      } as any);

      let timelineMeta: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'WORK_COMPLETED', version: 3 }),
          },
          complaintEvidence: { create: vi.fn().mockResolvedValue({}) },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: {
            create: vi.fn().mockImplementation((args: any) => {
              timelineMeta = args.data.metadata;
              return {};
            }),
          },
        });
      });

      // No GPS provided
      const updated = await updateFieldTask({
        complaintId: mockComplaint.id,
        workerSession: assignedWorkerSession,
        action: 'COMPLETE_WORK',
        workerNotes: 'Repairs finished under basement where GPS satellite signal was unresolvable.',
        evidenceFileKey: 'evidence/basement_drain.webp',
      });

      expect(updated.status).toBe('WORK_COMPLETED');
      expect(timelineMeta.proximityStatus).toBe('LOCATION_UNAVAILABLE');
    });
  });

  // =========================================================================
  // 4. Supervisor Quality Audit & Verification Workflow
  // =========================================================================
  describe('4. Supervisor Quality Audit & Verification Workflow', () => {
    it('supervisor approves completed work: transitions to VERIFIED_RESOLVED and notifies citizen', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'WORK_COMPLETED',
      } as any);

      let citizenNotification: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'VERIFIED_RESOLVED', version: 4 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: {
            create: vi.fn().mockImplementation((args: any) => {
              citizenNotification = args.data;
              return {};
            }),
          },
        });
      });

      const result = await verifyComplaint({
        complaintId: mockComplaint.id,
        supervisorSession,
        action: 'APPROVE',
        notes: 'Physical on-site audit conducted. Surface compaction and edge sealing meet IRC standards.',
        expectedVersion: 1,
      });

      expect(result.status).toBe('VERIFIED_RESOLVED');
      expect(citizenNotification).not.toBeNull();
      expect(citizenNotification.templateCode).toBe('COMPLAINT_RESOLVED');
      expect(citizenNotification.recipientPhone).toBe('+919822010008');
    });

    it('supervisor rejects work and orders rework: reverts to IN_PROGRESS and notifies assigned worker', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'WORK_COMPLETED',
      } as any);

      let workerNotification: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'IN_PROGRESS', version: 4 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: {
            create: vi.fn().mockImplementation((args: any) => {
              workerNotification = args.data;
              return {};
            }),
          },
        });
      });

      const reworkDirective = 'Surface leveling uneven. Re-roll perimeter seams with 5-ton vibratory roller.';
      const result = await verifyComplaint({
        complaintId: mockComplaint.id,
        supervisorSession,
        action: 'REJECT',
        rejectionReason: reworkDirective,
        notes: 'Inspection failed: camber slope incorrect.',
        expectedVersion: 1,
      });

      expect(result.status).toBe('IN_PROGRESS');
      expect(workerNotification).not.toBeNull();
      expect(workerNotification.templateCode).toBe('WORK_RETURNED_FOR_REWORK');
      expect(workerNotification.payload.rejectionReason).toBe(reworkDirective);
    });

    it('rejects rework without mandatory instructions or with fewer than 20 characters', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'WORK_COMPLETED',
      } as any);

      // Too short (< 20 chars)
      await expect(
        verifyComplaint({
          complaintId: mockComplaint.id,
          supervisorSession,
          action: 'REJECT',
          rejectionReason: 'Redo it.',
        })
      ).rejects.toThrowError('Mandatory corrective instructions are required (minimum 20 characters)');
    });

    it('enforces supervisory role authority: field workers and officers cannot verify work', async () => {
      await expect(
        verifyComplaint({
          complaintId: mockComplaint.id,
          supervisorSession: assignedWorkerSession as any,
          action: 'APPROVE',
        })
      ).rejects.toThrowError('Supervisor or Administrative privileges required.');

      await expect(
        verifyComplaint({
          complaintId: mockComplaint.id,
          supervisorSession: officerSession as any,
          action: 'APPROVE',
        })
      ).rejects.toThrowError('Supervisor or Administrative privileges required.');
    });

    it('enforces jurisdiction boundary: foreign ward supervisor cannot inspect complaint', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'WORK_COMPLETED',
        jurisdictionId: '33333333-3333-3333-3333-333333330028', // Ward 28
      } as any);

      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333330028',
        parentId: '33333333-3333-3333-3333-333333330099', // Different parent zone
      } as any);

      await expect(
        verifyComplaint({
          complaintId: mockComplaint.id,
          supervisorSession: foreignSupervisorSession, // Ward 12
          action: 'APPROVE',
        })
      ).rejects.toThrowError('You do not have supervisory authority over this complaint.');
    });

    it('rejects verification if complaint is not in WORK_COMPLETED status', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockComplaint,
        status: 'IN_PROGRESS', // Worker still doing work
      } as any);

      await expect(
        verifyComplaint({
          complaintId: mockComplaint.id,
          supervisorSession,
          action: 'APPROVE',
        })
      ).rejects.toThrowError('Only complaints in WORK_COMPLETED status can be inspected');
    });
  });

  // =========================================================================
  // 5. HTTP API Endpoints Integration (field-status & verify)
  // =========================================================================
  describe('5. HTTP API Route Handlers Integration', () => {
    it('POST /api/v1/ops/complaints/[id]/field-status blocks cross-site mutations via CSRF', async () => {
      const mockReq = new NextRequest(
        'http://localhost:3000/api/v1/ops/complaints/c-field-101/field-status',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ action: 'START_WORK' }),
        }
      );

      const res = await fieldStatusHandler(mockReq, { params: { id: 'c-field-101' } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('POST /api/v1/ops/complaints/[id]/verify blocks cross-site mutations via CSRF', async () => {
      const mockReq = new NextRequest(
        'http://localhost:3000/api/v1/ops/complaints/c-field-101/verify',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ action: 'APPROVE' }),
        }
      );

      const res = await verifyHandler(mockReq, { params: { id: 'c-field-101' } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('POST /api/v1/ops/complaints/[id]/verify validates action input and returns 400 for bad action', async () => {
      vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue(supervisorSession);

      const mockReq = new NextRequest(
        'http://localhost:3000/api/v1/ops/complaints/c-field-101/verify',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'BAD_ACTION' }),
        }
      );

      const res = await verifyHandler(mockReq, { params: { id: 'c-field-101' } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_ACTION');
    });
  });
});
