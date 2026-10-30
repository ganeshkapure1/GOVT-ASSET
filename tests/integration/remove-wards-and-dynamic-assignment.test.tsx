import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';

import {
  getAllStates,
  getDistrictsByState,
  getCitiesByDistrict,
  getLocalBodiesByCity,
  getLocalBodyByCode,
  findLocalBodyByCoordinates,
} from '@/lib/india-locations';

import { GET as getLocations } from '@/app/api/v1/locations/route';
import { POST as postComplaint } from '@/app/api/v1/complaints/route';
import { GET as getOpsContext } from '@/app/api/v1/ops/context/route';
import { GET as getOpsQueue } from '@/app/api/v1/ops/queue/route';
import { POST as assignComplaintRoute } from '@/app/api/v1/ops/complaints/[id]/assign/route';
import { GET as getFieldTasks } from '@/app/api/v1/ops/field/tasks/route';

import {
  createComplaint,
  assignComplaint,
  WorkflowError,
} from '@/server/complaint-service';

import { canAccessComplaint, canAccessJurisdiction } from '@/server/auth';
import * as authModule from '@/server/auth';
import { UserSession, createSessionToken, verifySessionToken } from '@/lib/auth-session';
import { db } from '@/lib/db';

describe('GovAsset — Remove Wards, Make Location Dynamic & Worker Assignment (12 Scenarios)', () => {
  // Test Corporations
  const csmcCorpId = '11111111-1111-1111-1111-111111110002';
  const pmcCorpId = '11111111-1111-1111-1111-111111110003';
  const roadDeptId = '44444444-4444-4444-4444-444444440001';
  const potholeCatId = '55555555-5555-5555-5555-555555550001';

  // Test Sessions
  const csmcCitizen: UserSession = {
    userId: '66666666-6666-6666-6666-666666660108',
    email: 'citizen.csmc@govasset.in',
    phoneNumber: '+919822010108',
    fullName: 'Aniket Deshpande (CSMC Citizen)',
    role: 'CITIZEN',
    departmentId: null,
    jurisdictionId: csmcCorpId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcOfficer: UserSession = {
    userId: '66666666-6666-6666-6666-666666660101',
    email: 'officer.csmc@govasset.in',
    phoneNumber: '+919822010101',
    fullName: 'Sachin Waghmare (CSMC Officer)',
    role: 'OFFICER',
    departmentId: roadDeptId,
    jurisdictionId: csmcCorpId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const pmcOfficer: UserSession = {
    userId: '55555555-5555-5555-5555-555555550002',
    email: 'officer.pune@govasset.in',
    phoneNumber: '+919822010003',
    fullName: 'Amit Shinde (Pune Officer)',
    role: 'OFFICER',
    departmentId: roadDeptId,
    jurisdictionId: pmcCorpId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const unconfiguredOfficer: UserSession = {
    userId: '55555555-5555-5555-5555-555555550099',
    email: 'officer.unconfigured@govasset.in',
    phoneNumber: '+919822010099',
    fullName: 'New Unassigned Officer',
    role: 'OFFICER',
    departmentId: roadDeptId,
    jurisdictionId: null,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const csmcRoadWorker: UserSession = {
    userId: '66666666-6666-6666-6666-666666660103',
    email: 'field.csmc@govasset.in',
    phoneNumber: '+919822010103',
    fullName: 'Ganesh Shinde (CSMC Road Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: csmcCorpId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const pmcRoadWorker: UserSession = {
    userId: '88888888-8888-8888-8888-888888880009',
    email: 'field.pmc@govasset.in',
    phoneNumber: '+919822010009',
    fullName: 'Vikram Joshi (PMC Road Crew Lead)',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: pmcCorpId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db.complaint, 'count').mockResolvedValue(0);
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(null);
    vi.spyOn(db.jurisdiction, 'findMany').mockResolvedValue([]);
    vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue(null);
  });

  // =========================================================================
  // Scenario 1: Citizen Complaint Registration Hierarchy
  // =========================================================================
  it('Scenario 1: supports pan-India location hierarchy without requiring any ward selection', () => {
    const states = getAllStates();
    expect(states.length).toBe(36);

    const mhDistricts = getDistrictsByState('Maharashtra');
    expect(mhDistricts).toContain('Chhatrapati Sambhajinagar');
    expect(mhDistricts).toContain('Pune');

    const csmcCities = getCitiesByDistrict('Maharashtra', 'Chhatrapati Sambhajinagar');
    expect(csmcCities).toContain('Chhatrapati Sambhajinagar');

    const csmcLocalBodies = getLocalBodiesByCity('Maharashtra', 'Chhatrapati Sambhajinagar', 'Chhatrapati Sambhajinagar');
    expect(csmcLocalBodies.length).toBeGreaterThan(0);
    expect(csmcLocalBodies[0].name).toContain('Chhatrapati Sambhajinagar');
  });

  // =========================================================================
  // Scenario 2: Form Validates and Submits Without Requiring Ward Selection
  // =========================================================================
  it('Scenario 2: validates and registers citizen complaint successfully without ward inputs', async () => {
    vi.spyOn(authModule, 'getServerSession').mockResolvedValue(csmcCitizen);
    vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);

    let capturedInsertQuery = '';
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $executeRawUnsafe: vi.fn().mockImplementation((q: string) => {
          capturedInsertQuery = q;
          return 1;
        }),
        complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      })
    );

    vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue({
      id: potholeCatId,
      nameEn: 'Damaged Roads & Potholes',
      code: 'CAT_ROADS',
      departmentId: roadDeptId,
      defaultPriority: 'P2_HIGH',
      isActive: true,
      slaPolicies: [],
    } as any);

    vi.spyOn(db.jurisdiction, 'findFirst').mockResolvedValue({
      id: csmcCorpId,
      name: 'Chhatrapati Sambhajinagar Municipal Corporation',
      code: 'CSMC-01',
      level: 'DISTRICT_CORP',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/v1/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({
        categoryId: potholeCatId,
        description: 'Large asphalt crater on main station road',
        landmarkAddress: 'Near Railway Station Platform 1 Exit, Station Road',
        state: 'Maharashtra',
        district: 'Chhatrapati Sambhajinagar',
        city: 'Chhatrapati Sambhajinagar',
        localBodyCode: 'CSMC-01',
        isHazard: true,
      }),
    });

    const res = await postComplaint(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(capturedInsertQuery).toContain(csmcCitizen.userId);
    expect(capturedInsertQuery).toContain('P1_CRITICAL'); // hazard promoted
  });

  // =========================================================================
  // Scenario 3: Persists with Valid Local Body Jurisdiction ID
  // =========================================================================
  it('Scenario 3: resolves created complaints to the Local Body / City level jurisdiction', async () => {
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      })
    );

    vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue({
      id: potholeCatId,
      nameEn: 'Damaged Roads & Potholes',
      code: 'CAT_ROADS',
      departmentId: roadDeptId,
      defaultPriority: 'P2_HIGH',
      isActive: true,
      slaPolicies: [],
    } as any);

    vi.spyOn(db.jurisdiction, 'findFirst').mockResolvedValue({
      id: csmcCorpId,
      name: 'Chhatrapati Sambhajinagar Municipal Corporation',
      code: 'CSMC-01',
      level: 'DISTRICT_CORP',
    } as any);

    const complaint = await createComplaint({
      categoryId: potholeCatId,
      description: 'Dangerous pothole on CIDCO main avenue',
      landmarkAddress: 'Sector N-6, Near Shopping Center',
      citizenPhone: csmcCitizen.phoneNumber!,
      citizenId: csmcCitizen.userId,
      state: 'Maharashtra',
      district: 'Chhatrapati Sambhajinagar',
      city: 'Chhatrapati Sambhajinagar',
      localBodyCode: 'CSMC-01',
    });

    expect(complaint).toBeDefined();
    expect(complaint.jurisdictionId).toBe(csmcCorpId);
  });

  // =========================================================================
  // Scenario 4: Officer Dashboard Displays Dynamically Derived Location
  // =========================================================================
  it('Scenario 4: derives officer dashboard location dynamically from configured city and state', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(pmcOfficer);
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: pmcOfficer.userId,
      fullName: pmcOfficer.fullName,
      email: pmcOfficer.email,
      role: 'OFFICER',
      jurisdictionId: pmcCorpId,
      departmentId: roadDeptId,
      department: { id: roadDeptId, name: 'Roads Dept', code: 'PWD' },
      jurisdiction: { id: pmcCorpId, name: 'Pune Municipal Corporation', code: 'PMC-01', level: 'DISTRICT_CORP' },
    } as any);

    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(pmcCorpId);
    vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
      id: pmcCorpId,
      name: 'Pune Municipal Corporation',
      code: 'PMC-01',
      city: 'Pune',
      state: 'Maharashtra',
    } as any);

    const res = await getOpsContext();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.city).toBe('Pune');
    expect(json.data.state).toBe('Maharashtra');
    expect(json.data.locationLabel).toBe('Pune, Maharashtra');
    expect(json.data.hasValidJurisdiction).toBe(true);
  });

  // =========================================================================
  // Scenario 5: Missing Jurisdiction Displays "Location not configured"
  // =========================================================================
  it('Scenario 5: displays "Location not configured" when officer has no assigned jurisdiction', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(unconfiguredOfficer);
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: unconfiguredOfficer.userId,
      fullName: unconfiguredOfficer.fullName,
      email: unconfiguredOfficer.email,
      role: 'OFFICER',
      jurisdictionId: null,
      jurisdiction: null,
      department: { id: roadDeptId, name: 'Roads Dept', code: 'PWD' },
    } as any);

    const res = await getOpsContext();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.hasValidJurisdiction).toBe(false);
    expect(json.data.corporation).toBeNull();
  });

  // =========================================================================
  // Scenario 6: Complaints Queue Scoped to Officer Corporation Across All Localities
  // =========================================================================
  it('Scenario 6: complaints queue returns all complaints across the corporation without ward filters', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficer);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db.jurisdiction, 'findMany').mockResolvedValue([
      { id: 'zone-1' },
      { id: 'locality-a' },
      { id: 'locality-b' },
    ] as any);

    let capturedWhere: any = null;
    (vi.spyOn(db.complaint, 'findMany') as any).mockImplementation(async (args: any) => {
      capturedWhere = args.where;
      return [
        {
          id: 'complaint-1',
          referenceNumber: 'GOV-2026-00043',
          title: 'Road Cave-in at Kranti Chowk',
          description: 'Sinkhole on main carriage way',
          status: 'SUBMITTED',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Kranti Chowk Circle',
          jurisdictionId: csmcCorpId,
          departmentId: roadDeptId,
          version: 1,
          createdAt: new Date(),
          resolutionDueAt: new Date(),
          category: { id: potholeCatId, nameEn: 'Roads', code: 'CAT_ROADS' },
          jurisdiction: { id: csmcCorpId, name: 'CSMC Corporation' },
          department: { id: roadDeptId, name: 'Roads' },
          assignments: [],
        },
      ] as any;
    });

    const req = new NextRequest('http://localhost:3000/api/v1/ops/queue');
    const res = await getOpsQueue(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(capturedWhere.jurisdictionId).toHaveProperty('in');
    expect(capturedWhere.jurisdictionId.in).toContain(csmcCorpId);
  });

  // =========================================================================
  // Scenario 7: Officer Successfully Assigns Complaint to Active Field Worker
  // =========================================================================
  it('Scenario 7: officer assigns complaint to active field worker with matching skills', async () => {
    vi.spyOn(authModule, 'canAccessComplaint').mockReturnValue(true);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'comp-101',
      referenceNumber: 'GOV-2026-00043',
      title: 'Deep crater pothole',
      description: 'Pothole asphalt damaged',
      status: 'SUBMITTED',
      departmentId: roadDeptId,
      jurisdictionId: csmcCorpId,
      citizenPhone: '+919822010108',
      version: 1,
      category: { code: 'CAT_ROADS', nameEn: 'Damaged Roads' },
      department: { id: roadDeptId, name: 'Roads' },
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: csmcRoadWorker.userId,
      fullName: csmcRoadWorker.fullName,
      role: 'FIELD_WORKER',
      departmentId: roadDeptId,
      jurisdictionId: csmcCorpId,
      isActive: true,
      skills: 'Asphalt Patching, Road Milling, Compaction Machinery, Pothole Filling',
    } as any);

    let createdAssignment: any = null;
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        complaintAssignment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockImplementation((args: any) => {
            createdAssignment = args.data;
            return { id: 'asgn-101', ...args.data };
          }),
        },
        complaint: {
          update: vi.fn().mockResolvedValue({
            id: 'comp-101',
            status: 'ASSIGNED',
            version: 2,
          }),
        },
        complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      })
    );

    const result = await assignComplaint({
      complaintId: 'comp-101',
      officerSession: csmcOfficer,
      assignedWorkerId: csmcRoadWorker.userId,
      targetCompletionAt: new Date(Date.now() + 86400000),
      workerNotes: 'Fill with cold asphalt mix immediately',
    });

    expect(result.assignment).toBeDefined();
    expect(createdAssignment.assignedWorkerId).toBe(csmcRoadWorker.userId);
    expect(createdAssignment.isActive).toBe(true);
    expect(result.complaint.status).toBe('ASSIGNED');
  });

  // =========================================================================
  // Scenario 8: Mismatched Skills Blocked Unless Authorized Override Provided
  // =========================================================================
  it('Scenario 8: blocks worker with mismatching skills unless authorized override explanation is given', async () => {
    vi.spyOn(authModule, 'canAccessComplaint').mockReturnValue(true);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'comp-102',
      title: 'Water Main Pipe Burst',
      description: 'Underground high pressure pipe cracked',
      status: 'SUBMITTED',
      departmentId: 'dept-water',
      jurisdictionId: csmcCorpId,
      version: 1,
      category: { code: 'CAT_WATER', nameEn: 'Water Leakage' },
    } as any);

    // Worker only has electrical skills
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'worker-elec',
      fullName: 'Electrical Technician',
      role: 'FIELD_WORKER',
      departmentId: 'dept-electrical',
      jurisdictionId: csmcCorpId,
      isActive: true,
      skills: 'High Voltage, Streetlights, Wiring',
    } as any);

    // Attempt 1: Without override -> Throws SKILL_MISMATCH or DEPARTMENT_MISMATCH
    await expect(
      assignComplaint({
        complaintId: 'comp-102',
        officerSession: csmcOfficer,
        assignedWorkerId: 'worker-elec',
        targetCompletionAt: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow();

    // Attempt 2: With valid authorized override explanation -> succeeds
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        complaintAssignment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({ id: 'asgn-override' }),
        },
        complaint: {
          update: vi.fn().mockResolvedValue({ id: 'comp-102', status: 'ASSIGNED', version: 2 }),
        },
        complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      })
    );

    const overrideResult = await assignComplaint({
      complaintId: 'comp-102',
      officerSession: csmcOfficer,
      assignedWorkerId: 'worker-elec',
      targetCompletionAt: new Date(Date.now() + 86400000),
      allowSkillOverride: true,
      overrideReason: 'Emergency duty roster cross-deployed due to monsoon staff shortage',
    });

    expect(overrideResult.assignment).toBeDefined();
  });

  // =========================================================================
  // Scenario 9: Assignment Status & Supabase Record Persistence
  // =========================================================================
  it('Scenario 9: transitions complaint status to ASSIGNED and writes active assignment record', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcOfficer);
    vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);
    vi.spyOn(authModule, 'canAccessComplaint').mockReturnValue(true);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'comp-103',
      referenceNumber: 'GOV-2026-00043',
      title: 'Pothole Repair',
      description: 'Pothole description',
      status: 'TRIAGED_VALIDATED',
      departmentId: roadDeptId,
      jurisdictionId: csmcCorpId,
      citizenPhone: '+919822010108',
      version: 2,
      category: { code: 'CAT_ROADS', nameEn: 'Damaged Roads' },
      department: { id: roadDeptId, name: 'Roads' },
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: csmcRoadWorker.userId,
      fullName: csmcRoadWorker.fullName,
      role: 'FIELD_WORKER',
      departmentId: roadDeptId,
      jurisdictionId: csmcCorpId,
      isActive: true,
      skills: 'Asphalt Patching, Pothole Filling',
    } as any);

    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) =>
      cb({
        complaintAssignment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({
            id: 'asgn-103',
            complaintId: 'comp-103',
            assignedWorkerId: csmcRoadWorker.userId,
            isActive: true,
          }),
        },
        complaint: {
          update: vi.fn().mockResolvedValue({ id: 'comp-103', status: 'ASSIGNED', version: 3 }),
        },
        complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      })
    );

    const req = new NextRequest('http://localhost:3000/api/v1/ops/complaints/comp-103/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({
        assignedWorkerId: csmcRoadWorker.userId,
        targetCompletionAt: new Date(Date.now() + 86400000).toISOString(),
        workerNotes: 'Priority dispatch',
      }),
    });

    const res = await assignComplaintRoute(req, { params: { id: 'comp-103' } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.complaint.status).toBe('ASSIGNED');
  });

  // =========================================================================
  // Scenario 10: Assigned Worker Sees Task in /ops/field Active List
  // =========================================================================
  it('Scenario 10: assigned field worker sees task in /ops/field tasks query', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcRoadWorker);

    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue([
      {
        id: 'asgn-101',
        complaintId: 'comp-101',
        assignedWorkerId: csmcRoadWorker.userId,
        isActive: true,
        createdAt: new Date(),
        targetCompletionAt: new Date(Date.now() + 86400000),
        workerNotes: 'Fill with cold asphalt mix immediately',
        complaint: {
          id: 'comp-101',
          referenceNumber: 'GOV-2026-00043',
          title: 'Road Cave-in at Kranti Chowk',
          description: 'Sinkhole on main carriage way',
          status: 'ASSIGNED',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Kranti Chowk Circle',
          version: 2,
          citizenPhone: '+919822010108',
          category: { nameEn: 'Damaged Roads' },
          department: { name: 'Public Works' },
          jurisdiction: { name: 'Chhatrapati Sambhajinagar' },
          evidence: [],
          timeline: [],
        },
      },
    ] as any);

    const req = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const res = await getFieldTasks(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].ref).toBe('GOV-2026-00043');
    expect(json.data[0].status).toBe('ASSIGNED');
    expect(json.counts.assigned).toBe(1);
  });

  // =========================================================================
  // Scenario 11: Task Persistence Across Refresh & Login
  // =========================================================================
  it('Scenario 11: task remains visible upon repeated fetch queries reflecting page refresh', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(csmcRoadWorker);

    const mockTasks = [
      {
        id: 'asgn-101',
        complaintId: 'comp-101',
        assignedWorkerId: csmcRoadWorker.userId,
        isActive: true,
        complaint: {
          id: 'comp-101',
          referenceNumber: 'GOV-2026-00043',
          status: 'ASSIGNED',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Kranti Chowk Circle',
          version: 2,
          jurisdiction: { name: 'Chhatrapati Sambhajinagar' },
          evidence: [],
          timeline: [],
        },
      },
    ];

    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue(mockTasks as any);

    // First fetch (initial page load)
    const req1 = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const res1 = await getFieldTasks(req1);
    const json1 = await res1.json();
    expect(json1.data[0].ref).toBe('GOV-2026-00043');

    // Second fetch (subsequent page refresh)
    const req2 = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const res2 = await getFieldTasks(req2);
    const json2 = await res2.json();
    expect(json2.data[0].ref).toBe('GOV-2026-00043');
    expect(json2.data[0].isActiveAssignment).toBe(true);
  });

  // =========================================================================
  // Scenario 12: Cross-Corporation Assignment Strictly Forbidden
  // =========================================================================
  it('Scenario 12: cross-corporation assignment (CSMC complaint to Pune worker) is rejected with 400 CORPORATION_MISMATCH', async () => {
    vi.spyOn(authModule, 'canAccessComplaint').mockReturnValue(true);

    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'comp-csmc',
      jurisdictionId: csmcCorpId,
      status: 'SUBMITTED',
      departmentId: roadDeptId,
      category: { code: 'CAT_ROADS', nameEn: 'Damaged Roads' },
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: pmcRoadWorker.userId,
      fullName: pmcRoadWorker.fullName,
      role: 'FIELD_WORKER',
      departmentId: roadDeptId,
      jurisdictionId: pmcCorpId, // Pune Corporation
      isActive: true,
      skills: 'Asphalt Patching, Pothole Filling',
    } as any);

    vi.spyOn(authModule, 'getCorporationIdForJurisdiction')
      .mockResolvedValueOnce(csmcCorpId) // Complaint Corp
      .mockResolvedValueOnce(pmcCorpId);  // Worker Corp

    await expect(
      assignComplaint({
        complaintId: 'comp-csmc',
        officerSession: csmcOfficer,
        assignedWorkerId: pmcRoadWorker.userId,
        targetCompletionAt: new Date(Date.now() + 86400000),
      })
    ).rejects.toMatchObject({
      name: 'WorkflowError',
      code: 'CORPORATION_MISMATCH',
      statusCode: 400,
    });
  });
});
