import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import {
  createCorporation,
  createJurisdiction,
  createWard,
  importWards,
  inviteStaffMember,
  AdminServiceError,
} from '@/server/admin-service';
import {
  canAccessCorporation,
  canAccessJurisdiction,
  getCorporationIdForJurisdiction,
} from '@/server/auth';
import {
  requestPhoneOtp,
  verifyPhoneOtp,
} from '@/server/otp-service';
import {
  assignComplaint,
  updateFieldTask,
  verifyComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { getDefaultRedirectForRole } from '@/lib/rbac';

describe('Multi-Corporation Governance, Staff Onboarding & End-to-End Work Assignment', () => {
  // Test Actor Sessions
  const platformAdminSession: UserSession = {
    userId: '11111111-1111-1111-1111-111111110001',
    email: 'admin.platform@govasset.in',
    phoneNumber: '+919822010001',
    fullName: 'Platform SuperAdmin',
    role: 'PLATFORM_ADMIN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcCorpId = '11111111-1111-1111-1111-111111110002'; // CSMC Corporation
  const csmcZoneId = '22222222-2222-2222-2222-222222220001'; // CSMC Zone 1
  const csmcWardId = '33333333-3333-3333-3333-333333330001'; // CSMC Ward 1 (Town Hall)

  const pmcCorpId = '11111111-1111-1111-1111-111111110003'; // PMC Corporation
  const pmcZoneId = '22222222-2222-2222-2222-222222220020'; // PMC Zone Kothrud
  const pmcWardId = '33333333-3333-3333-3333-333333330028'; // PMC Ward 28

  const roadDeptId = '44444444-4444-4444-4444-444444440001';

  const csmcOfficerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660020',
    email: 'officer.csmc@govasset.in',
    phoneNumber: '+919822010020',
    fullName: 'Sachin Waghmare (CSMC Officer)',
    role: 'OFFICER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660022',
    email: 'worker.csmc@govasset.in',
    phoneNumber: '+919822010022',
    fullName: 'Ganesh Shinde (CSMC Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const pmcWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660006',
    email: 'worker.pmc@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh (PMC Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: pmcWardId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcSupervisorSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660021',
    email: 'supervisor.csmc@govasset.in',
    phoneNumber: '+919822010021',
    fullName: 'Pooja Gaikwad (CSMC Supervisor)',
    role: 'SUPERVISOR',
    departmentId: roadDeptId,
    jurisdictionId: csmcZoneId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. MULTI-CORPORATION ONBOARDING & SETUP
  // ===========================================================================
  describe('1. Multi-Corporation Setup & Ward Ingestion', () => {
    it('allows platform admin to register a new municipal corporation', async () => {
      const mockCreated = {
        id: '11111111-1111-1111-1111-111111110004',
        name: 'Nashik Municipal Corporation',
        code: 'NMC-01',
        level: 'DISTRICT_CORP',
        parentId: null,
        state: 'Maharashtra',
        district: 'Nashik',
        city: 'Nashik',
        contactEmail: 'commissioner@nmc.gov.in',
        contactPhone: '+912532575631',
        logoUrl: '/logos/nmc.png',
        isActive: true,
      };

      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue(null);
      vi.spyOn(db.jurisdiction, 'create').mockResolvedValue(mockCreated as any);

      const result = await createCorporation(platformAdminSession, {
        name: 'Nashik Municipal Corporation',
        code: 'NMC-01',
        state: 'Maharashtra',
        district: 'Nashik',
        city: 'Nashik',
        contactEmail: 'commissioner@nmc.gov.in',
        contactPhone: '+912532575631',
        logoUrl: '/logos/nmc.png',
      });

      expect(result.id).toBe(mockCreated.id);
      expect(result.code).toBe('NMC-01');
      expect(result.level).toBe('DISTRICT_CORP');
    });

    it('rejects registering corporation with invalid inputs or duplicate code', async () => {
      // Short name
      await expect(
        createCorporation(platformAdminSession, {
          name: 'N',
          code: 'NMC-01',
          state: 'Maharashtra',
        })
      ).rejects.toThrowError(AdminServiceError);

      // Short code
      await expect(
        createCorporation(platformAdminSession, {
          name: 'Nashik Municipal Corporation',
          code: 'N',
          state: 'Maharashtra',
        })
      ).rejects.toThrowError(AdminServiceError);

      // Duplicate code
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({ id: 'existing' } as any);
      await expect(
        createCorporation(platformAdminSession, {
          name: 'Nashik Municipal Corporation',
          code: 'NMC-01',
          state: 'Maharashtra',
        })
      ).rejects.toThrowError(AdminServiceError);
    });

    it('imports wards via CSV batch format', async () => {
      const mockZone = {
        id: csmcZoneId,
        name: 'Zone 1 - Town Hall',
        code: 'CSMC-Z01',
        level: 'ZONE',
        parentId: csmcCorpId,
      };
      const mockCorp = {
        id: csmcCorpId,
        name: 'Chhatrapati Sambhajinagar Municipal Corporation',
        code: 'CSMC-01',
        level: 'DISTRICT_CORP',
        children: [mockZone],
      };

      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce(mockCorp as any) // corp lookup
        .mockResolvedValueOnce(null) // code check row 1
        .mockResolvedValueOnce(null); // code check row 2

      vi.spyOn(db.jurisdiction, 'create').mockImplementation((args: any) => {
        return Promise.resolve({ id: 'ward-csv-id', ...args.data }) as any;
      });

      const csvContent = `name,code,zoneCode\nWard 11 - Shahgunj,CSMC-Z01-W11,CSMC-Z01\nWard 12 - Gulmandi,CSMC-Z01-W12,CSMC-Z01`;
      const result = await importWards(platformAdminSession, csmcCorpId, {
        format: 'CSV',
        data: csvContent,
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('imports wards via GeoJSON FeatureCollection format', async () => {
      const mockZone = {
        id: csmcZoneId,
        name: 'Zone 1 - Town Hall',
        code: 'CSMC-Z01',
        level: 'ZONE',
        parentId: csmcCorpId,
      };
      const mockCorp = {
        id: csmcCorpId,
        name: 'Chhatrapati Sambhajinagar Municipal Corporation',
        code: 'CSMC-01',
        level: 'DISTRICT_CORP',
        children: [mockZone],
      };

      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce(mockCorp as any)
        .mockResolvedValueOnce(null);

      vi.spyOn(db.jurisdiction, 'create').mockImplementation((args: any) => {
        return Promise.resolve({ id: 'ward-geojson-id', ...args.data }) as any;
      });

      const geojsonContent = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'Ward 13 - Kirana Chavdi',
              code: 'CSMC-Z01-W13',
              zoneCode: 'CSMC-Z01',
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [75.32, 19.88],
                  [75.33, 19.88],
                  [75.33, 19.89],
                  [75.32, 19.89],
                  [75.32, 19.88],
                ],
              ],
            },
          },
        ],
      });

      const result = await importWards(platformAdminSession, csmcCorpId, {
        format: 'GEOJSON',
        data: geojsonContent,
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('rejects batch import with invalid or duplicate ward codes', async () => {
      const mockZone = {
        id: csmcZoneId,
        name: 'Zone 1',
        code: 'CSMC-Z01',
        level: 'ZONE',
      };
      const mockCorp = {
        id: csmcCorpId,
        name: 'CSMC',
        code: 'CSMC-01',
        level: 'DISTRICT_CORP',
        children: [mockZone],
      };

      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce(mockCorp as any)
        .mockResolvedValueOnce({ id: 'existing-w01', code: 'CSMC-Z01-W01' } as any); // Duplicate!

      const csvContent = `name,code,zoneCode\nDuplicate Ward,CSMC-Z01-W01,CSMC-Z01`;
      const result = await importWards(platformAdminSession, csmcCorpId, {
        format: 'CSV',
        data: csvContent,
      });

      expect(result.importedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/already exists/i);
    });
  });

  // ===========================================================================
  // 2. SERVER-SIDE TENANT & JURISDICTION ISOLATION
  // ===========================================================================
  describe('2. Multi-Corporation Scoping & Tenant Isolation', () => {
    it('resolves the root municipal corporation ID accurately from ward or zone', async () => {
      // Mock hierarchy: Ward -> Zone -> Corp
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      const resolvedCorpId = await getCorporationIdForJurisdiction(csmcWardId);
      expect(resolvedCorpId).toBe(csmcCorpId);
    });

    it('strictly isolates access between municipal corporations', async () => {
      // CSMC Officer accessing CSMC
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      const canAccessOwnCorp = await canAccessCorporation(csmcOfficerSession, csmcCorpId);
      expect(canAccessOwnCorp).toBe(true);

      // CSMC Officer attempting to access PMC
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      const canAccessForeignCorp = await canAccessCorporation(csmcOfficerSession, pmcCorpId);
      expect(canAccessForeignCorp).toBe(false);
    });

    it('strictly denies officer from accessing a ward in a different corporation', async () => {
      // Officer is restricted strictly to their assigned ward
      const canAccess = await canAccessJurisdiction(csmcOfficerSession, pmcWardId);
      expect(canAccess).toBe(false);
    });
  });

  // ===========================================================================
  // 3. STAFF ONBOARDING & FIELD WORKER PROFILE MANAGEMENT
  // ===========================================================================
  describe('3. Staff Onboarding with Staff Code, Designation & Skills', () => {
    it('onboards a new field worker with complete professional metadata', async () => {
      vi.spyOn(db.user, 'findFirst').mockResolvedValue(null); // No email/phone collision
      vi.spyOn(db.department, 'findUnique').mockResolvedValue({ id: roadDeptId, name: 'Roads' } as any);
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({ id: csmcWardId, name: 'Ward 1' } as any);

      const mockWorker = {
        id: 'new-worker-id',
        fullName: 'Ramesh Sonawane',
        email: 'ramesh.sonawane@csmc.gov.in',
        phoneNumber: '+919822010099',
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        staffCode: 'CSMC-FW-042',
        designation: 'Senior Asphalt Paving Technician',
        skills: 'Asphalt Compaction, Heavy Excavator, Pothole Patching',
        isActive: true,
        createdAt: new Date(),
      };

      vi.spyOn(db.user, 'create').mockResolvedValue(mockWorker as any);

      const created = await inviteStaffMember(platformAdminSession, {
        fullName: 'Ramesh Sonawane',
        email: 'ramesh.sonawane@csmc.gov.in',
        phoneNumber: '+919822010099',
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        staffCode: 'CSMC-FW-042',
        designation: 'Senior Asphalt Paving Technician',
        skills: 'Asphalt Compaction, Heavy Excavator, Pothole Patching',
      });

      expect(created.id).toBe('new-worker-id');
      expect(created.staffCode).toBe('CSMC-FW-042');
      expect(created.designation).toBe('Senior Asphalt Paving Technician');
      expect(created.skills).toContain('Asphalt Compaction');
      expect(created.phoneNumberMasked).toBe('+91 98*** **099');
    });

    it('rejects duplicate staff code across corporation users', async () => {
      vi.spyOn(db.user, 'findFirst')
        .mockResolvedValueOnce(null) // phone/email ok
        .mockResolvedValueOnce({ id: 'existing-worker', staffCode: 'CSMC-FW-001' } as any); // staff code duplicate

      vi.spyOn(db.department, 'findUnique').mockResolvedValue({ id: roadDeptId } as any);
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({ id: csmcWardId } as any);

      await expect(
        inviteStaffMember(platformAdminSession, {
          fullName: 'Ajay Kadam',
          email: 'ajay.kadam@csmc.gov.in',
          phoneNumber: '+919822010098',
          role: 'FIELD_WORKER',
          departmentId: roadDeptId,
          jurisdictionId: csmcWardId,
          staffCode: 'CSMC-FW-001',
        })
      ).rejects.toThrowError(AdminServiceError);
    });
  });

  // ===========================================================================
  // 4. OTP AUTHENTICATION & ROLE-BASED REDIRECTION
  // ===========================================================================
  describe('4. OTP Engine & Role-Based Navigation Routing', () => {
    it('determines the correct landing page for each system role', () => {
      expect(getDefaultRedirectForRole('PLATFORM_ADMIN')).toBe('/admin');
      expect(getDefaultRedirectForRole('OFFICER')).toBe('/ops/triage');
      expect(getDefaultRedirectForRole('SUPERVISOR')).toBe('/ops/verifications');
      expect(getDefaultRedirectForRole('DEPT_ADMIN')).toBe('/ops/triage');
      expect(getDefaultRedirectForRole('FIELD_WORKER')).toBe('/ops/field');
      expect(getDefaultRedirectForRole('CITIZEN')).toBe('/my-complaints');
      expect(getDefaultRedirectForRole('UNKNOWN_ROLE')).toBe('/');
    });

    it('requests OTP and enforces 60-second resend cooldown', async () => {
      const testPhone = '+919822010088';
      const req1 = await requestPhoneOtp(testPhone);
      expect(req1.success).toBe(true);

      // Immediate second request within 60s cooldown
      const req2 = await requestPhoneOtp(testPhone);
      expect(req2.success).toBe(false);
      expect(req2.error).toMatch(/wait \d+s|cooldown/i);
      expect(req2.cooldownRemainingSeconds).toBeGreaterThan(0);
    });

    it('invalidates OTP challenge after 3 incorrect verification attempts', async () => {
      const testPhone = '+919822010077';
      const req = await requestPhoneOtp(testPhone);
      expect(req.success).toBe(true);

      // Attempt 1: wrong
      const res1 = await verifyPhoneOtp(testPhone, '000000');
      expect(res1.success).toBe(false);

      // Attempt 2: wrong
      const res2 = await verifyPhoneOtp(testPhone, '111111');
      expect(res2.success).toBe(false);

      // Attempt 3: wrong
      const res3 = await verifyPhoneOtp(testPhone, '222222');
      expect(res3.success).toBe(false);

      // Attempt 4: challenge locked out
      const res4 = await verifyPhoneOtp(testPhone, '333333');
      expect(res4.success).toBe(false);
      expect(res4.error).toMatch(/no active|maximum.*exceeded|expired|invalid/i);
    });

    it('verifies valid OTP, issues session token, and enforces single-use invariant', async () => {
      const testPhone = '+919822010066';
      const req = await requestPhoneOtp(testPhone);
      expect(req.success).toBe(true);

      // In dev/test, mockOtpNotice contains the code
      const match = req.mockOtpNotice?.match(/(\d{6})/);
      expect(match).toBeTruthy();
      const code = match![1];

      // Mock user in database
      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: 'user-citizen-otp',
        phoneNumber: testPhone,
        fullName: 'Citizen Santosh',
        role: 'CITIZEN',
        isActive: true,
      } as any);

      // First verification: success
      const ver1 = await verifyPhoneOtp(testPhone, code);
      expect(ver1.success).toBe(true);
      expect(ver1.sessionToken).toBeTruthy();
      expect(ver1.user?.role).toBe('CITIZEN');

      // Second verification with identical code: single-use rejection
      const ver2 = await verifyPhoneOtp(testPhone, code);
      expect(ver2.success).toBe(false);
      expect(ver2.error).toMatch(/no active|invalid|expired|used/i);
    });
  });

  // ===========================================================================
  // 5. WORK ASSIGNMENT & CROSS-CORPORATION SAFETY
  // ===========================================================================
  describe('5. Work Assignment Boundary Enforcement & Life Cycle Execution', () => {
    const mockComplaint = {
      id: 'c-csmc-pothole-01',
      referenceNumber: 'GOV-2026-00482',
      title: 'Pothole near Town Hall Chowk',
      status: 'SUBMITTED',
      jurisdictionId: csmcWardId,
      departmentId: roadDeptId,
      citizenPhone: '+919822010008',
      version: 1,
      assignments: [],
    };

    it('assigns complaint to an active field worker in the same corporation', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: csmcWorkerSession.userId,
        fullName: csmcWorkerSession.fullName,
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        isActive: true,
      } as any);

      // Both belong to CSMC
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any)
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaintAssignment: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            create: vi.fn().mockResolvedValue({ id: 'asgn-new' }),
          },
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...mockComplaint, status: 'ASSIGNED', version: 2 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const updated = await assignComplaint({
        complaintId: mockComplaint.id,
        officerSession: csmcOfficerSession,
        assignedWorkerId: csmcWorkerSession.userId,
        targetCompletionAt: new Date(Date.now() + 86400000),
      });

      expect(updated.complaint.status).toBe('ASSIGNED');
      expect(updated.assignment).toBeDefined();
    });

    it('strictly rejects assigning complaint to a field worker from a different corporation (CORPORATION_MISMATCH 400)', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: pmcWorkerSession.userId,
        fullName: pmcWorkerSession.fullName,
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: pmcWardId, // PMC Ward vs CSMC Complaint
        isActive: true,
      } as any);

      // CSMC Complaint resolves to CSMC
      // PMC Worker resolves to PMC
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any)
        .mockResolvedValueOnce({ id: pmcWardId, level: 'WARD', parentId: pmcZoneId } as any)
        .mockResolvedValueOnce({ id: pmcZoneId, level: 'ZONE', parentId: pmcCorpId } as any)
        .mockResolvedValueOnce({ id: pmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      await expect(
        assignComplaint({
          complaintId: mockComplaint.id,
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

    it('rejects assigning complaint to an inactive/deactivated field worker', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'deactivated-worker-id',
        fullName: 'Terminated Worker',
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        isActive: false, // Inactive!
      } as any);

      await expect(
        assignComplaint({
          complaintId: mockComplaint.id,
          officerSession: csmcOfficerSession,
          assignedWorkerId: 'deactivated-worker-id',
          targetCompletionAt: new Date(Date.now() + 86400000),
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'WORKER_NOT_FOUND',
        statusCode: 400,
      });
    });

    it('field worker executes task: transitions ASSIGNED -> IN_PROGRESS -> WORK_COMPLETED with proof', async () => {
      const assignedComplaint = {
        ...mockComplaint,
        status: 'ASSIGNED',
        assignments: [
          {
            id: 'asgn-01',
            assignedWorkerId: csmcWorkerSession.userId,
            isActive: true,
          },
        ],
      };

      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(assignedComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: csmcWorkerSession.userId,
        isActive: true,
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...assignedComplaint, status: 'IN_PROGRESS', version: 2 }),
          },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      // 1. Worker begins work
      const inProgress = await updateFieldTask({
        complaintId: assignedComplaint.id,
        workerSession: csmcWorkerSession,
        action: 'START_WORK',
      });
      expect(inProgress.status).toBe('IN_PROGRESS');

      // 2. Worker completes work with photo proof
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
        ...assignedComplaint,
        status: 'IN_PROGRESS',
        version: 2,
      } as any);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue({
        metadata: { latitude: 19.8946, longitude: 75.2995 },
      } as any);

      let createdEvidence: any = null;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...assignedComplaint, status: 'WORK_COMPLETED', version: 3 }),
          },
          complaintEvidence: {
            create: vi.fn().mockImplementation((args: any) => {
              createdEvidence = args.data;
              return { id: 'ev-csmc-after', ...args.data };
            }),
          },
          complaintAssignment: { update: vi.fn().mockResolvedValue({}) },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const completed = await updateFieldTask({
        complaintId: assignedComplaint.id,
        workerSession: csmcWorkerSession,
        action: 'COMPLETE_WORK',
        workerNotes: 'Filled pothole with dense bituminous macadam and compacted.',
        evidenceFileKey: 'evidence/csmc_pothole_repaired.webp',
        workerLatitude: 19.8947,
        workerLongitude: 75.2996,
        gpsAccuracyMeters: 4.5,
      });

      expect(completed.status).toBe('WORK_COMPLETED');
      expect(createdEvidence).toBeTruthy();
      expect(createdEvidence.stage).toBe('AFTER_REPAIR');
    });

    it('allows officer to reassign a task currently IN_PROGRESS while maintaining history', async () => {
      const inProgressComplaint = {
        ...mockComplaint,
        status: 'IN_PROGRESS',
        version: 2,
      };

      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(inProgressComplaint as any);
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: csmcWorkerSession.userId,
        fullName: csmcWorkerSession.fullName,
        role: 'FIELD_WORKER',
        departmentId: roadDeptId,
        jurisdictionId: csmcWardId,
        isActive: true,
      } as any);

      // Multi-corp match
      vi.spyOn(db.jurisdiction, 'findUnique')
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any)
        .mockResolvedValueOnce({ id: csmcWardId, level: 'WARD', parentId: csmcZoneId } as any)
        .mockResolvedValueOnce({ id: csmcZoneId, level: 'ZONE', parentId: csmcCorpId } as any)
        .mockResolvedValueOnce({ id: csmcCorpId, level: 'DISTRICT_CORP', parentId: null } as any);

      let deactivatedOldCount = 0;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaintAssignment: {
            updateMany: vi.fn().mockImplementation((args: any) => {
              deactivatedOldCount = 1;
              return { count: 1 };
            }),
            create: vi.fn().mockResolvedValue({ id: 'asgn-reassigned' }),
          },
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...inProgressComplaint, status: 'ASSIGNED', version: 3 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const reassigned = await assignComplaint({
        complaintId: inProgressComplaint.id,
        officerSession: csmcOfficerSession,
        assignedWorkerId: csmcWorkerSession.userId,
        targetCompletionAt: new Date(Date.now() + 86400000),
      });

      expect(reassigned.complaint.status).toBe('ASSIGNED');
      expect(deactivatedOldCount).toBe(1);
    });

    it('allows supervisor quality verification: approve (VERIFIED_RESOLVED) and rework rejection', async () => {
      const completedComplaint = {
        ...mockComplaint,
        status: 'WORK_COMPLETED',
        version: 3,
      };

      // 1. Quality Approval
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(completedComplaint as any);
      vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
        id: csmcWardId,
        parentId: csmcZoneId, // Ward belongs to supervisor's zone
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...completedComplaint, status: 'VERIFIED_RESOLVED', version: 4 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const approved = await verifyComplaint({
        complaintId: completedComplaint.id,
        supervisorSession: csmcSupervisorSession,
        action: 'APPROVE',
        notes: 'Site visited. Surface compaction is flush with road grade.',
      });

      expect(approved.status).toBe('VERIFIED_RESOLVED');

      // 2. Quality Rejection with mandatory rework notes
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(completedComplaint as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          complaint: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({ ...completedComplaint, status: 'ASSIGNED', version: 4 }),
          },
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const rejected = await verifyComplaint({
        complaintId: completedComplaint.id,
        supervisorSession: csmcSupervisorSession,
        action: 'REJECT',
        rejectionReason: 'Edge sealing incomplete. Needs rework along southern asphalt seam.',
      });

      expect(rejected.status).toBe('IN_PROGRESS');
    });
  });
});
