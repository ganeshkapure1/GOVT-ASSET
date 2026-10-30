import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import * as authModule from '@/server/auth';
import {
  createComplaint,
  resolveCategory,
  getActiveCategories,
  isUuid,
  WorkflowError,
} from '@/server/complaint-service';
import { POST as complaintsPostHandler, GET as complaintsGetHandler } from '@/app/api/v1/complaints/route';
import { GET as categoriesGetHandler } from '@/app/api/v1/complaints/categories/route';
import { NextRequest } from 'next/server';

describe('Complaint Submission Category & UUID Regression Test Suite', () => {
  const roadCategoryId = '55555555-5555-5555-5555-555555550001';
  const roadDeptId = '44444444-4444-4444-4444-444444440001';
  const csmcWardId = '33333333-3333-3333-3333-333333330001';

  const mockRoadCategory = {
    id: roadCategoryId,
    code: 'CAT_POTHOLE',
    nameEn: 'Damaged Roads & Potholes',
    nameHi: 'खड्डे आणि खराब रस्ते',
    departmentId: roadDeptId,
    defaultPriority: 'P2_HIGH',
    isActive: true,
    department: {
      id: roadDeptId,
      code: 'ROAD_MAINTENANCE',
      name: 'Road Maintenance',
    },
    slaPolicies: [
      { priority: 'P1_CRITICAL', responseSlaHours: 2, resolutionSlaHours: 24, escalationHours: 18 },
      { priority: 'P2_HIGH', responseSlaHours: 4, resolutionSlaHours: 48, escalationHours: 36 },
      { priority: 'P3_MEDIUM', responseSlaHours: 12, resolutionSlaHours: 168, escalationHours: 120 },
      { priority: 'P4_LOW', responseSlaHours: 24, resolutionSlaHours: 336, escalationHours: 240 },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, 'getServerSession').mockResolvedValue(null);
    vi.spyOn(db, '$queryRawUnsafe').mockResolvedValue([{ id: csmcWardId }]);
  });

  // ===========================================================================
  // 1. REPRODUCE ORIGINAL FAILURE & VERIFY SAFE QUERY SHAPE
  // ===========================================================================
  describe('1. Reproduce Original Failure & Verify Query Shape', () => {
    it('isUuid accurately differentiates RFC 4122 UUIDs from non-UUID category codes', () => {
      // Valid UUIDs
      expect(isUuid('55555555-5555-5555-5555-555555550001')).toBe(true);
      expect(isUuid('c0ffee00-1234-5678-9abc-def012345678')).toBe(true);

      // Category codes and text strings that previously triggered Prisma query engine crash
      // "Inconsistent column data: Error creating UUID, invalid character: expected an optional prefix of urn:uuid: followed by [0-9a-fA-F-], found T at 3"
      expect(isUuid('CAT_ROADS')).toBe(false);
      expect(isUuid('CAT_POTHOLE')).toBe(false);
      expect(isUuid('CAT_STREETLIGHT')).toBe(false);
      expect(isUuid('CAT_DRAINAGE_WATER')).toBe(false);
      expect(isUuid('CAT_SANITATION')).toBe(false);
      expect(isUuid('CAT_BUILDINGS_PARKS')).toBe(false);
      expect(isUuid('CAT_DRAIN_COVERS')).toBe(false);
      expect(isUuid('pothole')).toBe(false);
      expect(isUuid('')).toBe(false);
      expect(isUuid(null as any)).toBe(false);
      expect(isUuid(undefined as any)).toBe(false);
    });

    it('resolveCategory never sends non-UUID code to { id: ... } filter', async () => {
      let capturedWhere: any = null;

      vi.spyOn(db.complaintCategory, 'findFirst').mockImplementation(((args: any) => {
        capturedWhere = args?.where;
        return Promise.resolve(mockRoadCategory);
      }) as any);

      const result = await resolveCategory('CAT_ROADS');
      expect(result.id).toBe(roadCategoryId);

      // Verify captured query structure: NO { id: 'CAT_ROADS' } in OR conditions!
      expect(capturedWhere).toBeDefined();
      expect(capturedWhere.OR).toBeDefined();

      const orItems = capturedWhere.OR;
      for (const item of orItems) {
        expect(item).not.toHaveProperty('id');
      }

      // Must query via text columns
      const codes = orItems.map((o: any) => o.code).filter(Boolean);
      expect(codes).toContain('CAT_POTHOLE');
      expect(codes).toContain('CAT_ROADS');
    });

    it('resolves all supported frontend category codes and legacy aliases', async () => {
      const codeMappings: Array<{ input: string; expectedTarget: string }> = [
        { input: 'CAT_ROADS', expectedTarget: 'CAT_POTHOLE' },
        { input: 'CAT_STREETLIGHT', expectedTarget: 'CAT_STREETLIGHT' },
        { input: 'CAT_DRAINAGE_WATER', expectedTarget: 'CAT_WATER_LEAK' },
        { input: 'CAT_SANITATION', expectedTarget: 'CAT_GARBAGE' },
        { input: 'CAT_BUILDINGS_PARKS', expectedTarget: 'CAT_PAVER_BLOCKS' },
        { input: 'CAT_DRAIN_COVERS', expectedTarget: 'CAT_DRAIN_GRATES' },
        { input: 'ROADS', expectedTarget: 'CAT_POTHOLE' },
        { input: 'POTHOLE', expectedTarget: 'CAT_POTHOLE' },
      ];

      for (const mapping of codeMappings) {
        let queriedCode: string | null = null;
        vi.spyOn(db.complaintCategory, 'findFirst').mockImplementation(((args: any) => {
          queriedCode = args?.where?.OR?.[0]?.code || null;
          return Promise.resolve({ ...mockRoadCategory, code: mapping.expectedTarget });
        }) as any);

        const cat = await resolveCategory(mapping.input);
        expect(cat.code).toBe(mapping.expectedTarget);
        expect(queriedCode).toBe(mapping.expectedTarget);
      }
    });
  });

  // ===========================================================================
  // 2. COMPLAINT SUBMISSION WITH VALID CATEGORY ID (UUID)
  // ===========================================================================
  describe('2. Submission with Valid Category UUID', () => {
    it('creates complaint successfully when category is supplied as a valid UUID', async () => {
      let findFirstWhere: any = null;
      vi.spyOn(db.complaintCategory, 'findFirst').mockImplementation(((args: any) => {
        findFirstWhere = args?.where;
        return Promise.resolve(mockRoadCategory);
      }) as any);

      vi.spyOn(db.jurisdiction, 'findFirst').mockResolvedValue({ id: csmcWardId } as any);
      vi.spyOn(db.complaint, 'count').mockResolvedValue(100);
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(null);

      let executedSql = '';
      let timelineCreated = false;
      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          $executeRawUnsafe: vi.fn().mockImplementation((sql: string) => {
            executedSql = sql;
            return Promise.resolve(1);
          }),
          complaintTimeline: {
            create: vi.fn().mockImplementation(() => {
              timelineCreated = true;
              return Promise.resolve({});
            }),
          },
          notification: { create: vi.fn().mockResolvedValue({}) },
          user: { findFirst: vi.fn().mockResolvedValue(null) },
        });
      });

      const complaint = await createComplaint({
        categoryId: roadCategoryId,
        description: 'Large surface cavity on Town Hall Road causing vehicle traffic blockage.',
        landmarkAddress: 'Town Hall Chowk, Near Ghati Hospital, Chhatrapati Sambhajinagar',
        citizenPhone: '+919822010020',
      });

      // Verify UUID lookup
      expect(findFirstWhere).toEqual({
        id: roadCategoryId,
        isActive: true,
      });

      expect(complaint.status).toBe('SUBMITTED');
      expect(complaint.referenceNumber).toMatch(/^GOV-20\d\d-\d{5}$/);
      expect(timelineCreated).toBe(true);
      expect(executedSql).toContain(`'${roadCategoryId}'::uuid`);
    });
  });

  // ===========================================================================
  // 3. COMPLAINT SUBMISSION WITH CODE OR SLUG
  // ===========================================================================
  describe('3. Submission with Category Code or Slug', () => {
    it('creates complaint successfully when category is supplied as a text code (CAT_ROADS)', async () => {
      vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue(mockRoadCategory as any);
      vi.spyOn(db.jurisdiction, 'findFirst').mockResolvedValue({ id: csmcWardId } as any);
      vi.spyOn(db.complaint, 'count').mockResolvedValue(101);
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(null);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
          user: { findFirst: vi.fn().mockResolvedValue(null) },
        });
      });

      const complaint = await createComplaint({
        category: 'CAT_ROADS',
        description: 'Dangerous pothole cluster near Mill Corner signal.',
        landmarkAddress: 'Mill Corner, Naralibag, Chhatrapati Sambhajinagar',
        citizenPhone: '+919822010022',
        isHazard: true,
      });

      expect(complaint.status).toBe('SUBMITTED');
      expect(complaint.priority).toBe('P1_CRITICAL'); // Hazard elevation
    });
  });

  // ===========================================================================
  // 4. INVALID OR MISSING CATEGORIES (FAIL-CLOSED INTEGRITY)
  // ===========================================================================
  describe('4. Invalid or Missing Category Fail-Closed Integrity', () => {
    it('rejects complaint submission with empty or whitespace category', async () => {
      const transactionSpy = vi.spyOn(db, '$transaction');

      await expect(
        createComplaint({
          category: '   ',
          description: 'Valid description of road cavity',
          landmarkAddress: 'Town Hall Chowk',
          citizenPhone: '+919822010020',
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'INVALID_CATEGORY',
        statusCode: 400,
      });

      // No database transaction was started
      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it('rejects complaint submission with non-existent category code without creating partial complaint', async () => {
      vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue(null);
      const transactionSpy = vi.spyOn(db, '$transaction');

      await expect(
        createComplaint({
          category: 'NON_EXISTENT_CATEGORY_CODE',
          description: 'Valid description of road defect',
          landmarkAddress: 'Town Hall Chowk',
          citizenPhone: '+919822010020',
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'CATEGORY_NOT_FOUND',
        statusCode: 400,
      });

      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it('rejects complaint submission when explicit categoryId is not a valid UUID', async () => {
      const transactionSpy = vi.spyOn(db, '$transaction');

      await expect(
        createComplaint({
          categoryId: 'invalid-non-uuid-string',
          description: 'Valid description of road defect',
          landmarkAddress: 'Town Hall Chowk',
          citizenPhone: '+919822010020',
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'INVALID_UUID',
        statusCode: 400,
      });

      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it('rejects complaint submission when explicit categoryId is not found in database', async () => {
      vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue(null);
      const transactionSpy = vi.spyOn(db, '$transaction');

      await expect(
        createComplaint({
          categoryId: '99999999-9999-9999-9999-999999999999',
          description: 'Valid description of road defect',
          landmarkAddress: 'Town Hall Chowk',
          citizenPhone: '+919822010020',
        })
      ).rejects.toMatchObject({
        name: 'WorkflowError',
        code: 'CATEGORY_NOT_FOUND',
        statusCode: 400,
      });

      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 5. API BOUNDARY VALIDATION & CATEGORY RETRIEVAL
  // ===========================================================================
  describe('5. API Boundary Validation & Dynamic Category Loading', () => {
    it('GET /api/v1/complaints/categories returns active database categories', async () => {
      vi.spyOn(db.complaintCategory, 'findMany').mockResolvedValue([
        mockRoadCategory as any,
        {
          id: '55555555-5555-5555-5555-555555550002',
          code: 'CAT_STREETLIGHT',
          nameEn: 'Streetlights & Electrical',
          department: { id: 'd2', name: 'Electrical', code: 'ELECTRICAL' },
        } as any,
      ]);

      const res = await categoriesGetHandler();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].id).toBe(roadCategoryId);
      expect(json.data[0].code).toBe('CAT_POTHOLE');
    });

    it('POST /api/v1/complaints validates categoryId format at the API boundary', async () => {
      vi.spyOn(authModule, 'getServerSession').mockResolvedValue({
        userId: 'c1111111-1111-1111-1111-111111111111',
        role: 'CITIZEN',
        phoneNumber: '+919822010020',
        fullName: 'Test Citizen',
        email: null,
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });

      const req = new NextRequest('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          categoryId: 'not-a-valid-uuid',
          description: 'Road damage near Town Hall',
          landmarkAddress: 'Town Hall Road',
          citizenPhone: '+919822010020',
        }),
      });

      const res = await complaintsPostHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_UUID');
      expect(json.error.message).toMatch(/valid UUID/i);
    });

    it('POST /api/v1/complaints creates complaint via category code and returns 200', async () => {
      vi.spyOn(authModule, 'getServerSession').mockResolvedValue({
        userId: 'c1111111-1111-1111-1111-111111111111',
        role: 'CITIZEN',
        phoneNumber: '+919822010020',
        fullName: 'Test Citizen',
        email: null,
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });

      vi.spyOn(db.complaintCategory, 'findFirst').mockResolvedValue(mockRoadCategory as any);
      vi.spyOn(db.jurisdiction, 'findFirst').mockResolvedValue({ id: csmcWardId } as any);
      vi.spyOn(db.complaint, 'count').mockResolvedValue(105);
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValue(null);

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          complaintTimeline: { create: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
          user: { findFirst: vi.fn().mockResolvedValue(null) },
        });
      });

      const req = new NextRequest('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          category: 'CAT_ROADS',
          description: 'Sunken utility trench on Kranti Chowk junction',
          landmarkAddress: 'Kranti Chowk, Chhatrapati Sambhajinagar',
          citizenPhone: '+919822010020',
        }),
      });

      const res = await complaintsPostHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('SUBMITTED');
      expect(json.data.referenceNumber).toMatch(/^GOV-20\d\d-\d{5}$/);
    });

    it('POST /api/v1/complaints rejects unauthenticated requests with 401 Unauthorized', async () => {
      vi.spyOn(authModule, 'getServerSession').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          category: 'CAT_ROADS',
          description: 'Road damage near Town Hall',
          landmarkAddress: 'Town Hall Road',
          citizenPhone: '+919822010020',
        }),
      });

      const res = await complaintsPostHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });
});
