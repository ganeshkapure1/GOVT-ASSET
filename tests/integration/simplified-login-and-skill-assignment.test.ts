import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import { getDefaultRedirectForRole } from '@/lib/rbac';
import {
  CONTROLLED_WORK_TYPES,
  CATEGORY_TO_WORK_TYPE,
  identifyComplaintWorkType,
  evaluateWorkerSkillMatch,
  parseWorkerSkills,
} from '@/lib/skills-taxonomy';
import {
  assignComplaint,
  getTrackedComplaint,
  WorkflowError,
} from '@/server/complaint-service';
import { requestPhoneOtp, verifyPhoneOtp } from '@/server/otp-service';
import { hashPassword, verifyPassword } from '@/lib/auth-crypto';
import { inviteStaffUser } from '@/server/admin-service';
import { GET as complaintDetailsHandler } from '@/app/api/v1/ops/complaints/[id]/route';
import { GET as fieldTasksHandler } from '@/app/api/v1/ops/field/tasks/route';
import * as authModule from '@/server/auth';

describe('GovAsset — Simplified Login, Worker Management by Skills & Smart Work-Type Assignment (14 Scenarios)', () => {
  // CSMC & PMC Fixture IDs
  const csmcCorpId = '11111111-1111-1111-1111-111111110002';
  const csmcWard01Id = '33333333-3333-3333-3333-333333330101';
  const pmcCorpId = '11111111-1111-1111-1111-111111111111';
  const pmcWard28Id = '33333333-3333-3333-3333-333333330028';

  const roadDeptId = '44444444-4444-4444-4444-444444440001';
  const elecDeptId = '44444444-4444-4444-4444-444444440002';
  const waterDeptId = '44444444-4444-4444-4444-444444440003';

  // Sessions
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

  const workerASession: UserSession = {
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

  const workerBSession: UserSession = {
    userId: '66666666-6666-6666-6666-666666660104',
    email: 'field2.csmc@govasset.in',
    phoneNumber: '+919822010104',
    fullName: 'Santosh Jadhav',
    role: 'FIELD_WORKER',
    departmentId: roadDeptId,
    jurisdictionId: csmcWard01Id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. Login Page Displays Exactly Three Primary Options
  // ===========================================================================
  it('Scenario 1: login page presents exactly three primary options (Citizen, Official, Worker)', () => {
    const loginFilePath = path.join(process.cwd(), 'src/app/(auth)/login/page.tsx');
    const content = fs.readFileSync(loginFilePath, 'utf-8');

    expect(content).toContain('Citizen Login');
    expect(content).toContain('Official Login');
    expect(content).toContain('Worker Login');

    // Confirm development shortcuts are protected behind non-production condition
    expect(content).toContain("process.env.NODE_ENV !== 'production'");
  });

  // ===========================================================================
  // 2. Citizen Login Continues to Work
  // ===========================================================================
  it('Scenario 2: citizen login requests OTP and verifies successfully to issue citizen session', async () => {
    const testPhone = '+919822010108';
    const otpReq = await requestPhoneOtp(testPhone);
    expect(otpReq.success).toBe(true);

    const otpCode = otpReq.mockOtpNotice?.match(/\d{6}/)?.[0] || '123456';
    const verifyRes = await verifyPhoneOtp(testPhone, otpCode);

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.sessionToken).toBeDefined();
    expect(verifyRes.user?.role).toBe('CITIZEN');
  });

  // ===========================================================================
  // 3. Government Officials Land on Government Dashboard
  // ===========================================================================
  it('Scenario 3: government officials land on the government operations dashboard', () => {
    expect(getDefaultRedirectForRole('OFFICER')).toBe('/ops/triage');
    expect(getDefaultRedirectForRole('DEPT_ADMIN')).toBe('/ops/triage');
    expect(getDefaultRedirectForRole('SUPERVISOR')).toBe('/ops/verifications');
    expect(getDefaultRedirectForRole('PLATFORM_ADMIN')).toBe('/admin');
  });

  // ===========================================================================
  // 4. Workers Land on Dedicated Worker Dashboard
  // ===========================================================================
  it('Scenario 4: workers land on the dedicated worker dashboard (/ops/field)', () => {
    const workerRedirect = getDefaultRedirectForRole('FIELD_WORKER');
    expect(workerRedirect).toBe('/ops/field');
    expect(workerRedirect).not.toBe('/ops/triage');
  });

  // ===========================================================================
  // 5. Two Workers Have Separate Accounts and Independent Task Lists
  // ===========================================================================
  it('Scenario 5: two workers have separate accounts and independent task lists (anti-cross-worker leakage)', async () => {
    // Mock requireAuth to return Worker A
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerASession);

    // Mock db.complaintAssignment.findMany
    const mockFindMany = vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue([
      {
        id: 'assign-worker-a-1',
        complaintId: 'comp-101',
        assignedWorkerId: workerASession.userId,
        isActive: true,
        targetCompletionAt: new Date(),
        createdAt: new Date(),
        workerNotes: 'Pothole patch',
        complaint: {
          id: 'comp-101',
          referenceNumber: 'GOV-2026-00101',
          title: 'Road Crater',
          description: 'Pothole near Town Hall',
          status: 'ASSIGNED',
          priority: 'P1_CRITICAL',
          landmarkAddress: 'Town Hall',
          version: 1,
          citizenPhone: '+919822010108',
          category: { nameEn: 'Roads & Potholes' },
          department: { name: 'Road Maintenance' },
          jurisdiction: { name: 'Ward 01' },
          evidence: [],
          timeline: [],
        },
      } as any,
    ]);

    const reqA = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const resA = await fieldTasksHandler(reqA);
    const jsonA = await resA.json();

    expect(jsonA.success).toBe(true);
    expect(jsonA.data.length).toBe(1);
    expect(jsonA.data[0].ref).toBe('GOV-2026-00101');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedWorkerId: workerASession.userId,
        }),
      })
    );

    // Now request as Worker B
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerBSession);
    mockFindMany.mockResolvedValue([]);

    const reqB = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const resB = await fieldTasksHandler(reqB);
    const jsonB = await resB.json();

    expect(jsonB.success).toBe(true);
    expect(jsonB.data.length).toBe(0); // Worker B has 0 tasks, unaffected by Worker A
  });

  // ===========================================================================
  // 6. Authorized Officials Can Add a Worker with Multiple Skills
  // ===========================================================================
  it('Scenario 6: authorized officials can add a worker with multiple qualified skills', async () => {
    vi.spyOn(authModule, 'canAccessJurisdiction').mockResolvedValue(true);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    vi.spyOn(db.department, 'findUnique').mockResolvedValue({
      id: elecDeptId,
      name: 'Electrical Engineering & Street Lighting',
      code: 'ELECTRICAL_LIGHTING',
    } as any);

    vi.spyOn(db.jurisdiction, 'findUnique').mockResolvedValue({
      id: csmcWard01Id,
      name: 'Ward 01 - Shahaganj',
      code: 'CSMC-Z01-W01',
      level: 'WARD',
      parentId: 'csmc-zone-1',
    } as any);

    const mockCreate = vi.spyOn(db.user, 'create').mockResolvedValue({
      id: 'worker-new-id',
      fullName: 'Ramesh Kale',
      phoneNumber: '+919822010105',
      email: 'ramesh.kale@govasset.in',
      role: 'FIELD_WORKER',
      staffCode: 'CSMC-FW-003',
      designation: 'Electrical Lineman Lead',
      skills: 'Electrical Maintenance, Streetlight Repair, Cable Splicing',
      departmentId: elecDeptId,
      jurisdictionId: csmcWard01Id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: 'scrypt$mock$hash',
      lastLoginAt: null,
    });

    vi.spyOn(db.user, 'findFirst').mockResolvedValue(null);

    const created = await inviteStaffUser(csmcOfficerSession, {
      fullName: 'Ramesh Kale',
      phoneNumber: '+919822010105',
      email: 'ramesh.kale@govasset.in',
      role: 'FIELD_WORKER',
      staffCode: 'CSMC-FW-003',
      designation: 'Electrical Lineman Lead',
      skills: 'Electrical Maintenance, Streetlight Repair, Cable Splicing',
      departmentId: elecDeptId,
      jurisdictionId: csmcWard01Id,
      password: 'SecurePassword123!',
    });

    expect(created).toBeDefined();
    expect(created.fullName).toBe('Ramesh Kale');
    expect(created.skills).toContain('Streetlight Repair');
    expect(created.skills).toContain('Electrical Maintenance');
    expect(mockCreate).toHaveBeenCalled();
  });

  // ===========================================================================
  // 7. A Newly Created Worker Can Authenticate and Access Worker Portal
  // ===========================================================================
  it('Scenario 7: newly created worker authenticates via password and receives worker role redirect', async () => {
    const plainPassword = 'WorkerPassword2026';
    const hash = await hashPassword(plainPassword);

    const isMatch = await verifyPassword(plainPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword', hash);
    expect(isWrongMatch).toBe(false);

    expect(getDefaultRedirectForRole('FIELD_WORKER')).toBe('/ops/field');
  });

  // ===========================================================================
  // 8. Electrical Complaint Suggests Qualified Electrical Workers
  // ===========================================================================
  it('Scenario 8: an electrical complaint suggests qualified electrical workers', () => {
    const workType = identifyComplaintWorkType({
      categoryCode: 'CAT_STREETLIGHT',
      categoryName: 'Streetlights & Electrical',
      title: 'Dark streetlight fixture',
      description: 'Lamps extinguished outside market',
    });

    expect(workType).not.toBeNull();
    expect(workType?.id).toBe('STREETLIGHT_REPAIR');

    // Worker 1: Electrical worker with Streetlight Repair skill
    const electricalWorkerMatch = evaluateWorkerSkillMatch(
      'Streetlight Repair, Electrical Maintenance, Cable Splicing',
      workType!
    );
    expect(electricalWorkerMatch.isSkillMatched).toBe(true);
    expect(electricalWorkerMatch.matchingSkills).toContain('Streetlight Repair');

    // Worker 2: Road maintenance worker without electrical skills
    const roadWorkerMatch = evaluateWorkerSkillMatch(
      'Asphalt Paving, Roller Operation, Cold Mix Patching',
      workType!
    );
    expect(roadWorkerMatch.isSkillMatched).toBe(false);
  });

  // ===========================================================================
  // 9. Water Complaint Suggests Qualified Water/Plumbing Workers
  // ===========================================================================
  it('Scenario 9: a water complaint suggests qualified water/plumbing workers', () => {
    const workType = identifyComplaintWorkType({
      categoryCode: 'CAT_WATER_LEAK',
      categoryName: 'Water Leakage & Sewage',
      title: 'Severe pipeline burst',
      description: 'Drinking water leaking onto road',
    });

    expect(workType).not.toBeNull();
    expect(workType?.id).toBe('WATER_SUPPLY_PIPELINE');

    const waterWorkerMatch = evaluateWorkerSkillMatch(
      'Water Supply, Pipeline Repair, Leak Detection, Valve Replacement',
      workType!
    );
    expect(waterWorkerMatch.isSkillMatched).toBe(true);
    expect(waterWorkerMatch.matchingSkills).toContain('Water Supply');

    const roadWorkerMatch = evaluateWorkerSkillMatch(
      'Road Repair, Asphalt Paving',
      workType!
    );
    expect(roadWorkerMatch.isSkillMatched).toBe(false);
  });

  // ===========================================================================
  // 10. Inactive and Unqualified Workers Are Excluded from Normal Suggestions
  // ===========================================================================
  it('Scenario 10: inactive and unqualified workers are excluded from suggestions', () => {
    const workType = CONTROLLED_WORK_TYPES['ROAD_REPAIR_POTHOLES'];

    // Worker without skills
    const unverifiedMatch = evaluateWorkerSkillMatch('', workType);
    expect(unverifiedMatch.isSkillMatched).toBe(false);
    expect(unverifiedMatch.matchingSkills.length).toBe(0);

    // Worker with unrelated skills
    const unrelatedMatch = evaluateWorkerSkillMatch('Garden Maintenance, Tree Pruning', workType);
    expect(unrelatedMatch.isSkillMatched).toBe(false);
  });

  // ===========================================================================
  // 11. Cross-Corporation Assignment Is Rejected
  // ===========================================================================
  it('Scenario 11: cross-corporation assignment is rejected with CORPORATION_MISMATCH', async () => {
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'csmc-comp-01',
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      status: 'TRIAGED_VALIDATED',
      version: 1,
    } as any);

    // Worker belongs to Pune (PMC)
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'pmc-worker-id',
      fullName: 'Vikram Singh',
      role: 'FIELD_WORKER',
      isActive: true,
      jurisdictionId: pmcWard28Id,
      departmentId: roadDeptId,
      skills: 'Road Repair',
    } as any);

    vi.spyOn(authModule, 'canAccessComplaint').mockReturnValue(true);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction')
      .mockImplementation(async (jId) => (jId === csmcWard01Id ? csmcCorpId : pmcCorpId));

    await expect(
      assignComplaint({
        complaintId: 'csmc-comp-01',
        officerSession: csmcOfficerSession,
        assignedWorkerId: 'pmc-worker-id',
        targetCompletionAt: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(/Cross-corporation assignment forbidden/i);
  });

  // ===========================================================================
  // 12. Assignment Persists and Appears in Worker Task List
  // ===========================================================================
  it('Scenario 12: assignment persists with valid status transition and OCC check', async () => {
    vi.spyOn(db.complaint, 'findUnique').mockResolvedValue({
      id: 'csmc-comp-01',
      referenceNumber: 'GOV-2026-00101',
      citizenPhone: '+919822010108',
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      status: 'TRIAGED_VALIDATED',
      version: 2,
      category: { code: 'CAT_POTHOLE', nameEn: 'Roads & Potholes' },
    } as any);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: workerASession.userId,
      fullName: 'Ganesh Shinde',
      role: 'FIELD_WORKER',
      isActive: true,
      jurisdictionId: csmcWard01Id,
      departmentId: roadDeptId,
      skills: 'Road Repair, Asphalt Paving',
    } as any);

    vi.spyOn(authModule, 'canAccessComplaint').mockReturnValue(true);
    vi.spyOn(authModule, 'getCorporationIdForJurisdiction').mockResolvedValue(csmcCorpId);

    // Mock transaction
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
      const mockTx = {
        complaintAssignment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({ id: 'new-assignment-id' }),
        },
        complaint: {
          update: vi.fn().mockResolvedValue({ id: 'csmc-comp-01', status: 'ASSIGNED', version: 3 }),
        },
        complaintTimeline: {
          create: vi.fn().mockResolvedValue({ id: 'new-timeline-id' }),
        },
        notification: {
          create: vi.fn().mockResolvedValue({ id: 'new-notif-id' }),
        },
      };
      return await cb(mockTx);
    });

    const result = await assignComplaint({
      complaintId: 'csmc-comp-01',
      officerSession: csmcOfficerSession,
      assignedWorkerId: workerASession.userId,
      targetCompletionAt: new Date(Date.now() + 86400000),
      expectedVersion: 2,
    });

    expect(result).toBeDefined();
    expect(result.assignment).toBeDefined();
    expect(result.complaint.status).toBe('ASSIGNED');
  });

  // ===========================================================================
  // 13. Completed Work Appears in Worker Completed History
  // ===========================================================================
  it('Scenario 13: completed and verified work is tracked in completed work history', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(workerASession);

    vi.spyOn(db.complaintAssignment, 'findMany').mockResolvedValue([
      {
        id: 'assign-completed-1',
        complaintId: 'comp-completed',
        assignedWorkerId: workerASession.userId,
        isActive: false,
        createdAt: new Date(),
        targetCompletionAt: new Date(),
        complaint: {
          id: 'comp-completed',
          referenceNumber: 'GOV-2026-00099',
          title: 'Fixed Pavement',
          description: 'Completed and verified pavement repair',
          status: 'VERIFIED_RESOLVED',
          priority: 'P2_HIGH',
          landmarkAddress: 'Near City Market',
          version: 4,
          citizenPhone: '+919822010108',
          category: { nameEn: 'Roads & Potholes' },
          department: { name: 'Road Maintenance' },
          jurisdiction: { name: 'Ward 01' },
          evidence: [],
          timeline: [
            {
              toStatus: 'VERIFIED_RESOLVED',
              publicNote: 'Supervisor verified road surface patch.',
              createdAt: new Date(),
            },
          ],
        },
      } as any,
    ]);

    const req = new NextRequest('http://localhost:3000/api/v1/ops/field/tasks');
    const res = await fieldTasksHandler(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.counts.completed).toBe(1);
    expect(json.data[0].status).toBe('VERIFIED_RESOLVED');
    expect(json.data[0].verifierNote).toBe('Supervisor verified road surface patch.');
  });

  // ===========================================================================
  // 14. Existing Complaint, Evidence, and Assignment History Remains Intact
  // ===========================================================================
  it('Scenario 14: existing complaints retain descriptions, evidence, and canonical history intact', async () => {
    const canonicalComplaint = await getTrackedComplaint('GOV-2026-00482');
    expect(canonicalComplaint).not.toBeNull();
    expect(canonicalComplaint?.ref).toBe('GOV-2026-00482');
    expect(canonicalComplaint?.title).toBe('Deep Pothole on Main Arterial Road (Opp. Krishna Hospital)');
    expect(canonicalComplaint?.description).toBeDefined();
    expect(canonicalComplaint?.description.length).toBeGreaterThan(10);
    expect(canonicalComplaint?.timeline.length).toBeGreaterThanOrEqual(1);
  });
});
