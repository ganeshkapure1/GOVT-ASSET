import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateHaversineDistanceMeters,
  isSpatialDuplicateCandidate,
  findPotentialDuplicates,
  linkDuplicateComplaint,
  SYNTHETIC_BOUNDARY_DISCLAIMER,
} from '@/server/duplicate-finder';
import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';

describe('Phase 5: Geospatial Duplicate Detection & Boundary Policy', () => {
  const officerSession: UserSession = {
    userId: 'usr-officer-01',
    email: 'officer@govasset.in',
    phoneNumber: '+919822010002',
    fullName: 'Sunita Patil',
    role: 'OFFICER',
    departmentId: 'dept-roads',
    jurisdictionId: 'ward-kothrud-28',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  describe('1. Synthetic Ward Boundary Disclaimer & Policy', () => {
    it('provides clear boundary disclaimer preventing false official demarcation claims', () => {
      expect(SYNTHETIC_BOUNDARY_DISCLAIMER).toBeDefined();
      expect(SYNTHETIC_BOUNDARY_DISCLAIMER).toContain('synthetic pilot approximations');
      expect(SYNTHETIC_BOUNDARY_DISCLAIMER).toContain('not be used for official municipal boundary assertions');
    });
  });

  describe('2. Geospatial Haversine Proximity Calculation', () => {
    // Mayur Colony, Kothrud reference coordinates
    const REF_LAT = 18.5089;
    const REF_LNG = 73.8077;

    it('calculates 0 meters for identical coordinates', () => {
      const dist = calculateHaversineDistanceMeters(REF_LAT, REF_LNG, REF_LAT, REF_LNG);
      expect(dist).toBe(0);
    });

    it('correctly calculates small distance (~25 meters) on the same street', () => {
      // 0.0002 deg latitude is roughly 22.2 meters
      const NEAR_LAT = REF_LAT + 0.0002;
      const dist = calculateHaversineDistanceMeters(REF_LAT, REF_LNG, NEAR_LAT, REF_LNG);
      expect(dist).toBeGreaterThan(15);
      expect(dist).toBeLessThan(35);
      expect(isSpatialDuplicateCandidate(dist, 12, 50, 48)).toBe(true);
    });

    it('rejects defects further than 50 meters (e.g. 250 meters away)', () => {
      // 0.002 deg latitude is roughly 222 meters
      const FAR_LAT = REF_LAT + 0.002;
      const dist = calculateHaversineDistanceMeters(REF_LAT, REF_LNG, FAR_LAT, REF_LNG);
      expect(dist).toBeGreaterThan(150);
      expect(isSpatialDuplicateCandidate(dist, 12, 50, 48)).toBe(false);
    });

    it('rejects complaints outside the 48-hour temporal window even if at exact same location', () => {
      const dist = 5; // 5 meters away
      const timeDiffHours = 52; // 52 hours ago (> 48h)
      expect(isSpatialDuplicateCandidate(dist, timeDiffHours, 50, 48)).toBe(false);
    });
  });

  describe('3. Duplicate Finder Query Service', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns empty array when invalid coordinates are supplied', async () => {
      const results = await findPotentialDuplicates({
        latitude: NaN,
        longitude: NaN,
      });
      expect(results).toEqual([]);
    });

    it('queries PostGIS and maps distance correctly when candidates exist within 50m and 48h', async () => {
      const mockRows = [
        {
          id: 'c-dup-01',
          reference_number: 'GOV-2026-00042',
          title: 'Deep pothole on Mayur Colony Road',
          status: 'SUBMITTED',
          priority: 'P2_HIGH',
          category_id: 'cat-roads-01',
          category_name: 'Damaged Roads & Potholes',
          category_code: 'CAT_POTHOLE',
          landmark_address: 'Opposite Krishna Hospital, Kothrud',
          created_at: new Date(Date.now() - 4 * 3600 * 1000), // 4h ago
          parent_complaint_id: null,
          distance_meters: 14.8,
        },
      ];

      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValueOnce(mockRows);

      const candidates = await findPotentialDuplicates({
        latitude: 18.5089,
        longitude: 73.8077,
        categoryId: 'cat-roads-01',
        maxDistanceMeters: 50,
        windowHours: 48,
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].referenceNumber).toBe('GOV-2026-00042');
      expect(candidates[0].distanceMeters).toBe(14.8);
      expect(candidates[0].isExactLocation).toBe(false);
    });

    it('flags defects with distance < 5 meters as exact location matches', async () => {
      const mockRows = [
        {
          id: 'c-dup-02',
          reference_number: 'GOV-2026-00043',
          title: 'Same pothole reported again',
          status: 'SUBMITTED',
          priority: 'P1_CRITICAL',
          category_id: 'cat-roads-01',
          category_name: 'Damaged Roads & Potholes',
          category_code: 'CAT_POTHOLE',
          landmark_address: 'Opposite Krishna Hospital, Kothrud',
          created_at: new Date(Date.now() - 1 * 3600 * 1000),
          parent_complaint_id: null,
          distance_meters: 2.1,
        },
      ];

      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValueOnce(mockRows);

      const candidates = await findPotentialDuplicates({
        latitude: 18.5089,
        longitude: 73.8077,
      });

      expect(candidates[0].isExactLocation).toBe(true);
      expect(candidates[0].distanceMeters).toBe(2.1);
    });
  });

  describe('4. Duplicate Linking Workflow & Safety Guardrails', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('prevents linking a complaint to itself', async () => {
      await expect(
        linkDuplicateComplaint({
          childComplaintId: 'c-self-01',
          parentComplaintId: 'c-self-01',
          officerSession,
        })
      ).rejects.toThrow('A complaint cannot be linked as a duplicate of itself');
    });

    it('prevents linking to a parent ticket that is itself already linked as a duplicate', async () => {
      vi.spyOn(db.complaint, 'findUnique')
        .mockResolvedValueOnce({
          id: 'c-child-01',
          referenceNumber: 'GOV-2026-00091',
          citizenPhone: '+919822010008',
          status: 'SUBMITTED',
          jurisdictionId: 'ward-kothrud-28',
          departmentId: 'dept-roads',
          version: 1,
        } as any)
        .mockResolvedValueOnce({
          id: 'c-parent-already-dup',
          referenceNumber: 'GOV-2026-00050',
          status: 'DUPLICATE_LINKED',
          version: 2,
        } as any);

      await expect(
        linkDuplicateComplaint({
          childComplaintId: 'c-child-01',
          parentComplaintId: 'c-parent-already-dup',
          officerSession,
        })
      ).rejects.toThrow(/Cannot link to a ticket that is itself already linked as a duplicate/);
    });

    it('prevents officer from linking duplicate if child complaint is outside their jurisdiction', async () => {
      vi.spyOn(db.complaint, 'findUnique').mockResolvedValueOnce({
        id: 'c-child-other-ward',
        referenceNumber: 'GOV-2026-00092',
        citizenPhone: '+919822010008',
        status: 'SUBMITTED',
        jurisdictionId: 'ward-shivaji-12', // Ward 12 vs Officer Ward 28
        departmentId: 'dept-roads',
        version: 1,
      } as any);

      await expect(
        linkDuplicateComplaint({
          childComplaintId: 'c-child-other-ward',
          parentComplaintId: 'c-master-01',
          officerSession,
        })
      ).rejects.toThrow(/jurisdiction authority/);
    });

    it('successfully links duplicate, transitions status to DUPLICATE_LINKED, and notifies citizen', async () => {
      const mockChild = {
        id: 'c-child-01',
        referenceNumber: 'GOV-2026-00099',
        citizenPhone: '+919822010008',
        status: 'SUBMITTED',
        jurisdictionId: 'ward-kothrud-28',
        departmentId: 'dept-roads',
        version: 1,
      };

      const mockParent = {
        id: 'c-master-01',
        referenceNumber: 'GOV-2026-00042',
        status: 'TRIAGED_VALIDATED',
        jurisdictionId: 'ward-kothrud-28',
        departmentId: 'dept-roads',
        version: 2,
      };

      vi.spyOn(db.complaint, 'findUnique')
        .mockResolvedValueOnce(mockChild as any)
        .mockResolvedValueOnce(mockParent as any);

      const mockTx = {
        complaint: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...mockChild,
            status: 'DUPLICATE_LINKED',
            parentComplaintId: 'c-master-01',
            version: 2,
          }),
        },
        complaintTimeline: {
          create: vi.fn().mockResolvedValue({ id: 'tl-dup-01' }),
        },
        notification: {
          create: vi.fn().mockResolvedValue({ id: 'notif-dup-01' }),
        },
      };

      vi.spyOn(db, '$transaction').mockImplementation(async (callback: any) => {
        return await callback(mockTx);
      });

      const result = await linkDuplicateComplaint({
        childComplaintId: 'c-child-01',
        parentComplaintId: 'c-master-01',
        officerSession,
      });

      expect(result.status).toBe('DUPLICATE_LINKED');
      expect(result.parentComplaintId).toBe('c-master-01');
      expect(mockTx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientPhone: '+919822010008',
          templateCode: 'COMPLAINT_DUPLICATE_LINKED',
          payload: {
            referenceNumber: 'GOV-2026-00099',
            masterReferenceNumber: 'GOV-2026-00042',
          },
        }),
      });
    });
  });
});
