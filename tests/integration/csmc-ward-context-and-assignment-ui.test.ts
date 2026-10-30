import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import {
  createComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { GET as opsContextHandler } from '@/app/api/v1/ops/context/route';
import { GET as opsQueueHandler } from '@/app/api/v1/ops/queue/route';
import { POST as assignRouteHandler } from '@/app/api/v1/ops/complaints/[id]/assign/route';
import { GET as fieldTasksRouteHandler } from '@/app/api/v1/ops/field/tasks/route';
import * as authModule from '@/server/auth';

describe('GovAsset — CSMC Ward Context, Queue Visibility & Assignment UI Regression Tests', () => {
  // CSMC IDs
  const csmcCorpId = '11111111-1111-1111-1111-111111110002'; // CSMC Corporation
  const csmcZoneId = '22222222-2222-2222-2222-222222220101'; // CSMC Zone 1 (Town Hall)
  const csmcWard01Id = '33333333-3333-3333-3333-333333330101'; // CSMC Ward 01 - Shahaganj
  const csmcWard07Id = '33333333-3333-3333-3333-333333330107'; // CSMC Ward 07 - Kranti Chowk
  const roadDeptId = '44444444-4444-4444-4444-444444440001'; // Road Maintenance
  const potholeCatId = '55555555-5555-5555-5555-555555550001'; // Damaged Roads

  // PMC IDs for cross-corporation testing
  const pmcCorpId = '11111111-1111-1111-1111-111111111111';
  const pmcWard28Id = '33333333-3333-3333-3333-333333330028'; // PMC Ward 28 - Kothrud

  // Actor Sessions
  const csmcCitizenSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660008',
    email: 'citizen.aarav@govasset.in',
    phoneNumber: '+919822010008',
    fullName: 'Aarav Deshmukh (Citizen)',
    role: 'CITIZEN',
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

  const csmcWorkerSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660103',
    email: 'field.csmc@govasset.in',
    phoneNumber: '+919822010103',
    fullName: 'Ganesh Shinde',
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
    fullName: 'Vikram Singh',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: pmcWard28Id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // TEST 1: CSMC Citizen Submits Complaint & Jurisdiction Scoping
  // ===========================================================================
  it('1. Citizen submits complaint in CSMC and correctly assigns CSMC Ward 01 jurisdiction', async () => {
    const mockCreated = {
      id: 'csmc-test-comp-101',
      referenceNumber: 'GOV-2026-CSMC-101',
      title: 'Pothole on Shahaganj Market Road',
      description: 'Severe road surface damage impeding vehicular traffic.',
      landmarkAddress: 'Clock Tower, Shahaganj, Chhatrapati Sambhajinagar',
      citizenPhone: '+919822010008',
      citizenId: csmcCitizenSession.userId,
      categoryId: potholeCatId,
      departmentId: roadDeptId,
      jurisdictionId: csmcWard01Id,
      status: 'SUBMITTED',
      priority: 'P1_CRITICAL',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue({
      id: potholeCatId,
      code: 'CAT_POTHOLE',
      nameEn: 'Damaged Roads & Potholes',
      departmentId: roadDeptId,
      defaultPriority: 'P1_CRITICAL',
      isActive: true,
      slaPolicies: [],
    } as any);

    vi.spyOn(db.jurisdiction, 'findFirst').mockResolvedValue({
      id: csmcWard01Id,
      name: 'Ward 01 - Shahaganj',
      code: 'CSMC-Z01-W01',
      level: 'WARD',
    } as any);

    vi.spyOn(db, '$queryRawUnsafe').mockResolvedValue([{ id: csmcWard01Id }] as any);
    vi.spyOn(db.complaint, 'count').mockResolvedValue(100);
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(null);
    vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
      return callback({
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
        complaint: { findUnique: vi.fn().mockResolvedValue(mockCreated) },
      });
    });

    const complaint = await createComplaint({
      categoryId: potholeCatId,
      description: 'Severe road surface damage impeding vehicular traffic.',
      landmarkAddress: 'Clock Tower, Shahaganj, Chhatrapati Sambhajinagar',
      citizenPhone: '+919822010008',
      citizenId: csmcCitizenSession.userId,
      wardNameOrCode: 'Ward 01 - Shahaganj',
      latitude: 19.8872,
      longitude: 75.3289,
    });

    expect(complaint).toBeDefined();
    expect(complaint.jurisdictionId).toBe(csmcWard01Id);
    expect(complaint.status).toBe('SUBMITTED');
  });

  // ===========================================================================
  // TEST 2: CSMC Officer Context & Ward Scoping (/api/v1/ops/context)
  // ===========================================================================
  it('2. Ops context API returns CSMC corporation, assigned ward, and only CSMC authorized wards (no PMC wards)', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: csmcOfficerSession.userId,
      fullName: 'Sachin Waghmare',
      email: csmcOfficerSession.email,
      role: 'OFFICER',
      staffCode: 'CSMC-OFF-01',
      designation: 'Junior Engineer (Roads)',
      skills: 'Pothole Inspection, Triage',
      isActive: true,
      departmentId: roadDeptId,
      jurisdictionId: csmcWard01Id,
      department: { id: roadDeptId, name: 'Road Maintenance', code: 'ROAD_MAINTENANCE' },
      jurisdiction: {
        id: csmcWard01Id,
        name: 'Ward 01 - Shahaganj',
        code: 'CSMC-Z01-W01',
        level: 'WARD',
        parentId: csmcZoneId,
      },
    } as any);

    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
      id: csmcCorpId,
      name: 'Chhatrapati Sambhajinagar Municipal Corporation',
      code: 'CSMC-01',
      city: 'Chhatrapati Sambhajinagar',
      state: 'Maharashtra',
      contactEmail: 'contact@csmc.gov.in',
      contactPhone: '0240-2331111',
    } as any);

    (vi.spyOn(db.jurisdiction, 'findMany') as any).mockImplementation(async (args: any) => {
      if (args?.where?.level === 'ZONE') {
        return [{ id: csmcZoneId }] as any;
      }
      if (args?.where?.level === 'WARD') {
        return [
          { id: csmcWard01Id, name: 'Ward 01 - Shahaganj', code: 'CSMC-Z01-W01', parentId: csmcZoneId },
          { id: csmcWard07Id, name: 'Ward 07 - Kranti Chowk', code: 'CSMC-Z04-W07', parentId: csmcZoneId },
        ] as any;
      }
      return [] as any;
    });

    const response = await opsContextHandler();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.corporation.code).toBe('CSMC-01');
    expect(json.data.corporation.city).toBe('Chhatrapati Sambhajinagar');
    expect(json.data.assignedWard.name).toBe('Ward 01 - Shahaganj');
    expect(json.data.hasValidJurisdiction).toBe(true);

    // Verify authorized wards only include CSMC wards, strictly no PMC wards
    const wardCodes = json.data.authorizedWards.map((w: any) => w.code);
    expect(wardCodes).toContain('CSMC-Z01-W01');
    expect(wardCodes).toContain('CSMC-Z04-W07');
    expect(wardCodes).not.toContain('PUN-Z02-W28');
  });

  // ===========================================================================
  // TEST 3: Setup Message when Officer has No Valid Ward
  // ===========================================================================
  it('3. Ops context returns explicit setupRequired message when officer has no assigned jurisdiction', async () => {
    const unassignedOfficer: UserSession = {
      userId: '66666666-6666-6666-6666-666666660199',
      email: 'unassigned@govasset.in',
      phoneNumber: '+919822010199',
      fullName: 'Unassigned Officer',
      role: 'OFFICER',
      departmentId: roadDeptId,
      jurisdictionId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(unassignedOfficer);
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: unassignedOfficer.userId,
      fullName: unassignedOfficer.fullName,
      email: unassignedOfficer.email,
      role: 'OFFICER',
      jurisdictionId: null,
      jurisdiction: null,
      departmentId: roadDeptId,
      department: { id: roadDeptId, name: 'Road Maintenance', code: 'ROAD_MAINTENANCE' },
    } as any);

    const response = await opsContextHandler();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.hasValidJurisdiction).toBe(false);
    expect(json.data.setupMessage).toContain('No electoral ward assigned');
    expect(json.data.assignedWard).toBeNull();
  });

  // ===========================================================================
  // TEST 4: Complaints Queue Scoping & Real Metrics (/api/v1/ops/queue)
  // ===========================================================================
  it('4. Complaints queue returns scoped CSMC complaints and dynamic operational metrics', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    (vi.spyOn(db.jurisdiction, 'findMany') as any).mockImplementation(async (args: any) => {
      if (args?.where?.level === 'ZONE') {
        return [{ id: csmcZoneId }] as any;
      }
      if (args?.where?.level === 'WARD') {
        return [{ id: csmcWard01Id }, { id: csmcWard07Id }] as any;
      }
      return [] as any;
    });

    const mockComplaints = [
      {
        id: 'comp-csmc-01',
        referenceNumber: 'GOV-2026-00033',
        title: 'Damaged Roads near Osmanpura',
        description: 'Road has many potholes',
        status: 'SUBMITTED',
        priority: 'P1_CRITICAL',
        landmarkAddress: 'Osmanpura, Chhatrapati Sambhajinagar',
        jurisdictionId: csmcWard01Id,
        departmentId: roadDeptId,
        citizenPhone: '+919822010008',
        version: 1,
        createdAt: new Date('2026-10-29T12:00:00Z'),
        resolutionDueAt: new Date('2026-10-30T12:00:00Z'),
        category: { id: potholeCatId, nameEn: 'Damaged Roads & Potholes', code: 'CAT_POTHOLE' },
        jurisdiction: { id: csmcWard01Id, name: 'Ward 01 - Shahaganj', code: 'CSMC-Z01-W01' },
        department: { id: roadDeptId, name: 'Road Maintenance', code: 'ROAD_MAINTENANCE' },
        assignments: [],
      },
    ];

    vi.spyOn(db.complaint, 'findMany').mockResolvedValue(mockComplaints as any);

    const req = new NextRequest(`http://localhost:3000/api/v1/ops/queue?wardId=${csmcWard01Id}`);
    const response = await opsQueueHandler(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].ref).toBe('GOV-2026-00033');
    expect(json.metrics).toBeDefined();
    expect(json.metrics.pendingCount).toBe(1);
    expect(json.metrics.inProgressCount).toBe(0);
    expect(json.metrics.categoryBreakdown).toHaveLength(1);
    expect(json.metrics.categoryBreakdown[0].name).toBe('Damaged Roads & Potholes');
  });

  // ===========================================================================
  // TEST 5: Cross-Corporation Queue Access Rejection (Anti-Tampering)
  // ===========================================================================
  it('5. Rejects CSMC officer querying complaints from another corporation (PMC) with 403 CORPORATION_MISMATCH', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);

    // CSMC officer trying to query PMC Ward 28
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockImplementation(async (jurId) => {
      if (jurId === csmcWard01Id) return csmcCorpId;
      if (jurId === pmcWard28Id) return pmcCorpId;
      return null;
    });

    vi.spyOn(db.jurisdiction, 'findMany').mockResolvedValue([{ id: csmcZoneId }] as any);

    const req = new NextRequest(`http://localhost:3000/api/v1/ops/queue?wardId=${pmcWard28Id}`);
    const response = await opsQueueHandler(req);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('CORPORATION_MISMATCH');
  });

  // ===========================================================================
  // TEST 6: Visible Assignment Execution via Server-Side API
  // ===========================================================================
  it('6. Successfully assigns complaint to active CSMC field worker (Ganesh Shinde) with OCC version update', async () => {
    const mockComplaint = {
      id: 'csmc-comp-assign-01',
      referenceNumber: 'GOV-2026-CSMC-099',
      title: 'Pavement collapse near Shahaganj Chowk',
      status: 'SUBMITTED',
      version: 1,
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      citizenPhone: '+919822010008',
    };

    const mockWorker = {
      id: csmcWorkerSession.userId,
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      departmentId: roadDeptId,
      jurisdictionId: csmcWard01Id,
      isActive: true,
    };

    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);
    vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockComplaint as any);
    vi.spyOn(db.user, 'findUnique').mockResolvedValue(mockWorker as any);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
      return callback({
        complaintAssignment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({
            id: 'asgn-new-001',
            complaintId: mockComplaint.id,
            assignedWorkerId: mockWorker.id,
            isActive: true,
          }),
        },
        complaint: {
          findUnique: vi.fn().mockResolvedValue(mockComplaint),
          update: vi.fn().mockResolvedValue({
            ...mockComplaint,
            status: 'ASSIGNED',
            version: 2,
          }),
        },
        complaintTimeline: {
          create: vi.fn().mockResolvedValue({ id: 'tm-001' }),
        },
        notification: {
          create: vi.fn().mockResolvedValue({ id: 'notif-001' }),
        },
      });
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/ops/complaints/${mockComplaint.id}/assign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedWorkerId: mockWorker.id,
          targetCompletionAt: new Date(Date.now() + 86400000).toISOString(),
          workerNotes: 'Deploy crew with cold bituminous mix.',
          expectedVersion: 1,
        }),
      }
    );

    const response = await assignRouteHandler(req, { params: { id: mockComplaint.id } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
  });

  // ===========================================================================
  // TEST 7: Cross-Corporation Worker Assignment Rejection
  // ===========================================================================
  it('7. Rejects assigning CSMC complaint to a field worker belonging to another corporation (PMC)', async () => {
    const mockComplaint = {
      id: 'csmc-comp-cross-01',
      referenceNumber: 'GOV-2026-CSMC-100',
      status: 'SUBMITTED',
      version: 1,
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      citizenPhone: '+919822010008',
    };

    const foreignWorker = {
      id: pmcWorkerSession.userId,
      fullName: 'Vikram Singh',
      role: 'FIELD_WORKER',
      departmentId: roadDeptId,
      jurisdictionId: pmcWard28Id, // PMC Ward
      isActive: true,
    };

    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);
    vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(mockComplaint as any);
    vi.spyOn(db.user, 'findUnique').mockResolvedValue(foreignWorker as any);

    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockImplementation(async (jurId) => {
      if (jurId === csmcWard01Id) return csmcCorpId;
      if (jurId === pmcWard28Id) return pmcCorpId;
      return null;
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/ops/complaints/${mockComplaint.id}/assign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedWorkerId: foreignWorker.id,
          targetCompletionAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      }
    );

    const response = await assignRouteHandler(req, { params: { id: mockComplaint.id } });
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('CORPORATION_MISMATCH');
  });

  // ===========================================================================
  // TEST 8: Field Worker Task List & Execution Lifecycle
  // ===========================================================================
  it('8. Field worker receives task in active tasks API and transitions status (START_WORK -> IN_PROGRESS)', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcWorkerSession);

    const mockAssignedTasks = [
      {
        id: 'asgn-001',
        complaintId: 'csmc-comp-01',
        isActive: true,
        complaint: {
          id: 'csmc-comp-01',
          referenceNumber: 'GOV-2026-CSMC-001',
          title: 'Damaged Roads on Shahaganj Market Road',
          description: 'Pothole cluster',
          status: 'ASSIGNED',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Shahaganj Clock Tower',
          jurisdiction: { name: 'Ward 01 - Shahaganj' },
          category: { nameEn: 'Damaged Roads & Potholes' },
        },
      },
    ];

    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue(mockAssignedTasks as any);

    const req = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const response = await fieldTasksRouteHandler(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].ref).toBe('GOV-2026-CSMC-001');
    expect(json.data[0].status).toBe('ASSIGNED');
  });

  // ===========================================================================
  // TEST 9: Unresolved Ward / Location Handling (Explicit Handling State)
  // ===========================================================================
  it('9. Throws UNRESOLVED_JURISDICTION 400 when citizen submits coordinates completely outside recognized municipal areas with no ward selection', async () => {
    vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue({
      id: potholeCatId,
      code: 'CAT_POTHOLE',
      nameEn: 'Damaged Roads & Potholes',
      departmentId: roadDeptId,
      defaultPriority: 'P3_MEDIUM',
      isActive: true,
    } as any);

    vi.spyOn(db, '$queryRawUnsafe').mockResolvedValue([]);

    // Provide coordinates out in the Arabian Sea / invalid service area
    await expect(
      createComplaint({
        categoryId: potholeCatId,
        description: 'Mystery defect out of bounds',
        landmarkAddress: 'Offshore location',
        citizenPhone: '+919822010008',
        latitude: 10.0, // Far south of Maharashtra
        longitude: 65.0, // Arabian Sea
        wardNameOrCode: undefined, // No ward specified
      })
    ).rejects.toThrowError(WorkflowError);

    try {
      await createComplaint({
        categoryId: potholeCatId,
        description: 'Mystery defect out of bounds',
        landmarkAddress: 'Offshore location',
        citizenPhone: '+919822010008',
        latitude: 10.0,
        longitude: 65.0,
        wardNameOrCode: undefined,
      });
    } catch (err: any) {
      expect(err.code).toBe('UNRESOLVED_JURISDICTION');
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('Unable to determine municipal corporation jurisdiction');
    }
  });

  // ===========================================================================
  // TEST 10: Search and Status Filters on Queue API
  // ===========================================================================
  it('10. Correctly applies status and search filters on queue API', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficerSession);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    (vi.spyOn(db.jurisdiction, 'findMany') as any).mockImplementation(async (args: any) => {
      if (args?.where?.level === 'ZONE') {
        return [{ id: csmcZoneId }] as any;
      }
      if (args?.where?.level === 'WARD') {
        return [{ id: csmcWard01Id }] as any;
      }
      return [] as any;
    });

    const findManySpy = vi.spyOn(db.complaint, 'findMany').mockResolvedValue([]);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/ops/queue?wardId=${csmcWard01Id}&status=SUBMITTED&search=clock`
    );

    const response = await opsQueueHandler(req);
    expect(response.status).toBe(200);

    expect(findManySpy).toHaveBeenCalled();
    const callArgs = findManySpy.mock.calls[0]?.[0] as any;
    expect(callArgs?.where?.status).toBe('SUBMITTED');
    expect(callArgs?.where?.jurisdictionId).toBe(csmcWard01Id);
    expect(callArgs?.where?.OR).toBeDefined();
  });
});
