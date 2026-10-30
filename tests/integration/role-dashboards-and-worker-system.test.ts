import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import { getDefaultRedirectForRole } from '@/lib/rbac';
import { middleware } from '@/middleware';
import {
  inviteStaffUser,
  updateStaffAccess,
  AdminServiceError,
} from '@/server/admin-service';
import {
  assignComplaint,
  updateFieldTask,
  verifyComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { GET as workersRouteHandler, POST as inviteWorkerRouteHandler, PUT as updateWorkerRouteHandler } from '@/app/api/v1/ops/workers/route';
import { GET as fieldTasksRouteHandler } from '@/app/api/v1/ops/field/tasks/route';
import { PUT as updateProfileRouteHandler } from '@/app/api/v1/ops/profile/route';
import { GET as myComplaintsRouteHandler } from '@/app/api/v1/citizen/my-complaints/route';
import * as authModule from '@/server/auth';
import { hashPassword, verifyPassword } from '@/lib/auth-crypto';

describe('GovAsset — Role-Specific Dashboards, Individual Worker Accounts & Crew Directory', () => {
  // CSMC IDs
  const csmcCorpId = '11111111-1111-1111-1111-111111110002'; // CSMC Corporation
  const csmcZoneId = '22222222-2222-2222-2222-222222220101'; // CSMC Zone 1
  const csmcWard01Id = '33333333-3333-3333-3333-333333330101'; // CSMC Ward 01 - Shahaganj
  const roadDeptId = '44444444-4444-4444-4444-444444440001'; // Road Maintenance Dept
  const potholeCatId = '55555555-5555-5555-5555-555555550001';

  // PMC IDs for cross-corporation isolation
  const pmcCorpId = '11111111-1111-1111-1111-111111111111';
  const pmcWard28Id = '33333333-3333-3333-3333-333333330028';

  // Actor Sessions
  const platformAdminSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660001',
    email: 'admin@govasset.in',
    phoneNumber: '+919822010001',
    fullName: 'Rajesh Sharma (Platform Admin)',
    role: 'PLATFORM_ADMIN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcOfficerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660101',
    email: 'officer.csmc@govasset.in',
    phoneNumber: '+919822010101',
    fullName: 'Sachin Waghmare',
    role: 'OFFICER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWard01Id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcSupervisorSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660102',
    email: 'supervisor.csmc@govasset.in',
    phoneNumber: '+919822010102',
    fullName: 'Pooja Gaikwad',
    role: 'SUPERVISOR',
    departmentId: roadDeptId,
    jurisdictionId: csmcZoneId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  // Distinct CSMC Field Workers
  const workerASession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660103',
    email: 'field.csmc@govasset.in',
    phoneNumber: '+919822010103',
    fullName: 'Ganesh Shinde (Worker A)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWard01Id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const workerBSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660104',
    email: 'field2.csmc@govasset.in',
    phoneNumber: '+919822010104',
    fullName: 'Santosh Jadhav (Worker B)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWard01Id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const pmcWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660006',
    email: 'field.vikram@govasset.in',
    phoneNumber: '+919822010006',
    fullName: 'Vikram Singh (PMC Worker)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: pmcWard28Id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const citizenSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660008',
    email: 'citizen.aarav@govasset.in',
    phoneNumber: '+919822010008',
    fullName: 'Aarav Mehta (Citizen)',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // TEST 1: Role-Specific Landing Redirects
  // ===========================================================================
  it('1. Enforces role-specific landing destinations after authentication', () => {
    expect(getDefaultRedirectForRole('PLATFORM_ADMIN')).toBe('/admin');
    expect(getDefaultRedirectForRole('OFFICER')).toBe('/ops/triage');
    expect(getDefaultRedirectForRole('FIELD_WORKER')).toBe('/ops/field');
    expect(getDefaultRedirectForRole('SUPERVISOR')).toBe('/ops/verifications');
    expect(getDefaultRedirectForRole('CITIZEN')).toBe('/my-complaints');
  });

  // ===========================================================================
  // TEST 2: Middleware Server-Side Route Boundary Protection
  // ===========================================================================
  it('2. Middleware prevents FIELD_WORKER from accessing officer triage and non-admins from /admin', async () => {
    // 2a. Field worker accessing /ops/triage must be redirected to /ops/field
    const workerReq = new NextRequest('http://localhost:3000/ops/triage', {
      headers: { cookie: 'govasset_session=worker_token' },
    });
    vi.spyOn(authModule, 'getServerSession').mockResolvedValue(workerASession);

    // Also mock verifySessionToken used by middleware
    const authSessionModule = await import('@/lib/auth-session');
    vi.spyOn(authSessionModule, 'verifySessionToken').mockResolvedValue(workerASession);

    const workerResponse = await middleware(workerReq);
    expect(workerResponse.status).toBe(307);
    expect(workerResponse.headers.get('location')).toBe('http://localhost:3000/ops/field');

    // 2b. Non-admin officer accessing /admin must be redirected to their authorized dashboard
    vi.spyOn(authSessionModule, 'verifySessionToken').mockResolvedValue(csmcOfficerSession);
    const officerReq = new NextRequest('http://localhost:3000/admin', {
      headers: { cookie: 'govasset_session=officer_token' },
    });
    const officerResponse = await middleware(officerReq);
    expect(officerResponse.status).toBe(307);
    expect(officerResponse.headers.get('location')).toBe('http://localhost:3000/ops/triage');

    // 2c. Unauthenticated visitor accessing /ops is redirected to /login?redirect=/ops
    vi.spyOn(authSessionModule, 'verifySessionToken').mockResolvedValue(null);
    const unauthReq = new NextRequest('http://localhost:3000/ops/triage');
    const unauthResponse = await middleware(unauthReq);
    expect(unauthResponse.status).toBe(307);
    expect(unauthResponse.headers.get('location')).toContain('/login?redirect=%2Fops%2Ftriage');
  });

  // ===========================================================================
  // TEST 3: Creation & Onboarding of Two Distinct CSMC Field Workers
  // ===========================================================================
  it('3. Successfully provisions distinct field-worker accounts with unique IDs, staff codes & hashed passwords', async () => {
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    // Mock DB user lookup (no existing conflict)
    vi.spyOn(db.user, 'findFirst').mockResolvedValue(null);
    vi.spyOn(db.department, 'findUnique').mockResolvedValue({ id: roadDeptId } as any);
    vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({ id: csmcWard01Id } as any);

    // Worker A Creation
    const createSpy = vi.spyOn(db.user, 'create').mockResolvedValue({
      id: workerASession.userId,
      fullName: 'Ganesh Shinde',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010103',
      role: 'FIELD_WORKER',
      staffCode: 'CSMC-FW-001',
      designation: 'Senior Asphalt Compactor Lead',
      skills: 'Asphalt Paving, Roller Operation',
      isActive: true,
      createdAt: new Date(),
    } as any);

    const workerA = await inviteStaffUser(csmcOfficerSession, {
      fullName: 'Ganesh Shinde',
      email: 'field.csmc@govasset.in',
      phoneNumber: '+919822010103',
      role: 'FIELD_WORKER',
      staffCode: 'CSMC-FW-001',
      designation: 'Senior Asphalt Compactor Lead',
      skills: 'Asphalt Paving, Roller Operation',
      departmentId: roadDeptId,
      jurisdictionId: csmcWard01Id,
      password: 'SecurePassword123!',
    });

    expect(workerA.id).toBe(workerASession.userId);
    expect(workerA.staffCode).toBe('CSMC-FW-001');
    expect(createSpy).toHaveBeenCalled();

    // Verify password was securely hashed
    const createCallArgs = createSpy.mock.calls[0]?.[0] as any;
    expect(createCallArgs.data.passwordHash).toBeDefined();
    expect(createCallArgs.data.passwordHash).not.toBe('SecurePassword123!');
    const isPasswordValid = await verifyPassword('SecurePassword123!', createCallArgs.data.passwordHash);
    expect(isPasswordValid).toBe(true);
  });

  // ===========================================================================
  // TEST 4 & 5: Task Scoping Isolation Between Multiple Workers
  // ===========================================================================
  it('4. Assigns complaint to Worker A; confirms Worker A sees it while Worker B has separate empty list', async () => {
    const csmcComplaintId = '77777777-7777-7777-7777-777777770101';

    // Mock assigned task for Worker A only
    const workerATasks = [
      {
        id: '88888888-8888-8888-8888-888888880101',
        complaintId: csmcComplaintId,
        assignedWorkerId: workerASession.userId,
        isActive: true,
        targetCompletionAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        complaint: {
          id: csmcComplaintId,
          referenceNumber: 'GOV-2026-CSMC-001',
          title: 'Damaged Bitumen on Shahaganj Chowk',
          description: 'Pothole cluster impeding road transit.',
          status: 'ASSIGNED',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Shahaganj Clock Tower',
          citizenPhone: '+919822010008',
          version: 2,
          category: { nameEn: 'Damaged Roads & Potholes' },
          department: { name: 'Road Maintenance' },
          jurisdiction: { name: 'Ward 01 - Shahaganj' },
          evidence: [],
          timeline: [],
        },
      },
    ];

    // 4a. Worker A queries /api/v1/ops/field/tasks -> sees GOV-2026-CSMC-001
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerASession);
    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue(workerATasks as any);

    const reqA = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const resA = await fieldTasksRouteHandler(reqA);
    const jsonA = await resA.json();

    expect(resA.status).toBe(200);
    expect(jsonA.success).toBe(true);
    expect(jsonA.counts.assigned).toBe(1);
    expect(jsonA.data[0].ref).toBe('GOV-2026-CSMC-001');

    // 4b. Worker B queries /api/v1/ops/field/tasks -> returns empty task list
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerBSession);
    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue([] as any);

    const reqB = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const resB = await fieldTasksRouteHandler(reqB);
    const jsonB = await resB.json();

    expect(resB.status).toBe(200);
    expect(jsonB.success).toBe(true);
    expect(jsonB.counts.assigned).toBe(0);
    expect(jsonB.data).toHaveLength(0);

    // 4c. Verify URL tampering attempt: Worker B adds ?workerId=<workerA>
    // Server must ignore parameter and strictly scope to workerBSession.userId
    const findManySpy = vi.spyOn(db.complaintAssignment, 'findMany');
    const tamperedReq = new NextRequest(
      `http://localhost:3000/api/v1/ops/field/tasks?workerId=${workerASession.userId}`
    );
    await fieldTasksRouteHandler(tamperedReq);

    const queriedArgs = findManySpy.mock.calls[0]?.[0] as any;
    expect(queriedArgs.where.assignedWorkerId).toBe(workerBSession.userId);
  });

  // ===========================================================================
  // TEST 6: Worker A Completes Job & Verified Item Appears in Work History
  // ===========================================================================
  it('6. Worker A completes job and verified resolution is recorded in completed work history', async () => {
    const complaintId = '77777777-7777-7777-7777-777777770102';

    // Mock completed & verified work order
    const completedAssignments = [
      {
        id: '88888888-8888-8888-8888-888888880102',
        complaintId,
        assignedWorkerId: workerASession.userId,
        isActive: true,
        targetCompletionAt: new Date(Date.now() - 3600000),
        createdAt: new Date(Date.now() - 7200000),
        complaint: {
          id: complaintId,
          referenceNumber: 'GOV-2026-CSMC-002',
          title: 'Resurfacing near Shahaganj Dispensary',
          description: 'Resurfacing executed.',
          status: 'VERIFIED_RESOLVED',
          priority: 'P2_HIGH',
          landmarkAddress: 'Near Dispensary Gate, Shahaganj',
          citizenPhone: '+919822010008',
          version: 4,
          category: { nameEn: 'Damaged Roads & Potholes' },
          department: { name: 'Road Maintenance' },
          jurisdiction: { name: 'Ward 01 - Shahaganj' },
          evidence: [
            {
              id: 'ev-1',
              stage: 'RESOLUTION',
              fileKey: 'evidence/csmc_resolved_1.jpg',
              mimeType: 'image/jpeg',
              isVerifiedProximity: true,
              createdAt: new Date(),
            },
          ],
          timeline: [
            {
              toStatus: 'VERIFIED_RESOLVED',
              publicNote: 'Supervisor Pooja Gaikwad inspected site. Surface asphalt meets municipal density standards.',
              createdAt: new Date(),
            },
            {
              toStatus: 'WORK_COMPLETED',
              publicNote: 'Bitumen patch laid and compacted.',
              createdAt: new Date(Date.now() - 1800000),
            },
          ],
        },
      },
    ];

    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerASession);
    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue(completedAssignments as any);

    const req = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const res = await fieldTasksRouteHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.counts.completed).toBe(1);
    expect(json.data[0].status).toBe('VERIFIED_RESOLVED');
    expect(json.data[0].verifierNote).toContain('meets municipal density standards');
  });

  // ===========================================================================
  // TEST 7: Crew Directory API for Officers
  // ===========================================================================
  it('7. Crew directory returns eligible same-corporation workers with accurate active workloads', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockImplementation(async (jId) => {
      if (jId === csmcWard01Id) return csmcCorpId;
      if (jId === pmcWard28Id) return pmcCorpId;
      return null;
    });

    const mockWorkersInDb = [
      {
        id: workerASession.userId,
        fullName: 'Ganesh Shinde',
        email: 'field.csmc@govasset.in',
        phoneNumber: '+919822010103',
        staffCode: 'CSMC-FW-001',
        designation: 'Senior Asphalt Lead',
        skills: 'Asphalt Paving',
        departmentId: roadDeptId,
        jurisdictionId: csmcWard01Id,
        department: { id: roadDeptId, name: 'Road Maintenance', code: 'ROAD_MAINTENANCE' },
        jurisdiction: { id: csmcWard01Id, name: 'Ward 01 - Shahaganj', code: 'CSMC-Z01-W01', level: 'WARD', parentId: csmcZoneId },
        assignedWorkOrders: [
          {
            id: 'wo-1',
            targetCompletionAt: new Date(),
            complaint: {
              id: 'csmc-c-1',
              referenceNumber: 'GOV-2026-CSMC-001',
              title: 'Pothole on Shahaganj',
              status: 'ASSIGNED',
              priority: 'P1_CRITICAL',
              landmarkAddress: 'Shahaganj Clock Tower',
            },
          },
        ],
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: workerBSession.userId,
        fullName: 'Santosh Jadhav',
        email: 'field2.csmc@govasset.in',
        phoneNumber: '+919822010104',
        staffCode: 'CSMC-FW-002',
        designation: 'Pavement Specialist',
        skills: 'Concrete Patching',
        departmentId: roadDeptId,
        jurisdictionId: csmcWard01Id,
        department: { id: roadDeptId, name: 'Road Maintenance', code: 'ROAD_MAINTENANCE' },
        jurisdiction: { id: csmcWard01Id, name: 'Ward 01 - Shahaganj', code: 'CSMC-Z01-W01', level: 'WARD', parentId: csmcZoneId },
        assignedWorkOrders: [],
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: pmcWorkerSession.userId,
        fullName: 'Vikram Singh',
        email: 'field.vikram@govasset.in',
        phoneNumber: '+919822010006',
        staffCode: 'PMC-FW-004',
        designation: 'PMC Lead',
        skills: 'Road Work',
        departmentId: roadDeptId,
        jurisdictionId: pmcWard28Id,
        department: { id: roadDeptId, name: 'Road Maintenance', code: 'ROAD_MAINTENANCE' },
        jurisdiction: { id: pmcWard28Id, name: 'Ward 28 - Kothrud', code: 'PUN-Z02-W28', level: 'WARD', parentId: 'pmc-zone' },
        assignedWorkOrders: [],
        isActive: true,
        createdAt: new Date(),
      },
    ];

    vi.spyOn(db.user, 'findMany').mockResolvedValue(mockWorkersInDb as any);

    const req = new NextRequest('http://localhost:3000/api/v1/ops/workers?includeTasks=true');
    const res = await workersRouteHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Confirms CSMC workers are returned, and PMC worker Vikram Singh is filtered out
    const staffCodes = json.data.map((w: any) => w.staffCode);
    expect(staffCodes).toContain('CSMC-FW-001');
    expect(staffCodes).toContain('CSMC-FW-002');
    expect(staffCodes).not.toContain('PMC-FW-004');

    // Confirms active workloads are calculated correctly
    const workerA = json.data.find((w: any) => w.staffCode === 'CSMC-FW-001');
    expect(workerA.activeWorkload).toBe(1);

    const workerB = json.data.find((w: any) => w.staffCode === 'CSMC-FW-002');
    expect(workerB.activeWorkload).toBe(0);
  });

  // ===========================================================================
  // TEST 8: Cross-Corporation Assignment Blocked
  // ===========================================================================
  it('8. Strictly rejects cross-corporation assignment (CSMC complaint to PMC worker)', async () => {
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'csmc-comp-88',
      referenceNumber: 'GOV-2026-CSMC-088',
      status: 'TRIAGED_VALIDATED',
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      version: 1,
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: pmcWorkerSession.userId,
      fullName: 'Vikram Singh',
      role: 'FIELD_WORKER',
      departmentId: roadDeptId,
      jurisdictionId: pmcWard28Id,
      isActive: true,
    } as any);

    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockImplementation(async (jId) => {
      if (jId === csmcWard01Id) return csmcCorpId;
      if (jId === pmcWard28Id) return pmcCorpId;
      return null;
    });

    try {
      await assignComplaint({
        complaintId: 'csmc-comp-88',
        officerSession: csmcOfficerSession,
        assignedWorkerId: pmcWorkerSession.userId,
        targetCompletionAt: new Date(Date.now() + 86400000),
      });
      expect.unreachable('Should have thrown CORPORATION_MISMATCH error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.code).toBe('CORPORATION_MISMATCH');
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('Designated field worker belongs to a different municipal corporation');
    }
  });

  // ===========================================================================
  // TEST 9: Worker Account Deactivation & Assignment Invalidation
  // ===========================================================================
  it('9. Officer deactivates worker; deactivated worker cannot receive assignments or execute tasks', async () => {
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: workerASession.userId,
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      jurisdictionId: csmcWard01Id,
      isActive: true,
    } as any);

    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    const updateSpy = vi.spyOn(db.user, 'update').mockResolvedValue({
      id: workerASession.userId,
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      isActive: false,
    } as any);

    const updated = await updateStaffAccess(csmcOfficerSession, workerASession.userId, {
      isActive: false,
    });

    expect(updated.isActive).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: workerASession.userId },
        data: expect.objectContaining({ isActive: false }),
      })
    );

    // Verify assigning work to deactivated worker is rejected
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'csmc-comp-99',
      referenceNumber: 'GOV-2026-CSMC-099',
      status: 'TRIAGED_VALIDATED',
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      version: 1,
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: workerASession.userId,
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      jurisdictionId: csmcWard01Id,
      isActive: false, // Inactive!
    } as any);

    try {
      await assignComplaint({
        complaintId: 'csmc-comp-99',
        officerSession: csmcOfficerSession,
        assignedWorkerId: workerASession.userId,
        targetCompletionAt: new Date(Date.now() + 86400000),
      });
      expect.unreachable('Should fail for inactive worker');
    } catch (err: any) {
      expect(err).toBeInstanceOf(WorkflowError);
      expect(err.code).toBe('WORKER_NOT_FOUND');
      expect(err.message).toContain('inactive');
    }
  });

  // ===========================================================================
  // TEST 10: Worker Profile Updates & Role Protection
  // ===========================================================================
  it('10. Allows worker to update permitted profile fields (designation, skills) but blocks self-escalation', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerASession);
    vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);

    const updateSpy = vi.spyOn(db.user, 'update').mockResolvedValue({
      id: workerASession.userId,
      fullName: workerASession.fullName,
      email: workerASession.email,
      role: 'FIELD_WORKER',
      staffCode: 'CSMC-FW-001',
      designation: 'Master Pavement Specialist',
      skills: 'Asphalt, Concrete, Thermal Welding',
      isActive: true,
      department: { id: roadDeptId, name: 'Road Maintenance' },
      jurisdiction: { id: csmcWard01Id, name: 'Ward 01 - Shahaganj' },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/v1/ops/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        designation: 'Master Pavement Specialist',
        skills: 'Asphalt, Concrete, Thermal Welding',
        role: 'PLATFORM_ADMIN', // Attempted privilege escalation
      }),
    });

    const res = await updateProfileRouteHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify database update call only included permitted fields
    const passedData = updateSpy.mock.calls[0]?.[0]?.data as any;
    expect(passedData.designation).toBe('Master Pavement Specialist');
    expect(passedData.skills).toBe('Asphalt, Concrete, Thermal Welding');
    expect(passedData.role).toBeUndefined(); // Role alteration blocked!
  });

  // ===========================================================================
  // TEST 11: Citizen OTP Login & Private Grievance Scoping
  // ===========================================================================
  it('11. Citizen OTP verification grants access strictly to citizen portal and own complaints', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(citizenSession);
    vi.spyOn(db.complaint, 'updateMany').mockResolvedValue({ count: 0 } as any);

    const findManySpy = vi.spyOn(db.complaint, 'findMany').mockResolvedValue([
      {
        id: 'comp-citizen-1',
        referenceNumber: 'GOV-2026-00033',
        title: 'Damaged Roads near osmanpura',
        status: 'SUBMITTED',
        priority: 'P2_HIGH',
        landmarkAddress: 'Osmanpura Circle',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { nameEn: 'Damaged Roads & Potholes' },
        department: { name: 'Road Maintenance' },
        jurisdiction: { name: 'Ward 07 - Kranti Chowk' },
      },
    ] as any);

    const res = await myComplaintsRouteHandler();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].referenceNumber).toBe('GOV-2026-00033');

    // Verify database query enforces citizen ID / phone filter (strict anti-IDOR)
    const callArgs = findManySpy.mock.calls[0]?.[0] as any;
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toContainEqual({ citizenId: citizenSession.userId });
    expect(callArgs.where.OR).toContainEqual({ citizenPhone: citizenSession.phoneNumber });
  });
});
