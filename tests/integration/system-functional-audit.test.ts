import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
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
import {
  canTransition,
  assertValidTransition,
  executeStatusTransitionWithOcc,
  FsmError,
  FsmInvalidTransitionError,
  FsmConcurrencyError,
} from '@/server/fsm';
import {
  requestPhoneOtp,
  verifyPhoneOtp,
  clearOtpStore,
} from '@/server/otp-service';
import {
  canAccessComplaint,
  canAccessJurisdiction,
  verifyCsrfProtection,
  AuthError,
} from '@/server/auth';
import {
  getAdminOverviewStats,
  deleteJurisdiction,
  updateSlaPolicy,
  inspectWardBoundary,
  AdminServiceError,
} from '@/server/admin-service';
import { enqueueJob, clearQueueStore } from '@/server/queue';
import { autoCloseResolvedComplaints } from '@/server/auto-close';
import { checkAndEscalateSlaBreaches } from '@/server/sla-cron';
import { findPotentialDuplicates } from '@/server/duplicate-finder';
import {
  SYNTHETIC_BOUNDARY_DISCLAIMER,
  STORAGE_BACKEND_NOTICE,
  NOTIFICATION_MOCK_NOTICE,
} from '@/lib/constants';

describe('GovAsset Complete System Functional Audit & Workflow Verification', () => {
  // Test Actor Sessions
  const citizenAarav: UserSession = {
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

  const citizenSunita: UserSession = {
    userId: '66666666-6666-6666-6666-666666660099',
    email: 'citizen.sunita@govasset.in',
    phoneNumber: '+919822010099',
    fullName: 'Sunita Rao',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: '33333333-3333-3333-3333-333333330012',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const officerWard28: UserSession = {
    userId: '66666666-6666-6666-6666-666666660002',
    email: 'officer.kothrud@govasset.in',
    phoneNumber: '+919822010002',
    fullName: 'Sunita Patil (Ward 28 Officer)',
    role: 'OFFICER',
    departmentId: '44444444-4444-4444-4444-444444440001', // Road Maintenance
    jurisdictionId: '33333333-3333-3333-3333-333333330028', // Ward 28 - Kothrud
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const officerWard12: UserSession = {
    userId: '66666666-6666-6666-6666-666666660003',
    email: 'officer.shivaji@govasset.in',
    phoneNumber: '+919822010003',
    fullName: 'Amit Deshmukh (Ward 12 Officer)',
    role: 'OFFICER',
    departmentId: '44444444-4444-4444-4444-444444440002', // Electrical
    jurisdictionId: '33333333-3333-3333-3333-333333330012', // Ward 12 - Shivajinagar
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const supervisorRoads: UserSession = {
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

  const workerVikram: UserSession = {
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

  const workerSuresh: UserSession = {
    userId: '66666666-6666-6666-6666-666666660007',
    email: 'field.suresh@govasset.in',
    phoneNumber: '+919822010007',
    fullName: 'Suresh Jadhav (Electrical Lineman)',
    role: 'FIELD_WORKER',
    departmentId: '44444444-4444-4444-4444-444444440002',
    jurisdictionId: '33333333-3333-3333-3333-333333330012',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const platformAdmin: UserSession = {
    userId: '66666666-6666-6666-6666-666666660001',
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
    clearOtpStore();
    clearQueueStore();
  });

  // ===========================================================================
  // PART 2: CITIZEN AUTHENTICATION & OTP LIFECYCLE
  // ===========================================================================
  describe('Part 2: Citizen Authentication & OTP Engine Verification', () => {
    it('validates mobile number: rejects invalid formats or letters', async () => {
      const res1 = await requestPhoneOtp('12345');
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('valid 10-digit');

      const res2 = await requestPhoneOtp('invalidphone');
      expect(res2.success).toBe(false);
    });

    it('enforces 60-second resend cooldown on repeated OTP requests', async () => {
      const t0 = new Date('2026-10-29T10:00:00Z');
      const res1 = await requestPhoneOtp('+919822010008', t0);
      expect(res1.success).toBe(true);

      // Attempt immediate resend at t0 + 10s (should be blocked)
      const t1 = new Date('2026-10-29T10:00:10Z');
      const res2 = await requestPhoneOtp('+919822010008', t1);
      expect(res2.success).toBe(false);
      expect(res2.cooldownRemainingSeconds).toBe(50);
      expect(res2.error).toContain('wait 50s before requesting');

      // Attempt after cooldown elapsed at t0 + 65s (should succeed)
      const t2 = new Date('2026-10-29T10:01:05Z');
      const res3 = await requestPhoneOtp('+919822010008', t2);
      expect(res3.success).toBe(true);
    });

    it('enforces max 3 attempt limit: invalidates challenge after 3 wrong codes', async () => {
      const t0 = new Date('2026-10-29T10:00:00Z');
      await requestPhoneOtp('+919822010008', t0);

      // Attempt 1: wrong code
      const v1 = await verifyPhoneOtp('+919822010008', '000000', t0);
      expect(v1.success).toBe(false);
      expect(v1.error).toContain('2 attempt(s) remaining');

      // Attempt 2: wrong code
      const v2 = await verifyPhoneOtp('+919822010008', '111111', t0);
      expect(v2.success).toBe(false);
      expect(v2.error).toContain('1 attempt(s) remaining');

      // Attempt 3: wrong code -> challenge invalidated
      const v3 = await verifyPhoneOtp('+919822010008', '222222', t0);
      expect(v3.success).toBe(false);
      expect(v3.error).toContain('invalidated for security');

      // Attempt 4: challenge no longer exists
      const v4 = await verifyPhoneOtp('+919822010008', '333333', t0);
      expect(v4.success).toBe(false);
      expect(v4.error).toContain('No active verification code found');
    });

    it('rejects expired OTP (> 10 minutes TTL)', async () => {
      const t0 = new Date('2026-10-29T10:00:00Z');
      await requestPhoneOtp('+919822010008', t0);

      // Verify at t0 + 11 minutes
      const tExpired = new Date('2026-10-29T10:11:00Z');
      const v = await verifyPhoneOtp('+919822010008', '123456', tExpired);
      expect(v.success).toBe(false);
      expect(v.error).toContain('expired');
    });

    it('consumes OTP on successful verification (single-use invariant)', async () => {
      const t0 = new Date('2026-10-29T10:00:00Z');
      const req = await requestPhoneOtp('+919822010008', t0);
      expect(req.mockOtpNotice).toBeDefined();

      // Extract 6-digit mock code
      const codeMatch = req.mockOtpNotice!.match(/\d{6}/);
      expect(codeMatch).not.toBeNull();
      const code = codeMatch![0];

      // Verify once
      const v1 = await verifyPhoneOtp('+919822010008', code, t0);
      expect(v1.success).toBe(true);
      expect(v1.sessionToken).toBeDefined();

      // Immediate replay with same code must fail
      const v2 = await verifyPhoneOtp('+919822010008', code, t0);
      expect(v2.success).toBe(false);
      expect(v2.error).toContain('No active verification code found');
    });

    it('fails closed in production if SMS gateway is not configured', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSmsMock = process.env.SMS_MOCK;
      const originalTextBee = process.env.TEXTBEE_API_KEY;
      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.SMS_MOCK = '1';
        delete process.env.FAST2SMS_API_KEY;
        delete process.env.MSG91_AUTH_KEY;
        delete process.env.TEXTBEE_API_KEY;
        delete process.env.SMS_API_KEY;

        const res = await requestPhoneOtp('+919822010008');
        expect(res.success).toBe(false);
        expect(res.error).toContain('unconfigured in production');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        process.env.SMS_MOCK = originalSmsMock;
        process.env.TEXTBEE_API_KEY = originalTextBee;
      }
    });
  });

  // ===========================================================================
  // PART 3 & 4: CITIZEN REGISTRATION, TRACKING & DATA ISOLATION
  // ===========================================================================
  describe('Part 3 & 4: Citizen Intake, Tracking & Anti-IDOR Isolation', () => {
    it('validates input boundaries on complaint registration', async () => {
      // Missing description
      await expect(
        createComplaint({
          category: 'CAT_POTHOLE',
          description: 'abc', // < 5 chars
          landmarkAddress: 'Paud Road, Kothrud',
          citizenPhone: '+919822010008',
        })
      ).rejects.toThrowError('explanation of the defect is required');

      // Missing landmark
      await expect(
        createComplaint({
          category: 'CAT_POTHOLE',
          description: 'Damaged storm drain overflowing onto road',
          landmarkAddress: '', // empty
          citizenPhone: '+919822010008',
        })
      ).rejects.toThrowError('valid landmark or street address is required');

      // Invalid phone
      await expect(
        createComplaint({
          category: 'CAT_POTHOLE',
          description: 'Damaged storm drain overflowing onto road',
          landmarkAddress: 'Paud Road, Kothrud',
          citizenPhone: '999', // invalid
        })
      ).rejects.toThrowError('valid contact phone number is required');
    });

    it('detects potential duplicate complaints within 50m and 48 hours', async () => {
      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValueOnce([
        {
          id: '77777777-7777-7777-7777-777777770001',
          reference_number: 'GOV-2026-00482',
          title: 'Deep Pothole on Main Arterial Road',
          status: 'IN_PROGRESS',
          priority: 'P1_CRITICAL',
          category_id: '55555555-5555-5555-5555-555555550001',
          category_name: 'Damaged Roads & Potholes',
          category_code: 'CAT_POTHOLE',
          landmark_address: 'Mayur Colony',
          created_at: new Date(),
          parent_complaint_id: null,
          distance_meters: 18.5,
        },
      ]);

      const dupes = await findPotentialDuplicates({
        categoryId: '55555555-5555-5555-5555-555555550001',
        latitude: 18.5089,
        longitude: 73.8112,
      });

      expect(dupes.length).toBe(1);
      expect(dupes[0].referenceNumber).toBe('GOV-2026-00482');
      expect(dupes[0].distanceMeters).toBe(18.5);
    });

    it('preserves citizen privacy: masks contact phone numbers in tracking', async () => {
      vi.spyOn(db.complaint, 'findFirst').mockResolvedValueOnce({
        id: '77777777-7777-7777-7777-777777770001',
        referenceNumber: 'GOV-2026-00482',
        title: 'Deep Pothole on Main Arterial Road',
        citizenPhone: '+919822010008',
        landmarkAddress: 'Mayur Colony, Opp. Krishna Hospital',
        status: 'IN_PROGRESS',
        priority: 'P1_CRITICAL',
        version: 1,
        createdAt: new Date('2026-10-25T20:03:36.885Z'),
        resolutionDueAt: new Date('2026-10-26T20:03:36.885Z'),
        category: { nameEn: 'Damaged Roads & Potholes', code: 'CAT_POTHOLE' },
        department: { name: 'Public Works Department - Road Infrastructure', code: 'ROAD_MAINTENANCE' },
        jurisdiction: { name: 'Ward 28 - Kothrud', code: 'PUN-Z02-W28' },
        timeline: [
          {
            id: 'time-1',
            toStatus: 'SUBMITTED',
            fromStatus: null,
            publicNote: 'Complaint registered.',
            createdAt: new Date('2026-10-25T20:03:36.885Z'),
            actor: null,
          },
        ],
        evidence: [],
        assignments: [],
      } as any);

      const tracked = await getTrackedComplaint('GOV-2026-00482');
      expect(tracked).not.toBeNull();
      expect(tracked!.reporterMasked).toBe('+91 98*** **008');
      expect(tracked!.reporterMasked).not.toContain('9822010008');
      expect((tracked as any).citizenPhone).toBeUndefined();
    });

    it('anti-IDOR: citizen A cannot access citizen B private complaint details', () => {
      const aaravComplaint = {
        citizenId: citizenAarav.userId,
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
      };

      // Aarav can access his own complaint
      expect(canAccessComplaint(citizenAarav, aaravComplaint)).toBe(true);

      // Sunita cannot access Aarav's complaint
      expect(canAccessComplaint(citizenSunita, aaravComplaint)).toBe(false);
    });
  });

  // ===========================================================================
  // PART 5 & 6: OPERATIONS, FIELD WORKER & SUPERVISOR VERIFICATION
  // ===========================================================================
  describe('Part 5 & 6: Operations Triage, Field Execution & Supervisor Rework', () => {
    it('officer cannot triage complaint outside their assigned jurisdiction or department', () => {
      const ward28RoadsComplaint = {
        citizenId: citizenAarav.userId,
        jurisdictionId: '33333333-3333-3333-3333-333333330028', // Ward 28
        departmentId: '44444444-4444-4444-4444-444444440001', // Roads
      };

      // Ward 28 Roads officer CAN access
      expect(canAccessComplaint(officerWard28, ward28RoadsComplaint)).toBe(true);

      // Ward 12 Electrical officer CANNOT access
      expect(canAccessComplaint(officerWard12, ward28RoadsComplaint)).toBe(false);
    });

    it('unassigned field worker cannot update another worker task', () => {
      const assignedComplaint = {
        citizenId: citizenAarav.userId,
        jurisdictionId: '33333333-3333-3333-3333-333333330028',
        departmentId: '44444444-4444-4444-4444-444444440001',
        assignedWorkerId: workerVikram.userId,
      };

      // Vikram CAN access
      expect(canAccessComplaint(workerVikram, assignedComplaint)).toBe(true);

      // Suresh CANNOT access
      expect(canAccessComplaint(workerSuresh, assignedComplaint)).toBe(false);
    });

    it('FSM Transition: Validates lifecycle sequence SUBMITTED -> TRIAGED -> ASSIGNED -> IN_PROGRESS -> WORK_COMPLETED -> VERIFIED_RESOLVED', () => {
      expect(canTransition('SUBMITTED', 'TRIAGED_VALIDATED', 'OFFICER')).toBe(true);
      expect(canTransition('TRIAGED_VALIDATED', 'ASSIGNED', 'OFFICER')).toBe(true);
      expect(canTransition('ASSIGNED', 'IN_PROGRESS', 'FIELD_WORKER')).toBe(true);
      expect(canTransition('IN_PROGRESS', 'WORK_COMPLETED', 'FIELD_WORKER')).toBe(true);
      expect(canTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'SUPERVISOR')).toBe(true);
      expect(canTransition('VERIFIED_RESOLVED', 'CLOSED', 'CITIZEN')).toBe(true);
    });

    it('FSM Rejects invalid skip transitions with FsmInvalidTransitionError', () => {
      // Cannot jump from SUBMITTED directly to WORK_COMPLETED or CLOSED
      expect(canTransition('SUBMITTED', 'WORK_COMPLETED')).toBe(false);
      expect(canTransition('SUBMITTED', 'CLOSED')).toBe(false);
      expect(canTransition('IN_PROGRESS', 'CLOSED')).toBe(false);

      expect(() =>
        assertValidTransition('SUBMITTED', 'WORK_COMPLETED')
      ).toThrowError(FsmInvalidTransitionError);
    });

    it('Optimistic Concurrency Control: detects version collision and rejects stale updates', async () => {
      // Mock tx that returns result.count === 0 on updateMany
      const mockTx: any = {
        complaint: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findUnique: vi.fn().mockResolvedValue({
            id: '77777777-7777-7777-7777-777777770001',
            version: 3, // Already bumped to 3
            status: 'TRIAGED_VALIDATED',
          }),
        },
      };

      // Stale update: expects version 1, but db is at version 3
      await expect(
        executeStatusTransitionWithOcc(mockTx, {
          complaintId: '77777777-7777-7777-7777-777777770001',
          expectedVersion: 1,
          fromStatus: 'TRIAGED_VALIDATED',
          toStatus: 'ASSIGNED',
          actorRole: 'OFFICER',
        })
      ).rejects.toThrowError(FsmConcurrencyError);
    });

    it('Supervisor rework returns task to ASSIGNED and requires corrective instructions', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: '77777777-7777-7777-7777-777777770001',
        status: 'WORK_COMPLETED',
        jurisdictionId: supervisorRoads.jurisdictionId,
        departmentId: supervisorRoads.departmentId,
        assignments: [{ isActive: true }],
      } as any);

      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValueOnce({
        id: supervisorRoads.jurisdictionId,
      } as any);

      // Rejection without instructions must fail with WorkflowError
      await expect(
        verifyComplaint({
          complaintId: '77777777-7777-7777-7777-777777770001',
          supervisorSession: supervisorRoads,
          action: 'REJECT',
          rejectionReason: '', // Empty reason
        })
      ).rejects.toThrowError(WorkflowError);
    });
  });

  // ===========================================================================
  // PART 7: CITIZEN DISPUTE & FEEDBACK
  // ===========================================================================
  describe('Part 7: 7-Day Citizen Dispute Window & Feedback Rating', () => {
    it('allows dispute within 7 calendar days of verified resolution', async () => {
      const withinWindowDate = new Date(Date.now() - 3 * 86400 * 1000); // 3 days ago

      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: '77777777-7777-7777-7777-777777770002',
        status: 'VERIFIED_RESOLVED',
        citizenId: citizenAarav.userId,
        version: 1,
        disputeCount: 0,
        updatedAt: withinWindowDate,
        timeline: [
          {
            id: 'time-resolved',
            toStatus: 'VERIFIED_RESOLVED',
            createdAt: withinWindowDate,
          },
        ],
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({
              id: '77777777-7777-7777-7777-777777770002',
              status: 'DISPUTED_REOPENED',
              disputeCount: 1,
              version: 2,
            }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const res = await disputeComplaint({
        complaintId: '77777777-7777-7777-7777-777777770002',
        citizenSession: citizenAarav,
        disputeReason: 'Pothole patch collapsed after light rainfall. Subbase exposed.',
      });

      expect(res.status).toBe('DISPUTED_REOPENED');
      expect(res.disputeCount).toBe(1);
    });

    it('rejects dispute after the 7-day calendar window has expired', async () => {
      const expiredDate = new Date(Date.now() - 8 * 86400 * 1000); // 8 days ago (> 7 days)

      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: '77777777-7777-7777-7777-777777770002',
        status: 'VERIFIED_RESOLVED',
        citizenId: citizenAarav.userId,
        version: 1,
        disputeCount: 0,
        updatedAt: expiredDate,
        timeline: [
          {
            id: 'time-resolved',
            toStatus: 'VERIFIED_RESOLVED',
            createdAt: expiredDate,
          },
        ],
      } as any);

      await expect(
        disputeComplaint({
          complaintId: '77777777-7777-7777-7777-777777770002',
          citizenSession: citizenAarav,
          disputeReason: 'Late dispute attempt',
        })
      ).rejects.toThrowError(/dispute window for this grievance has expired/i);
    });

    it('enforces 1-5 rating bounds on citizen feedback', async () => {
      // Rating 0 rejected
      await expect(
        recordCitizenFeedback({
          complaintId: '77777777-7777-7777-7777-777777770002',
          citizenSession: citizenAarav,
          rating: 0,
        })
      ).rejects.toThrowError(/between 1 and 5/i);

      // Rating 6 rejected
      await expect(
        recordCitizenFeedback({
          complaintId: '77777777-7777-7777-7777-777777770002',
          citizenSession: citizenAarav,
          rating: 6,
        })
      ).rejects.toThrowError(/between 1 and 5/i);
    });
  });

  // ===========================================================================
  // PART 8 & 9: ADMIN GOVERNANCE, REFERENTIAL CONSTRAINTS & HISTORICAL PRESERVATION
  // ===========================================================================
  describe('Part 8 & 9: Admin Governance, Referential Integrity & Invariants', () => {
    it('prevents unsafe deletion of jurisdiction with active complaints or child wards', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333330028',
        name: 'Ward 28 - Kothrud',
        code: 'PUN-Z02-W28',
        children: [],
        complaints: [{ id: '77777777-7777-7777-7777-777777770001' }],
        users: [],
      } as any);

      await expect(
        deleteJurisdiction(platformAdmin, '33333333-3333-3333-3333-333333330028')
      ).rejects.toThrowError(AdminServiceError);
    });

    it('enforces positive SLA hours on policy updates', async () => {
      await expect(
        updateSlaPolicy(platformAdmin, {
          categoryId: '55555555-5555-5555-5555-555555550001',
          priority: 'P2_HIGH',
          responseSlaHours: -5, // Negative
          resolutionSlaHours: 24,
        })
      ).rejects.toThrowError(/positive integer/i);
    });

    it('flags synthetic ward boundaries with explicit disclaimer notice', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333330028',
        name: 'Ward 28 - Kothrud',
        level: 'WARD',
      } as any);

      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValueOnce([
        {
          has_boundary: true,
          geojson: '{"type":"Polygon","coordinates":[[[73.80,18.50],[73.82,18.50],[73.82,18.52],[73.80,18.52],[73.80,18.50]]]}',
          area_sq_km: 4.8,
          is_valid: true,
        },
      ]);

      const inspection = await inspectWardBoundary('33333333-3333-3333-3333-333333330028');
      expect(inspection.spatialStatus.disclaimer).toBe(SYNTHETIC_BOUNDARY_DISCLAIMER);
      expect(inspection.spatialStatus.disclaimer).toContain('synthetic pilot approximations');
    });

    it('idempotency: duplicate background job queueing does not spawn duplicate tasks', async () => {
      const key = 'sla-breach-alert-unique-key-001';

      // Enqueue 1st time
      const res1 = await enqueueJob('SEND_NOTIFICATION', { msg: 'First dispatch' }, { idempotencyKey: key });
      expect(res1.isDuplicate).toBe(false);

      // Enqueue 2nd time with identical idempotencyKey
      const res2 = await enqueueJob('SEND_NOTIFICATION', { msg: 'Second duplicate dispatch' }, { idempotencyKey: key });
      expect(res2.isDuplicate).toBe(true);
      expect(res2.job.id).toBe(res1.job.id);
    });
  });

  // ===========================================================================
  // PART 10: SCHEDULER, SLA ESCALATION & HEALTH PROBES
  // ===========================================================================
  describe('Part 10: Background Scheduler, Auto-Close & Telemetry', () => {
    it('SLA escalation marks breached complaints and logs timeline alert', async () => {
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 2 * 3600 * 1000); // 2 hours overdue

      vi.spyOn(db.complaint, 'findMany').mockResolvedValueOnce([
        {
          id: '77777777-7777-7777-7777-777777770001',
          referenceNumber: 'GOV-2026-00482',
          status: 'IN_PROGRESS',
          resolutionDueAt: overdueDate,
          responseDueAt: overdueDate,
          slaBreached: false,
          citizenPhone: '+919822010008',
          department: { name: 'Roads Dept' },
        },
      ] as any);

      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce(null);
      vi.spyOn(db.complaint, 'update').mockResolvedValueOnce({} as any);
      vi.spyOn(db.complaintTimeline, 'create').mockResolvedValueOnce({} as any);

      const result = await checkAndEscalateSlaBreaches({ referenceNow: now });
      expect(result.evaluated).toBe(1);
      expect(result.newlyBreached).toBe(1);
      expect(result.escalationsSent).toBe(1);
    });

    it('auto-close does not close complaint with active dispute', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 86400 * 1000);

      vi.spyOn(db.complaint, 'findMany').mockResolvedValueOnce([
        {
          id: 'complaint-disputed',
          referenceNumber: 'GOV-2026-DISPUTED',
          status: 'DISPUTED_REOPENED', // In dispute
          disputeCount: 1,
          updatedAt: eightDaysAgo,
          timeline: [],
        },
      ] as any);

      const result = await autoCloseResolvedComplaints({
        referenceNow: new Date(),
      });

      // Disputed complaints are not eligible for auto-closure
      expect(result.processed).toBe(1);
      expect(result.closed).toBe(0);
    });
  });
});
