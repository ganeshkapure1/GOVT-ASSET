import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canTransition,
  assertValidTransition,
  executeStatusTransitionWithOcc,
  FsmInvalidTransitionError,
  FsmConcurrencyError,
  ComplaintStatus,
} from '@/server/fsm';
import { UserRole } from '@/lib/auth-session';

describe('Phase 5: Complaint Finite State Machine (FSM) & Concurrency Guards', () => {
  describe('1. Valid State Machine Lifecycle Transitions', () => {
    it('permits Officer to validate a submitted complaint (SUBMITTED -> TRIAGED_VALIDATED)', () => {
      expect(canTransition('SUBMITTED', 'TRIAGED_VALIDATED', 'OFFICER')).toBe(true);
      expect(() => assertValidTransition('SUBMITTED', 'TRIAGED_VALIDATED', 'OFFICER')).not.toThrow();
    });

    it('permits Officer to reject an invalid petition (SUBMITTED -> REJECTED_INVALID)', () => {
      expect(canTransition('SUBMITTED', 'REJECTED_INVALID', 'OFFICER')).toBe(true);
      expect(() => assertValidTransition('SUBMITTED', 'REJECTED_INVALID', 'OFFICER')).not.toThrow();
    });

    it('permits Officer to link duplicate reports (SUBMITTED -> DUPLICATE_LINKED)', () => {
      expect(canTransition('SUBMITTED', 'DUPLICATE_LINKED', 'OFFICER')).toBe(true);
      expect(() => assertValidTransition('SUBMITTED', 'DUPLICATE_LINKED', 'OFFICER')).not.toThrow();
    });

    it('permits direct assignment from submitted state (SUBMITTED -> ASSIGNED)', () => {
      expect(canTransition('SUBMITTED', 'ASSIGNED', 'OFFICER')).toBe(true);
      expect(canTransition('SUBMITTED', 'ASSIGNED', 'SUPERVISOR')).toBe(true);
    });

    it('permits dispatching triaged complaints (TRIAGED_VALIDATED -> ASSIGNED)', () => {
      expect(canTransition('TRIAGED_VALIDATED', 'ASSIGNED', 'OFFICER')).toBe(true);
      expect(canTransition('TRIAGED_VALIDATED', 'ASSIGNED', 'SUPERVISOR')).toBe(true);
    });

    it('permits Field Worker to acknowledge and start work (ASSIGNED -> IN_PROGRESS)', () => {
      expect(canTransition('ASSIGNED', 'IN_PROGRESS', 'FIELD_WORKER')).toBe(true);
      expect(() => assertValidTransition('ASSIGNED', 'IN_PROGRESS', 'FIELD_WORKER')).not.toThrow();
    });

    it('permits reassigning an existing work order (ASSIGNED -> ASSIGNED)', () => {
      expect(canTransition('ASSIGNED', 'ASSIGNED', 'SUPERVISOR')).toBe(true);
      expect(canTransition('ASSIGNED', 'ASSIGNED', 'OFFICER')).toBe(true);
    });

    it('permits Field Worker to complete repair with photo proof (IN_PROGRESS -> WORK_COMPLETED)', () => {
      expect(canTransition('IN_PROGRESS', 'WORK_COMPLETED', 'FIELD_WORKER')).toBe(true);
      expect(() => assertValidTransition('IN_PROGRESS', 'WORK_COMPLETED', 'FIELD_WORKER')).not.toThrow();
    });

    it('permits Supervisor to approve resolution (WORK_COMPLETED -> VERIFIED_RESOLVED)', () => {
      expect(canTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'SUPERVISOR')).toBe(true);
      expect(() => assertValidTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'SUPERVISOR')).not.toThrow();
    });

    it('permits Supervisor to return repair for rework (WORK_COMPLETED -> IN_PROGRESS)', () => {
      expect(canTransition('WORK_COMPLETED', 'IN_PROGRESS', 'SUPERVISOR')).toBe(true);
      expect(() => assertValidTransition('WORK_COMPLETED', 'IN_PROGRESS', 'SUPERVISOR')).not.toThrow();
    });

    it('permits citizen or system to archive ticket after 7 days (VERIFIED_RESOLVED -> CLOSED)', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'CLOSED', 'CITIZEN')).toBe(true);
      expect(canTransition('VERIFIED_RESOLVED', 'CLOSED', 'SUPERVISOR')).toBe(true);
    });

    it('permits Citizen to dispute within 7-day window (VERIFIED_RESOLVED -> DISPUTED_REOPENED)', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'CITIZEN')).toBe(true);
      expect(() => assertValidTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'CITIZEN')).not.toThrow();
    });

    it('permits Department Admin to triage and reassign disputed tickets (DISPUTED_REOPENED -> ASSIGNED)', () => {
      expect(canTransition('DISPUTED_REOPENED', 'ASSIGNED', 'DEPT_ADMIN')).toBe(true);
      expect(canTransition('DISPUTED_REOPENED', 'IN_PROGRESS', 'DEPT_ADMIN')).toBe(true);
    });
  });

  describe('2. Illegal Status Transitions (Rejection Matrix)', () => {
    it('rejects jumping from SUBMITTED directly to CLOSED', () => {
      expect(canTransition('SUBMITTED', 'CLOSED')).toBe(false);
      expect(() => assertValidTransition('SUBMITTED', 'CLOSED', 'OFFICER')).toThrow(
        FsmInvalidTransitionError
      );
    });

    it('rejects jumping from SUBMITTED directly to WORK_COMPLETED without assignment', () => {
      expect(canTransition('SUBMITTED', 'WORK_COMPLETED')).toBe(false);
      expect(() => assertValidTransition('SUBMITTED', 'WORK_COMPLETED', 'FIELD_WORKER')).toThrow(
        FsmInvalidTransitionError
      );
    });

    it('rejects reopening permanently CLOSED complaints', () => {
      expect(canTransition('CLOSED', 'SUBMITTED')).toBe(false);
      expect(canTransition('CLOSED', 'IN_PROGRESS')).toBe(false);
      expect(() => assertValidTransition('CLOSED', 'IN_PROGRESS', 'FIELD_WORKER')).toThrow(
        FsmInvalidTransitionError
      );
    });

    it('rejects assigning complaints already marked REJECTED_INVALID', () => {
      expect(canTransition('REJECTED_INVALID', 'ASSIGNED')).toBe(false);
      expect(() => assertValidTransition('REJECTED_INVALID', 'ASSIGNED', 'OFFICER')).toThrow(
        FsmInvalidTransitionError
      );
    });

    it('rejects modifying tickets permanently linked as DUPLICATE_LINKED', () => {
      expect(canTransition('DUPLICATE_LINKED', 'ASSIGNED')).toBe(false);
      expect(canTransition('DUPLICATE_LINKED', 'WORK_COMPLETED')).toBe(false);
      expect(() => assertValidTransition('DUPLICATE_LINKED', 'ASSIGNED', 'OFFICER')).toThrow(
        FsmInvalidTransitionError
      );
    });

    it('rejects jumping from IN_PROGRESS directly to CLOSED without supervisor inspection', () => {
      expect(canTransition('IN_PROGRESS', 'CLOSED')).toBe(false);
      expect(() => assertValidTransition('IN_PROGRESS', 'CLOSED', 'FIELD_WORKER')).toThrow(
        FsmInvalidTransitionError
      );
    });
  });

  describe('3. Role-Based Transition Permissions', () => {
    it('forbids Citizen from validating complaints', () => {
      expect(canTransition('SUBMITTED', 'TRIAGED_VALIDATED', 'CITIZEN')).toBe(false);
      expect(() => assertValidTransition('SUBMITTED', 'TRIAGED_VALIDATED', 'CITIZEN')).toThrow(
        /Role "CITIZEN" is not authorized/
      );
    });

    it('forbids Field Worker from rejecting complaints', () => {
      expect(canTransition('SUBMITTED', 'REJECTED_INVALID', 'FIELD_WORKER')).toBe(false);
      expect(() => assertValidTransition('SUBMITTED', 'REJECTED_INVALID', 'FIELD_WORKER')).toThrow(
        /Role "FIELD_WORKER" is not authorized/
      );
    });

    it('forbids Officer from approving supervisor quality resolution', () => {
      expect(canTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'OFFICER')).toBe(false);
      expect(() =>
        assertValidTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'OFFICER')
      ).toThrow(/Role "OFFICER" is not authorized/);
    });

    it('forbids Field Worker from approving their own work order into VERIFIED_RESOLVED', () => {
      expect(canTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'FIELD_WORKER')).toBe(false);
      expect(() =>
        assertValidTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'FIELD_WORKER')
      ).toThrow(/Role "FIELD_WORKER" is not authorized/);
    });

    it('forbids Supervisor from submitting citizen disputes', () => {
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'SUPERVISOR')).toBe(false);
      expect(() =>
        assertValidTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'SUPERVISOR')
      ).toThrow(/Role "SUPERVISOR" is not authorized/);
    });

    it('allows Platform Admin administrative override on transitions', () => {
      expect(canTransition('SUBMITTED', 'TRIAGED_VALIDATED', 'PLATFORM_ADMIN')).toBe(true);
      expect(canTransition('WORK_COMPLETED', 'VERIFIED_RESOLVED', 'PLATFORM_ADMIN')).toBe(true);
      expect(canTransition('VERIFIED_RESOLVED', 'DISPUTED_REOPENED', 'PLATFORM_ADMIN')).toBe(true);
    });
  });

  describe('4. Optimistic Concurrency Control (OCC)', () => {
    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        complaint: {
          updateMany: vi.fn(),
          findUnique: vi.fn(),
          findUniqueOrThrow: vi.fn(),
        },
        complaintTimeline: {
          create: vi.fn(),
        },
      };
    });

    it('successfully transitions and increments version when expected version matches', async () => {
      mockTx.complaint.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.complaint.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'c-test-01',
        status: 'TRIAGED_VALIDATED',
        version: 3,
      });
      mockTx.complaintTimeline.create.mockResolvedValueOnce({ id: 'tl-01' });

      const updated = await executeStatusTransitionWithOcc(mockTx, {
        complaintId: 'c-test-01',
        expectedVersion: 2,
        fromStatus: 'SUBMITTED',
        toStatus: 'TRIAGED_VALIDATED',
        actorId: 'usr-officer-01',
        actorRole: 'OFFICER',
        publicNote: 'Validated by officer',
      });

      expect(mockTx.complaint.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'c-test-01',
          version: 2,
          status: 'SUBMITTED',
        },
        data: {
          status: 'TRIAGED_VALIDATED',
          version: { increment: 1 },
        },
      });

      expect(mockTx.complaintTimeline.create).toHaveBeenCalledWith({
        data: {
          complaintId: 'c-test-01',
          actorId: 'usr-officer-01',
          fromStatus: 'SUBMITTED',
          toStatus: 'TRIAGED_VALIDATED',
          publicNote: 'Validated by officer',
          internalNote: null,
          metadata: undefined,
        },
      });

      expect(updated.version).toBe(3);
    });

    it('throws FsmConcurrencyError (409 Conflict) when version mismatch occurs (concurrent update)', async () => {
      // updateMany returns count: 0 because version was bumped concurrently
      mockTx.complaint.updateMany.mockResolvedValueOnce({ count: 0 });
      mockTx.complaint.findUnique.mockResolvedValueOnce({
        id: 'c-test-01',
        version: 3, // Database has version 3, caller passed version 2
        status: 'SUBMITTED',
      });

      await expect(
        executeStatusTransitionWithOcc(mockTx, {
          complaintId: 'c-test-01',
          expectedVersion: 2,
          fromStatus: 'SUBMITTED',
          toStatus: 'TRIAGED_VALIDATED',
          actorId: 'usr-officer-01',
          actorRole: 'OFFICER',
        })
      ).rejects.toThrow(FsmConcurrencyError);

      expect(mockTx.complaintTimeline.create).not.toHaveBeenCalled();
    });

    it('throws FsmInvalidTransitionError if complaint was already moved to a different status', async () => {
      mockTx.complaint.updateMany.mockResolvedValueOnce({ count: 0 });
      mockTx.complaint.findUnique.mockResolvedValueOnce({
        id: 'c-test-01',
        version: 2,
        status: 'REJECTED_INVALID', // Already rejected concurrently
      });

      await expect(
        executeStatusTransitionWithOcc(mockTx, {
          complaintId: 'c-test-01',
          expectedVersion: 1,
          fromStatus: 'SUBMITTED',
          toStatus: 'TRIAGED_VALIDATED',
          actorId: 'usr-officer-01',
          actorRole: 'OFFICER',
        })
      ).rejects.toThrow(FsmInvalidTransitionError);
    });

    it('throws 404 error if complaint no longer exists in database', async () => {
      mockTx.complaint.updateMany.mockResolvedValueOnce({ count: 0 });
      mockTx.complaint.findUnique.mockResolvedValueOnce(null);

      await expect(
        executeStatusTransitionWithOcc(mockTx, {
          complaintId: 'non-existent-id',
          expectedVersion: 1,
          fromStatus: 'SUBMITTED',
          toStatus: 'TRIAGED_VALIDATED',
          actorId: 'usr-officer-01',
          actorRole: 'OFFICER',
        })
      ).rejects.toThrow(/not found/);
    });
  });
});
