import { describe, it, expect, vi } from 'vitest';
import { canAccessComplaint, canAccessJurisdiction } from '@/server/auth';
import { UserSession } from '@/lib/auth-session';

describe('Phase 3: Jurisdiction Isolation & Data Ownership Boundaries', () => {
  // Test User Sessions
  const citizenSession: UserSession = {
    userId: 'user-citizen-01',
    email: 'citizen.aarav@govasset.in',
    phoneNumber: '+919822010008',
    fullName: 'Aarav Mehta',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const otherCitizenSession: UserSession = {
    userId: 'user-citizen-02',
    email: 'other.citizen@govasset.in',
    phoneNumber: '+919822099999',
    fullName: 'Other Citizen',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const officerWard28Session: UserSession = {
    userId: 'user-officer-ward28',
    email: 'officer.kothrud@govasset.in',
    phoneNumber: '+919822010002',
    fullName: 'Sunita Patil',
    role: 'OFFICER',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const fieldWorkerSession: UserSession = {
    userId: 'worker-vikram-01',
    email: 'field.vikram@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh',
    role: 'FIELD_WORKER',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const otherFieldWorkerSession: UserSession = {
    userId: 'worker-suresh-02',
    email: 'field.suresh@govasset.in',
    phoneNumber: '+919822010007',
    fullName: 'Suresh Jadhav',
    role: 'FIELD_WORKER',
    departmentId: 'dept-electrical',
    jurisdictionId: 'ward-shivaji-12',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const platformAdminSession: UserSession = {
    userId: 'user-admin-01',
    email: 'admin@govasset.in',
    phoneNumber: '+919822010001',
    fullName: 'Rajesh Sharma',
    role: 'PLATFORM_ADMIN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  describe('Citizen Data Isolation (Anti-IDOR)', () => {
    const aaravComplaint = {
      citizenId: 'user-citizen-01',
      citizenPhone: '+919822010008',
      jurisdictionId: 'ward-kothrud-28',
      departmentId: 'dept-roads',
    };

    it('permits citizen to access their own complaint record', () => {
      expect(canAccessComplaint(citizenSession, aaravComplaint)).toBe(true);
    });

    it('strictly forbids a different citizen from accessing another citizen record (Anti-IDOR)', () => {
      expect(canAccessComplaint(otherCitizenSession, aaravComplaint)).toBe(false);
    });
  });

  describe('Field Worker Assignment Isolation', () => {
    const assignedTask = {
      jurisdictionId: 'ward-kothrud-28',
      departmentId: 'dept-roads',
      assignedWorkerId: 'worker-vikram-01',
    };

    it('permits field worker to view and update work orders explicitly assigned to them', () => {
      expect(canAccessComplaint(fieldWorkerSession, assignedTask)).toBe(true);
    });

    it('forbids field worker from viewing or updating other workers assignments', () => {
      expect(canAccessComplaint(otherFieldWorkerSession, assignedTask)).toBe(false);
    });
  });

  describe('Officer Jurisdiction & Department Isolation', () => {
    it('permits officer to access complaint matching both their assigned Ward and Department', () => {
      const match = {
        jurisdictionId: 'ward-kothrud-28',
        departmentId: 'dept-roads',
      };
      expect(canAccessComplaint(officerWard28Session, match)).toBe(true);
    });

    it('forbids officer from accessing complaint from another jurisdiction (Ward 12)', () => {
      const diffWard = {
        jurisdictionId: 'ward-shivaji-12',
        departmentId: 'dept-roads',
      };
      expect(canAccessComplaint(officerWard28Session, diffWard)).toBe(false);
    });

    it('forbids officer from accessing complaint from another department (Electrical)', () => {
      const diffDept = {
        jurisdictionId: 'ward-kothrud-28',
        departmentId: 'dept-electrical',
      };
      expect(canAccessComplaint(officerWard28Session, diffDept)).toBe(false);
    });
  });

  describe('Platform Admin Oversight', () => {
    it('permits Platform Administrator access across all jurisdictions and records', () => {
      const anyComplaint = {
        citizenId: 'any-user',
        jurisdictionId: 'any-ward',
        departmentId: 'any-dept',
      };
      expect(canAccessComplaint(platformAdminSession, anyComplaint)).toBe(true);
    });
  });

  describe('Officer Mutation Authorization Enforcement (Triage & Assignment)', () => {
    it('throws FORBIDDEN 403 when officer attempts to triage a complaint in another ward', async () => {
      const { triageComplaint, WorkflowError } = await import('@/server/complaint-service');
      const { db } = await import('@/lib/db');

      const spy = vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-diff-ward-01',
        referenceNumber: 'GOV-2026-00088',
        jurisdictionId: 'ward-shivaji-12', // Ward 12 vs Officer Ward 28
        departmentId: 'dept-roads',
        status: 'SUBMITTED',
        citizenPhone: '+919822010008',
        version: 1,
      } as any);

      await expect(
        triageComplaint({
          complaintId: 'c-diff-ward-01',
          officerSession: officerWard28Session,
          action: 'VALIDATE',
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'FORBIDDEN',
        statusCode: 403,
      });

      spy.mockRestore();
    });

    it('throws FORBIDDEN 403 when officer attempts to triage a complaint in another department', async () => {
      const { triageComplaint } = await import('@/server/complaint-service');
      const { db } = await import('@/lib/db');

      const spy = vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-diff-dept-01',
        referenceNumber: 'GOV-2026-00089',
        jurisdictionId: 'ward-kothrud-28',
        departmentId: 'dept-electrical', // Electrical vs Officer Roads
        status: 'SUBMITTED',
        citizenPhone: '+919822010008',
        version: 1,
      } as any);

      await expect(
        triageComplaint({
          complaintId: 'c-diff-dept-01',
          officerSession: officerWard28Session,
          action: 'VALIDATE',
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'FORBIDDEN',
        statusCode: 403,
      });

      spy.mockRestore();
    });

    it('throws FORBIDDEN 403 when officer attempts to assign a complaint outside their ward', async () => {
      const { assignComplaint } = await import('@/server/complaint-service');
      const { db } = await import('@/lib/db');

      const spy = vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-diff-ward-02',
        referenceNumber: 'GOV-2026-00090',
        jurisdictionId: 'ward-shivaji-12',
        departmentId: 'dept-roads',
        status: 'SUBMITTED',
        version: 1,
      } as any);

      await expect(
        assignComplaint({
          complaintId: 'c-diff-ward-02',
          officerSession: officerWard28Session,
          assignedWorkerId: 'worker-vikram-01',
          targetCompletionAt: new Date(),
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'FORBIDDEN',
        statusCode: 403,
      });

      spy.mockRestore();
    });

    it('throws DEPARTMENT_MISMATCH 400 when assigning a field worker from a different department', async () => {
      const { assignComplaint } = await import('@/server/complaint-service');
      const { db } = await import('@/lib/db');

      const spyComplaint = vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-match-01',
        referenceNumber: 'GOV-2026-00091',
        jurisdictionId: 'ward-kothrud-28',
        departmentId: 'dept-roads',
        status: 'SUBMITTED',
        citizenPhone: '+919822010008',
        version: 1,
      } as any);

      const spyWorker = vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'worker-electrical-01',
        fullName: 'Suresh Lineman',
        role: 'FIELD_WORKER',
        departmentId: 'dept-electrical', // Mismatched department
        isActive: true,
      } as any);

      await expect(
        assignComplaint({
          complaintId: 'c-match-01',
          officerSession: officerWard28Session,
          assignedWorkerId: 'worker-electrical-01',
          targetCompletionAt: new Date(),
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'DEPARTMENT_MISMATCH',
        statusCode: 400,
      });

      spyComplaint.mockRestore();
      spyWorker.mockRestore();
    });
  });

  describe('canAccessJurisdiction Scoping', () => {
    it('allows Officer only for their exact assigned jurisdiction', async () => {
      expect(await canAccessJurisdiction(officerWard28Session, 'ward-kothrud-28')).toBe(true);
      expect(await canAccessJurisdiction(officerWard28Session, 'ward-shivaji-12')).toBe(false);
    });

    it('allows Platform Admin for any jurisdiction', async () => {
      expect(await canAccessJurisdiction(platformAdminSession, 'ward-kothrud-28')).toBe(true);
      expect(await canAccessJurisdiction(platformAdminSession, 'ward-shivaji-12')).toBe(true);
    });

    it('rejects null or missing jurisdiction targets', async () => {
      expect(await canAccessJurisdiction(officerWard28Session, null)).toBe(false);
      expect(await canAccessJurisdiction(officerWard28Session, undefined)).toBe(false);
    });
  });
});
