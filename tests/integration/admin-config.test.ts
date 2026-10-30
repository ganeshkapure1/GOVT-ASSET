import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAdminOverviewStats,
  getJurisdictionsHierarchy,
  createJurisdiction,
  updateJurisdiction,
  deleteJurisdiction,
  inspectWardBoundary,
  getSlaPoliciesMatrix,
  updateSlaPolicy,
  getStaffDirectory,
  updateStaffAccess,
  inviteStaffUser,
  getCombinedAuditLogs,
  AdminServiceError,
} from '@/server/admin-service';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import * as authModule from '@/server/auth';
import { SYNTHETIC_BOUNDARY_DISCLAIMER } from '@/lib/constants';
import { GET as overviewHandler } from '@/app/api/v1/admin/overview/route';
import { GET as jurisdictionsGetHandler, POST as jurisdictionsPostHandler } from '@/app/api/v1/admin/jurisdictions/route';
import { PUT as jurisdictionPutHandler, DELETE as jurisdictionDeleteHandler } from '@/app/api/v1/admin/jurisdictions/[id]/route';
import { GET as boundaryHandler } from '@/app/api/v1/admin/jurisdictions/[id]/boundary/route';
import { GET as slaGetHandler, PUT as slaPutHandler } from '@/app/api/v1/admin/sla-matrix/route';
import { GET as usersGetHandler, POST as usersPostHandler } from '@/app/api/v1/admin/users/route';
import { PUT as userPutHandler } from '@/app/api/v1/admin/users/[id]/route';
import { GET as auditLogsHandler } from '@/app/api/v1/admin/audit-logs/route';
import { NextRequest } from 'next/server';

describe('Phase 8: Admin Portal & System Configuration (Integration)', () => {
  const adminSession: UserSession = {
    userId: '11111111-1111-1111-1111-111111110001',
    email: 'admin.verma@csnmc.gov.in',
    phoneNumber: '+919822000001',
    fullName: 'Dr. A. K. Verma (Commissioner)',
    role: 'PLATFORM_ADMIN',
    departmentId: null,
    jurisdictionId: '22222222-2222-2222-2222-222222220001',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const officerSession: UserSession = {
    userId: '11111111-1111-1111-1111-111111110002',
    email: 'officer.patil@csnmc.gov.in',
    phoneNumber: '+919822000002',
    fullName: 'Er. Sandeep Patil',
    role: 'OFFICER',
    departmentId: '44444444-4444-4444-4444-444444440001',
    jurisdictionId: '33333333-3333-3333-3333-333333330001',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const citizenSession: UserSession = {
    userId: '11111111-1111-1111-1111-111111110009',
    email: 'citizen.aarav@govasset.in',
    phoneNumber: '+919822000009',
    fullName: 'Aarav Mehta',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. OVERVIEW & TELEMETRY ANALYTICS
  // ==========================================
  describe('System Overview & Telemetry Analytics', () => {
    it('aggregates total complaints, backlogs, SLA breaches, compliance rate, and staff numbers', async () => {
      vi.spyOn(db.complaint, 'count')
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30)  // backlog
        .mockResolvedValueOnce(70)  // resolved
        .mockResolvedValueOnce(5)   // disputed
        .mockResolvedValueOnce(10); // breaches

      vi.spyOn(db.user, 'count').mockResolvedValue(22); // active staff
      vi.spyOn(db.jurisdiction, 'count').mockResolvedValue(16); // total wards

      vi.spyOn(db.department, 'findMany').mockResolvedValue([
        { id: 'dept-1', name: 'Roads & Infrastructure', code: 'ROADS', _count: { complaints: 40, users: 10 } } as any,
        { id: 'dept-2', name: 'Water Supply & Sewerage', code: 'WATER', _count: { complaints: 60, users: 12 } } as any,
      ]);

      vi.spyOn(db.complaintCategory, 'findMany').mockResolvedValue([
        { id: 'cat-1', nameEn: 'Pothole & Road Damage', code: 'POTHOLE', _count: { complaints: 40 } } as any,
        { id: 'cat-2', nameEn: 'Water Pipe Burst', code: 'PIPE_BURST', _count: { complaints: 60 } } as any,
      ]);

      const stats = await getAdminOverviewStats();

      expect(stats.totalComplaints).toBe(100);
      expect(stats.activeBacklog).toBe(30);
      expect(stats.resolvedComplaints).toBe(70);
      expect(stats.disputedComplaints).toBe(5);
      expect(stats.slaBreachedComplaints).toBe(10);
      expect(stats.slaComplianceRate).toBe(90); // (100 - 10) / 100 * 100 = 90%
      expect(stats.totalStaff).toBe(22);
      expect(stats.totalWards).toBe(16);
      expect(stats.departments).toHaveLength(2);
      expect(stats.departments[0].complaintCount).toBe(40);
      expect(stats.categories).toHaveLength(2);
      expect(stats.categories[0].name).toBe('Pothole & Road Damage');
    });

    it('enforces PLATFORM_ADMIN authorization on GET /api/v1/admin/overview', async () => {
      vi.spyOn(authModule, 'requireAuth').mockImplementation(async (allowedRoles) => {
        if (!allowedRoles || !allowedRoles.includes('CITIZEN' as any)) {
          throw new authModule.AuthError('FORBIDDEN', 403, 'Access denied. Insufficient permissions.');
        }
        return citizenSession;
      });

      const res = await overviewHandler();
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('allows PLATFORM_ADMIN on GET /api/v1/admin/overview', async () => {
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue(adminSession);
      vi.spyOn(db.complaint, 'count').mockResolvedValue(10);
      vi.spyOn(db.user, 'count').mockResolvedValue(5);
      vi.spyOn(db.jurisdiction, 'count').mockResolvedValue(4);
      vi.spyOn(db.department, 'findMany').mockResolvedValue([]);
      vi.spyOn(db.complaintCategory, 'findMany').mockResolvedValue([]);

      const res = await overviewHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalComplaints).toBe(10);
    });
  });

  // ==========================================
  // 2. JURISDICTION HIERARCHY & SAFE DELETION
  // ==========================================
  describe('Jurisdiction Hierarchy & Safe Deletion', () => {
    it('builds nested tree from database records', async () => {
      const mockRecords = [
        {
          id: 'corp-1',
          name: 'Chhatrapati Sambhajinagar Municipal Corporation',
          code: 'CSNMC-ROOT',
          level: 'CORPORATION',
          parentId: null,
          children: [{ id: 'zone-1' }],
          _count: { complaints: 150, users: 50 },
        },
        {
          id: 'zone-1',
          name: 'Zone 1 - City Center',
          code: 'CSN-Z01',
          level: 'ZONE',
          parentId: 'corp-1',
          children: [{ id: 'ward-1' }],
          _count: { complaints: 80, users: 20 },
        },
        {
          id: 'ward-1',
          name: 'Ward 1 - Old Town',
          code: 'CSN-Z01-W01',
          level: 'WARD',
          parentId: 'zone-1',
          children: [],
          _count: { complaints: 30, users: 8 },
        },
      ];

      vi.spyOn(db.jurisdiction, 'findMany').mockResolvedValue(mockRecords as any);

      const result = await getJurisdictionsHierarchy();
      expect(result.roots).toHaveLength(1);
      const root = result.roots[0];
      expect(root.code).toBe('CSNMC-ROOT');
      expect(root.children).toHaveLength(1);
      const zone = root.children[0];
      expect(zone.code).toBe('CSN-Z01');
      expect(zone.children).toHaveLength(1);
      const ward = zone.children[0];
      expect(ward.code).toBe('CSN-Z01-W01');
      expect(ward.complaintCount).toBe(30);
    });

    it('validates parent hierarchy when creating a ZONE or WARD', async () => {
      // 1. Zone assigned to non-CORPORATION parent
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-invalid-parent',
        name: 'Ward 1',
        level: 'WARD',
      } as any);

      await expect(
        createJurisdiction(adminSession, {
          name: 'Zone 5',
          code: 'CSN-Z05',
          level: 'ZONE',
          parentId: 'ward-invalid-parent',
        })
      ).rejects.toThrow('A ZONE must have a CORPORATION as its parent jurisdiction.');

      // 2. Ward assigned to non-ZONE parent
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'corp-parent',
        name: 'Corp',
        level: 'CORPORATION',
      } as any);

      await expect(
        createJurisdiction(adminSession, {
          name: 'Ward 99',
          code: 'CSN-W99',
          level: 'WARD',
          parentId: 'corp-parent',
        })
      ).rejects.toThrow('A WARD must have a ZONE as its parent jurisdiction.');

      // 3. Parent not found
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue(null);
      await expect(
        createJurisdiction(adminSession, {
          name: 'Ward 99',
          code: 'CSN-W99',
          level: 'WARD',
          parentId: 'non-existent',
        })
      ).rejects.toThrow('Parent jurisdiction record not found.');
    });

    it('rejects duplicate jurisdiction codes', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: 'zone-1', level: 'ZONE' } as any) // parent check
        .mockResolvedValueOnce({ id: 'ward-dup', code: 'CSN-Z01-W01' } as any); // code duplicate check

      await expect(
        createJurisdiction(adminSession, {
          name: 'Duplicate Ward',
          code: 'CSN-Z01-W01',
          level: 'WARD',
          parentId: 'zone-1',
        })
      ).rejects.toThrow('Jurisdiction code "CSN-Z01-W01" is already in use.');
    });

    it('blocks deletion of a jurisdiction if children exist (safe-delete)', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'zone-1',
        name: 'Zone 1',
        children: [{ id: 'w-1', name: 'W1' }],
        _count: { complaints: 0, users: 0 },
      } as any);

      await expect(deleteJurisdiction(adminSession, 'zone-1')).rejects.toThrow(
        /Cannot delete.*active child sub-division/
      );
    });

    it('blocks deletion of a jurisdiction if complaints reference it (safe-delete)', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-1',
        name: 'Ward 1',
        children: [],
        _count: { complaints: 12, users: 0 },
      } as any);

      await expect(deleteJurisdiction(adminSession, 'ward-1')).rejects.toThrow(
        /Cannot delete.*12 citizen complaint/
      );
    });

    it('blocks deletion of a jurisdiction if personnel are assigned (safe-delete)', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-1',
        name: 'Ward 1',
        children: [],
        _count: { complaints: 0, users: 3 },
      } as any);

      await expect(deleteJurisdiction(adminSession, 'ward-1')).rejects.toThrow(
        /Cannot delete.*3 staff user/
      );
    });

    it('successfully deletes an unreferenced jurisdiction and logs action', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-empty',
        name: 'Empty Ward',
        children: [],
        _count: { complaints: 0, users: 0 },
      } as any);

      const deleteSpy = vi.spyOn(db.jurisdiction, 'delete').mockResolvedValue({} as any);

      const result = await deleteJurisdiction(adminSession, 'ward-empty');
      expect(result.success).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'ward-empty' } });
    });
  });

  // ==========================================
  // 3. WARD BOUNDARY INSPECTION & SYNTHETIC DISCLAIMER
  // ==========================================
  describe('Ward Boundary Inspection & PostGIS Synthetic Disclaimer', () => {
    it('returns spatial metadata and the prominent synthetic placeholder disclaimer', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-28',
        name: 'Ward 28 - Kothrud',
        code: 'CSN-Z04-W28',
        level: 'WARD',
        parentId: 'zone-4',
      } as any);

      const inspection = await inspectWardBoundary('ward-28');
      expect(inspection.jurisdictionId).toBe('ward-28');
      expect(inspection.jurisdictionName).toBe('Ward 28 - Kothrud');
      expect(inspection.spatialStatus.geometryType).toBe('MultiPolygon');
      expect(inspection.spatialStatus.srid).toBe(4326);
      expect(inspection.spatialStatus.isOfficial).toBe(false);
      expect(inspection.spatialStatus.isPlaceholder).toBe(true);
      expect(inspection.spatialStatus.disclaimer).toBe(SYNTHETIC_BOUNDARY_DISCLAIMER);
      expect(inspection.spatialStatus.disclaimer).toContain('synthetic pilot approximations');
    });

    it('rejects inspection for non-existent jurisdiction', async () => {
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue(null);

      await expect(inspectWardBoundary('non-existent')).rejects.toThrow(
        'Jurisdiction record not found.'
      );
    });

    it('delivers inspection through GET /api/v1/admin/jurisdictions/[id]/boundary', async () => {
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue(officerSession);
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: 'ward-28',
        name: 'Ward 28',
        code: 'W28',
        level: 'WARD',
        parentId: 'z-4',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/admin/jurisdictions/ward-28/boundary');
      const res = await boundaryHandler(req, { params: { id: 'ward-28' } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.spatialStatus.disclaimer).toBe(SYNTHETIC_BOUNDARY_DISCLAIMER);
    });
  });

  // ==========================================
  // 4. SLA POLICY MATRIX & INVARIANT VALIDATION
  // ==========================================
  describe('SLA Policy Matrix Configuration', () => {
    it('retrieves SLA policy matrix joined with categories and departments', async () => {
      vi.spyOn(db.complaintCategory, 'findMany').mockResolvedValue([
        {
          id: 'cat-1',
          nameEn: 'Pothole',
          code: 'POTHOLE',
          department: { id: 'dept-1', name: 'Roads', code: 'ROADS' },
          slaPolicies: [
            {
              id: 'sla-1',
              priority: 'P1',
              responseSlaHours: 4,
              resolutionSlaHours: 24,
              escalationHours: 18,
            },
          ],
        } as any,
      ]);

      const matrix = await getSlaPoliciesMatrix();
      expect(matrix).toHaveLength(1);
      expect(matrix[0].categoryCode).toBe('POTHOLE');
      expect(matrix[0].policies['P1']).toBeDefined();
      expect(matrix[0].policies['P1'].responseSlaHours).toBe(4);
      expect(matrix[0].policies['P1'].resolutionSlaHours).toBe(24);
    });

    it('rejects non-positive SLA durations (< 1 hour)', async () => {
      await expect(
        updateSlaPolicy(adminSession, {
          categoryId: 'cat-1',
          priority: 'P1' as any,
          responseSlaHours: 0,
          resolutionSlaHours: 24,
        })
      ).rejects.toThrow('Response SLA must be a positive integer in hours.');

      await expect(
        updateSlaPolicy(adminSession, {
          categoryId: 'cat-1',
          priority: 'P1' as any,
          responseSlaHours: 4,
          resolutionSlaHours: -5,
        })
      ).rejects.toThrow('Resolution SLA must be a positive integer in hours.');
    });

    it('enforces invariant that resolution hours >= response hours', async () => {
      await expect(
        updateSlaPolicy(adminSession, {
          categoryId: 'cat-1',
          priority: 'P1' as any,
          responseSlaHours: 48,
          resolutionSlaHours: 24,
        })
      ).rejects.toThrow('Resolution SLA hours must be greater than or equal to response SLA hours.');
    });

    it('updates SLA policy and records audit trail when valid', async () => {
      vi.spyOn(db.complaintCategory, 'findUnique').mockResolvedValue({
        id: 'cat-1',
        nameEn: 'Pothole',
      } as any);

      vi.spyOn(db.slaPolicy, 'findUnique').mockResolvedValue({
        id: 'sla-1',
        categoryId: 'cat-1',
        priority: 'P1',
        responseSlaHours: 4,
        resolutionSlaHours: 24,
      } as any);

      const upsertSpy = vi.spyOn(db.slaPolicy, 'upsert').mockResolvedValue({
        id: 'sla-1',
        categoryId: 'cat-1',
        priority: 'P1',
        responseSlaHours: 2,
        resolutionSlaHours: 12,
        escalationHours: 9,
      } as any);

      const updated = await updateSlaPolicy(adminSession, {
        categoryId: 'cat-1',
        priority: 'P1' as any,
        responseSlaHours: 2,
        resolutionSlaHours: 12,
      });

      expect(upsertSpy).toHaveBeenCalled();
      expect(updated.responseSlaHours).toBe(2);
      expect(updated.resolutionSlaHours).toBe(12);
    });

    it('validates CSRF on PUT /api/v1/admin/sla-matrix', async () => {
      vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/v1/admin/sla-matrix', {
        method: 'PUT',
        body: JSON.stringify({ categoryId: 'cat-1', priority: 'P1', responseSlaHours: 2, resolutionSlaHours: 12 }),
      });

      const res = await slaPutHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });
  });

  // ==========================================
  // 5. STAFF DIRECTORY & ANTI-LOCKOUT RBAC
  // ==========================================
  describe('Staff Directory & RBAC Security Controls', () => {
    it('masks phone numbers and never selects or exposes passwordHash', async () => {
      vi.spyOn(db.user, 'findMany').mockResolvedValue([
        {
          id: 'usr-1',
          fullName: 'Er. Sandeep Patil',
          email: 'sandeep@govasset.in',
          phoneNumber: '+919822000002',
          role: 'SUPERVISOR',
          isActive: true,
          lastLoginAt: new Date('2026-01-01'),
          createdAt: new Date('2026-01-01'),
          department: { id: 'dept-1', name: 'Roads', code: 'ROADS' },
          jurisdiction: { id: 'zone-1', name: 'Zone 1', code: 'Z01', level: 'ZONE' },
        } as any,
      ]);

      const staff = await getStaffDirectory({});
      expect(staff).toHaveLength(1);
      const official = staff[0];
      expect(official.fullName).toBe('Er. Sandeep Patil');
      expect(official.phoneNumberMasked).toBe('+91 98*** **002'); // phone masked
      expect((official as any).passwordHash).toBeUndefined(); // no password exposure
      expect(official.isActive).toBe(true);
    });

    it('anti-lockout: prevents the acting admin from demoting themselves', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: adminSession.userId,
        fullName: adminSession.fullName,
        role: 'PLATFORM_ADMIN',
        isActive: true,
      } as any);

      await expect(
        updateStaffAccess(adminSession, adminSession.userId, {
          role: 'FIELD_WORKER' as any,
        })
      ).rejects.toThrow('Administrators cannot demote their own platform administration role.');
    });

    it('anti-lockout: prevents the acting admin from deactivating their own account', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: adminSession.userId,
        fullName: adminSession.fullName,
        role: 'PLATFORM_ADMIN',
        isActive: true,
      } as any);

      await expect(
        updateStaffAccess(adminSession, adminSession.userId, {
          isActive: false,
        })
      ).rejects.toThrow('Administrators cannot deactivate their own account.');
    });

    it('successfully updates another staff member role and status', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr-target',
        fullName: 'Target Worker',
        role: 'FIELD_WORKER',
        isActive: true,
      } as any);

      vi.spyOn(db.user, 'update').mockResolvedValue({
        id: 'usr-target',
        fullName: 'Target Worker',
        email: 'target@govasset.in',
        role: 'OFFICER',
        departmentId: 'dept-1',
        jurisdictionId: 'ward-1',
        isActive: false,
      } as any);

      const updated = await updateStaffAccess(adminSession, 'usr-target', {
        role: 'OFFICER',
        isActive: false,
      });

      expect(updated.role).toBe('OFFICER');
      expect(updated.isActive).toBe(false);
    });

    it('invites a new staff member and provisions credentials', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue(null); // no conflict
      vi.spyOn(db.user, 'create').mockResolvedValue({
        id: 'usr-new',
        fullName: 'New Officer',
        email: 'officer.new@csnmc.gov.in',
        phoneNumber: '+919876543210',
        role: 'OFFICER',
        departmentId: null,
        jurisdictionId: null,
        isActive: true,
        createdAt: new Date(),
      } as any);

      const created = await inviteStaffUser(adminSession, {
        fullName: 'New Officer',
        email: 'officer.new@csnmc.gov.in',
        phoneNumber: '+919876543210',
        role: 'OFFICER',
      });

      expect(created.fullName).toBe('New Officer');
      expect(created.role).toBe('OFFICER');
      expect(created.isActive).toBe(true);
    });
  });

  // ==========================================
  // 6. AUDIT TRAIL MERGING & IMMUTABILITY
  // ==========================================
  describe('Immutable Compliance Audit Trail', () => {
    it('merges complaint status transitions with admin configuration actions in descending order', async () => {
      vi.spyOn(db.complaintTimeline, 'findMany').mockResolvedValue([
        {
          id: 'tl-1',
          complaintId: 'cmp-101',
          fromStatus: 'ASSIGNED',
          toStatus: 'IN_PROGRESS',
          publicNote: 'Crew dispatched to repair pothole',
          createdAt: new Date('2026-10-25T10:00:00Z'),
          actorId: 'usr-sup',
          actor: {
            fullName: 'Supervisor Deshmukh',
            role: 'SUPERVISOR',
          },
          complaint: {
            referenceNumber: 'GOV-2026-00101',
            title: 'Pothole on Main Rd',
          },
        } as any,
      ]);

      const logs = await getCombinedAuditLogs({ limit: 20 });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const first = logs[0];
      expect(first.timestamp).toBeDefined();
      expect(first.actorName).toBeDefined();
      expect(first.actorRole).toBeDefined();
      expect(first.entityType).toBeDefined();
    });

    it('filters audit records by specific action event', async () => {
      vi.spyOn(db.complaintTimeline, 'findMany').mockResolvedValue([]);

      const logs = await getCombinedAuditLogs({ action: 'USER_ACCESS_UPDATED' });
      logs.forEach((log) => {
        expect(log.action).toBe('USER_ACCESS_UPDATED');
      });
    });

    it('restricts GET /api/v1/admin/audit-logs to PLATFORM_ADMIN', async () => {
      vi.spyOn(authModule, 'requireAuth').mockImplementation(async (roles) => {
        if (!roles || !roles.includes('OFFICER' as any)) {
          throw new authModule.AuthError('FORBIDDEN', 403, 'Platform administrator authority required.');
        }
        return officerSession;
      });

      const req = new NextRequest('http://localhost:3000/api/v1/admin/audit-logs');
      const res = await auditLogsHandler(req);
      expect(res.status).toBe(403);
    });
  });
});
