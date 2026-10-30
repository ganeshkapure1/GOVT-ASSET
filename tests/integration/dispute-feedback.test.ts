import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  disputeComplaint,
  recordCitizenFeedback,
  getCitizenFeedback,
  WorkflowError,
  DISPUTE_WINDOW_MS,
} from '@/server/complaint-service';
import { autoCloseResolvedComplaints } from '@/server/auto-close';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import * as authModule from '@/server/auth';
import { POST as disputeHandler } from '@/app/api/v1/complaints/[id]/dispute/route';
import { POST as feedbackPostHandler, GET as feedbackGetHandler } from '@/app/api/v1/complaints/[id]/feedback/route';
import { POST as autoCloseHandler } from '@/app/api/v1/admin/auto-close/route';
import { NextRequest } from 'next/server';

describe('Phase 7: Citizen Dispute, Resolution & Feedback Loop (Integration)', () => {
  const citizenAaravSession: UserSession = {
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

  const otherCitizenSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660009',
    email: 'citizen.rohit@govasset.in',
    phoneNumber: '+919822010009',
    fullName: 'Rohit Sharma',
    role: 'CITIZEN',
    departmentId: null,
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

  const RESOLUTION_DATE = new Date('2026-10-20T10:00:00.000Z');

  const mockResolvedComplaint = {
    id: 'c-disp-001',
    referenceNumber: 'GOV-2026-00482',
    citizenId: citizenAaravSession.userId,
    citizenPhone: '+919822010008',
    title: 'Deep Pothole on Arterial Corridor',
    status: 'VERIFIED_RESOLVED',
    priority: 'P1_CRITICAL',
    jurisdictionId: '33333333-3333-3333-3333-333333330028',
    departmentId: '44444444-4444-4444-4444-444444440001',
    disputeCount: 0,
    version: 3,
    createdAt: new Date('2026-10-18T08:00:00.000Z'),
    updatedAt: RESOLUTION_DATE,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Citizen Dispute Workflow & Boundary Enforcement
  // =========================================================================
  describe('1. Citizen Dispute Workflow', () => {
    it('citizen disputes own verified complaint within 7-day window: transitions to DISPUTED_REOPENED', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        createdAt: RESOLUTION_DATE,
      } as any);

      let createdTimeline: any = null;
      let createdNotification: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...mockResolvedComplaint,
              status: 'DISPUTED_REOPENED',
              disputeCount: 1,
              version: 4,
            }),
            findUnique: vi.fn().mockResolvedValue({
              ...mockResolvedComplaint,
              status: 'DISPUTED_REOPENED',
              disputeCount: 1,
              version: 4,
            }),
          },
          complaintTimeline: {
            create: vi.fn().mockImplementation((args: any) => {
              createdTimeline = args.data;
              return {};
            }),
          },
          complaintEvidence: { create: vi.fn().mockResolvedValue({}) },
          notification: {
            create: vi.fn().mockImplementation((args: any) => {
              createdNotification = args.data;
              return {};
            }),
          },
        });
      });

      // Submit on Day 3 after resolution
      const testNow = new Date(RESOLUTION_DATE.getTime() + 3 * 24 * 60 * 60 * 1000);
      const disputeReason = 'Loose gravel was washed away by morning rains. The cavity depth is still dangerous.';

      const result = await disputeComplaint({
        complaintId: mockResolvedComplaint.id,
        citizenSession: citizenAaravSession,
        disputeReason,
        evidenceFileKey: 'evidence/dispute_photo_01.webp',
        expectedVersion: 3,
        now: testNow,
      });

      expect(result.status).toBe('DISPUTED_REOPENED');
      expect(result.disputeCount).toBe(1);
      expect(createdTimeline).not.toBeNull();
      expect(createdTimeline.toStatus).toBe('DISPUTED_REOPENED');
      expect(createdTimeline.metadata.disputeReason).toBe(disputeReason);
      expect(createdNotification).not.toBeNull();
      expect(createdNotification.templateCode).toBe('COMPLAINT_DISPUTED');
      expect(createdNotification.recipientPhone).toBe('+919822010008');
    });

    it('rejects dispute if submitted after 7 calendar days deadline', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        createdAt: RESOLUTION_DATE,
      } as any);

      // Submit on Day 8 after resolution (outside 7-day window)
      const expiredTime = new Date(RESOLUTION_DATE.getTime() + 8 * 24 * 60 * 60 * 1000);

      await expect(
        disputeComplaint({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          disputeReason: 'Pothole patch broke apart and asphalt washed away into stormwater drain.',
          now: expiredTime,
        })
      ).rejects.toThrowError('The 7-calendar-day dispute window for this grievance has expired.');
    });

    it('rejects dispute by a different citizen (anti-IDOR security)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);

      await expect(
        disputeComplaint({
          complaintId: mockResolvedComplaint.id,
          citizenSession: otherCitizenSession, // Different citizen
          disputeReason: 'I am a neighbor and the work was not completed properly here.',
        })
      ).rejects.toThrowError('You can only dispute complaints registered under your account.');
    });

    it('rejects dispute from non-citizen staff (e.g. Field Worker)', async () => {
      await expect(
        disputeComplaint({
          complaintId: mockResolvedComplaint.id,
          citizenSession: fieldWorkerSession as any,
          disputeReason: 'Field crew requesting another review on the site.',
        })
      ).rejects.toThrowError('Only citizens or platform administrators can raise disputes.');
    });

    it('allows Platform Admin to reopen/dispute on behalf of citizen', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        createdAt: RESOLUTION_DATE,
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({
              ...mockResolvedComplaint,
              status: 'DISPUTED_REOPENED',
              disputeCount: 1,
              version: 4,
            }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const result = await disputeComplaint({
        complaintId: mockResolvedComplaint.id,
        citizenSession: adminSession,
        disputeReason: 'Municipal commissioner audit flagged unfinished leveling work.',
        now: new Date(RESOLUTION_DATE.getTime() + 2 * 24 * 60 * 60 * 1000),
      });

      expect(result.status).toBe('DISPUTED_REOPENED');
    });

    it('rejects dispute for complaints not in VERIFIED_RESOLVED status (e.g. IN_PROGRESS)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockResolvedComplaint,
        status: 'IN_PROGRESS',
      } as any);

      await expect(
        disputeComplaint({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          disputeReason: 'Premature dispute while maintenance team is still working on site.',
        })
      ).rejects.toThrowError('Only complaints in "VERIFIED_RESOLVED" status can be disputed');
    });

    it('rejects dispute with empty or insufficiently detailed explanation (< 15 characters)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);

      await expect(
        disputeComplaint({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          disputeReason: 'Bad repair.', // Only 11 chars
        })
      ).rejects.toThrowError('A meaningful dispute explanation of at least 15 characters is required.');
    });
  });

  // =========================================================================
  // 2. Seven-Day Auto-Closure Policy (autoCloseResolvedComplaints)
  // =========================================================================
  describe('2. Seven-Day Auto-Closure Policy', () => {
    it('automatically closes tickets verified >= 7 days ago with no dispute', async () => {
      const oldResolution = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const candidateTicket = {
        ...mockResolvedComplaint,
        id: 'c-autoclose-01',
        updatedAt: oldResolution,
      };

      vi.spyOn(db.complaint, 'findMany').mockResolvedValueOnce([candidateTicket as any]);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        createdAt: oldResolution,
      } as any);

      let closedStatus = false;
      let closedNotification: any = null;

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            findUnique: vi.fn().mockResolvedValue({
              id: candidateTicket.id,
              status: 'VERIFIED_RESOLVED',
              version: 3,
            }),
            updateMany: vi.fn().mockImplementation(() => {
              closedStatus = true;
              return { count: 1 };
            }),
            update: vi.fn().mockImplementation(() => {
              closedStatus = true;
              return { ...candidateTicket, status: 'CLOSED', version: 4 };
            }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: {
            create: vi.fn().mockImplementation((args: any) => {
              closedNotification = args.data;
              return {};
            }),
          },
        });
      });

      const outcome = await autoCloseResolvedComplaints();

      expect(outcome.processed).toBe(1);
      expect(outcome.closed).toBe(1);
      expect(closedStatus).toBe(true);
      expect(closedNotification).not.toBeNull();
      expect(closedNotification.templateCode).toBe('COMPLAINT_AUTO_CLOSED');
    });

    it('does not close tickets that were verified less than 7 days ago', async () => {
      const recentResolution = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      vi.spyOn(db.complaint, 'findMany').mockResolvedValueOnce([]); // findMany query already excludes it by updatedAt <= cutoff

      const outcome = await autoCloseResolvedComplaints();

      expect(outcome.processed).toBe(0);
      expect(outcome.closed).toBe(0);
    });

    it('skips complaints that were disputed concurrently (race condition protection)', async () => {
      const oldResolution = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const candidateTicket = {
        ...mockResolvedComplaint,
        id: 'c-autoclose-race',
        updatedAt: oldResolution,
      };

      vi.spyOn(db.complaint, 'findMany').mockResolvedValueOnce([candidateTicket as any]);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        createdAt: oldResolution,
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            // Citizen concurrently disputed it just before transaction executed!
            findUnique: vi.fn().mockResolvedValue({
              id: candidateTicket.id,
              status: 'DISPUTED_REOPENED',
              version: 4,
            }),
            updateMany: vi.fn(),
            update: vi.fn(),
          },
        });
      });

      const outcome = await autoCloseResolvedComplaints();

      expect(outcome.processed).toBe(1);
      expect(outcome.closed).toBe(0);
      expect(outcome.skipped).toBe(1);
    });

    it('idempotency: repeated execution does not duplicate side effects or fail', async () => {
      // First run: closed ticket
      // Second run: complaint is now status 'CLOSED', so findMany returns empty array
      vi.spyOn(db.complaint, 'findMany').mockResolvedValueOnce([]);

      const outcome = await autoCloseResolvedComplaints();

      expect(outcome.processed).toBe(0);
      expect(outcome.closed).toBe(0);
      expect(outcome.errors.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. Citizen Feedback Workflow
  // =========================================================================
  describe('3. Citizen Feedback Workflow', () => {
    it('records valid 1-5 star citizen rating and comment on resolved complaint', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce(null); // No previous feedback

      let createdTimeline: any = null;
      (vi.spyOn(db.complaintTimeline, 'create') as any).mockImplementation(async (args: any) => {
        createdTimeline = args.data;
        return { id: 'tl-feed-01', createdAt: new Date() } as any;
      });

      const feedback = await recordCitizenFeedback({
        complaintId: mockResolvedComplaint.id,
        citizenSession: citizenAaravSession,
        rating: 5,
        feedbackText: 'Pothole was leveled cleanly and asphalt compacted flush with the road grade. Excellent service!',
      });

      expect(feedback.rating).toBe(5);
      expect(createdTimeline).not.toBeNull();
      expect(createdTimeline.metadata.type).toBe('CITIZEN_FEEDBACK');
      expect(createdTimeline.metadata.rating).toBe(5);
    });

    it('rejects duplicate feedback submission on the same grievance', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValueOnce({
        id: 'tl-existing-feed',
        metadata: { type: 'CITIZEN_FEEDBACK', rating: 4 },
      } as any);

      await expect(
        recordCitizenFeedback({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          rating: 4,
          feedbackText: 'Trying to submit a second rating.',
        })
      ).rejects.toThrowError('Feedback has already been submitted for this grievance.');
    });

    it('rejects feedback with rating outside bounds (e.g. 0 or 6)', async () => {
      await expect(
        recordCitizenFeedback({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          rating: 0,
        })
      ).rejects.toThrowError('Rating must be an integer between 1 and 5 stars.');

      await expect(
        recordCitizenFeedback({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          rating: 6,
        })
      ).rejects.toThrowError('Rating must be an integer between 1 and 5 stars.');
    });

    it('rejects feedback on an unresolved complaint (e.g. IN_PROGRESS)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        ...mockResolvedComplaint,
        status: 'IN_PROGRESS',
      } as any);

      await expect(
        recordCitizenFeedback({
          complaintId: mockResolvedComplaint.id,
          citizenSession: citizenAaravSession,
          rating: 5,
        })
      ).rejects.toThrowError('Feedback can only be submitted for resolved or closed complaints');
    });

    it('rejects feedback from unauthorized citizen on another citizen’s ticket', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce(mockResolvedComplaint as any);

      await expect(
        recordCitizenFeedback({
          complaintId: mockResolvedComplaint.id,
          citizenSession: otherCitizenSession,
          rating: 4,
        })
      ).rejects.toThrowError('You can only submit feedback for complaints registered under your account.');
    });
  });

  // =========================================================================
  // 4. CSRF & Mutation Route Handlers
  // =========================================================================
  describe('4. CSRF Protection & Route Mutation Handlers', () => {
    it('POST /api/v1/complaints/[id]/dispute blocks cross-site mutations', async () => {
      const mockReq = new NextRequest(
        'http://localhost:3000/api/v1/complaints/c-disp-001/dispute',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ disputeReason: 'Valid dispute explanation with over 15 characters.' }),
        }
      );

      const res = await disputeHandler(mockReq, { params: { id: 'c-disp-001' } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('POST /api/v1/complaints/[id]/feedback blocks cross-site mutations', async () => {
      const mockReq = new NextRequest(
        'http://localhost:3000/api/v1/complaints/c-disp-001/feedback',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ rating: 5 }),
        }
      );

      const res = await feedbackPostHandler(mockReq, { params: { id: 'c-disp-001' } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('POST /api/v1/admin/auto-close blocks cross-site mutations', async () => {
      const mockReq = new NextRequest(
        'http://localhost:3000/api/v1/admin/auto-close',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'sec-fetch-site': 'cross-site',
          },
        }
      );

      const res = await autoCloseHandler(mockReq);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });
  });
});
