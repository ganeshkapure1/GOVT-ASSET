import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import { canAccessComplaint } from './auth';
import { executeStatusTransitionWithOcc, ComplaintStatus } from './fsm';
import { WorkflowError } from './complaint-service';
import { SYNTHETIC_BOUNDARY_DISCLAIMER } from '@/lib/constants';

export { SYNTHETIC_BOUNDARY_DISCLAIMER };

export interface DuplicateFinderOptions {
  complaintId?: string;
  latitude: number;
  longitude: number;
  categoryId?: string;
  maxDistanceMeters?: number;
  windowHours?: number;
  referenceDate?: Date;
  statusFilter?: ComplaintStatus[];
}

export interface DuplicateCandidate {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  priority: string;
  categoryId: string;
  categoryName: string;
  categoryCode?: string;
  landmarkAddress: string;
  distanceMeters: number;
  createdAt: string;
  isExactLocation: boolean;
  parentComplaintId?: string | null;
}

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 * Used for validation and as an offline fallback when PostGIS raw engine is unavailable.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Evaluates whether two complaints fall within the spatial duplicate window.
 * Default policy: <= 50 meters and <= 48 hours.
 */
export function isSpatialDuplicateCandidate(
  distanceMeters: number,
  timeDifferenceHours: number,
  maxDistance = 50,
  maxHours = 48
): boolean {
  return distanceMeters <= maxDistance && Math.abs(timeDifferenceHours) <= maxHours;
}

/**
 * Identifies potential duplicate complaints using PostGIS spatial clustering.
 * Finds complaints within 50 meters and 48 hours.
 */
export async function findPotentialDuplicates(
  options: DuplicateFinderOptions
): Promise<DuplicateCandidate[]> {
  const {
    complaintId,
    latitude,
    longitude,
    categoryId,
    maxDistanceMeters = 50,
    windowHours = 48,
    referenceDate = new Date(),
  } = options;

  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    return [];
  }

  const windowStart = new Date(referenceDate.getTime() - windowHours * 60 * 60 * 1000);
  const windowEnd = new Date(referenceDate.getTime() + windowHours * 60 * 60 * 1000);

  try {
    // Attempt PostGIS spatial query using geography casting for metric distance
    const safeComplaintFilter = complaintId ? `AND c.id != '${complaintId}'::uuid` : '';
    const safeCategoryFilter = categoryId ? `AND c.category_id = '${categoryId}'::uuid` : '';

    const rawRows = await db.$queryRawUnsafe<
      Array<{
        id: string;
        reference_number: string;
        title: string;
        status: string;
        priority: string;
        category_id: string;
        category_name: string;
        category_code: string;
        landmark_address: string;
        created_at: Date;
        parent_complaint_id: string | null;
        distance_meters: number;
      }>
    >(`
      SELECT
        c.id,
        c.reference_number,
        c.title,
        c.status,
        c.priority,
        c.category_id,
        cat.name_en AS category_name,
        cat.code AS category_code,
        c.landmark_address,
        c.created_at,
        c.parent_complaint_id,
        ROUND(
          ST_Distance(
            c.location_coords::geography,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          )::numeric,
          1
        )::float AS distance_meters
      FROM complaints c
      JOIN complaint_categories cat ON cat.id = c.category_id
      WHERE c.location_coords IS NOT NULL
        AND ST_DWithin(
          c.location_coords::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${maxDistanceMeters}
        )
        AND c.created_at >= '${windowStart.toISOString()}'::timestamptz
        AND c.created_at <= '${windowEnd.toISOString()}'::timestamptz
        AND c.status NOT IN ('REJECTED_INVALID', 'CLOSED', 'DUPLICATE_LINKED')
        ${safeComplaintFilter}
        ${safeCategoryFilter}
      ORDER BY distance_meters ASC
      LIMIT 10;
    `);

    if (rawRows && Array.isArray(rawRows)) {
      return rawRows.map((r) => ({
        id: r.id,
        referenceNumber: r.reference_number,
        title: r.title,
        status: r.status,
        priority: r.priority,
        categoryId: r.category_id,
        categoryName: r.category_name,
        categoryCode: r.category_code,
        landmarkAddress: r.landmark_address,
        distanceMeters: Number(r.distance_meters),
        createdAt: new Date(r.created_at).toISOString(),
        isExactLocation: Number(r.distance_meters) < 5,
        parentComplaintId: r.parent_complaint_id,
      }));
    }
  } catch (err) {
    // If PostGIS query fails or runs in a mock environment without active PostGIS tables,
    // execute fallback in-memory distance calculation against accessible complaints
  }

  // Fallback query via Prisma ORM + Haversine calculation
  try {
    const candidates = await db.complaint.findMany({
      where: {
        createdAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        status: {
          notIn: ['REJECTED_INVALID', 'CLOSED', 'DUPLICATE_LINKED'],
        },
        ...(complaintId ? { id: { not: complaintId } } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: { select: { nameEn: true, code: true } },
        timeline: {
          where: { toStatus: 'SUBMITTED' },
          select: { metadata: true },
          take: 1,
        },
      },
      take: 25,
    });

    const results: DuplicateCandidate[] = [];

    for (const c of candidates) {
      const meta = (c.timeline[0]?.metadata as any) || {};
      const cLat = typeof meta.latitude === 'number' ? meta.latitude : null;
      const cLng = typeof meta.longitude === 'number' ? meta.longitude : null;

      if (cLat !== null && cLng !== null) {
        const dist = calculateHaversineDistanceMeters(latitude, longitude, cLat, cLng);
        if (dist <= maxDistanceMeters) {
          results.push({
            id: c.id,
            referenceNumber: c.referenceNumber,
            title: c.title,
            status: c.status,
            priority: c.priority,
            categoryId: c.categoryId,
            categoryName: c.category.nameEn,
            categoryCode: c.category.code,
            landmarkAddress: c.landmarkAddress,
            distanceMeters: dist,
            createdAt: c.createdAt.toISOString(),
            isExactLocation: dist < 5,
            parentComplaintId: c.parentComplaintId,
          });
        }
      }
    }

    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch {
    return [];
  }
}

/**
 * Links a child complaint to an existing master ticket as a duplicate.
 * Enforces jurisdiction boundaries, FSM state transition, and OCC concurrency safety.
 */
export interface LinkDuplicateInput {
  childComplaintId: string;
  parentComplaintId: string;
  officerSession: UserSession;
  internalNote?: string;
  expectedVersion?: number;
}

export async function linkDuplicateComplaint(input: LinkDuplicateInput) {
  const { childComplaintId, parentComplaintId, officerSession, internalNote, expectedVersion } = input;

  if (childComplaintId === parentComplaintId) {
    throw new WorkflowError('INVALID_LINKAGE', 400, 'A complaint cannot be linked as a duplicate of itself.');
  }

  // Retrieve child complaint
  const child = await db.complaint.findUnique({
    where: { id: childComplaintId },
    include: { category: true },
  });

  if (!child) {
    throw new WorkflowError('COMPLAINT_NOT_FOUND', 404, 'Child complaint record not found.');
  }

  // Authorization check
  if (!canAccessComplaint(officerSession, child)) {
    throw new WorkflowError('FORBIDDEN', 403, 'You do not have jurisdiction authority over this complaint.');
  }

  // Retrieve master parent complaint
  const parent = await db.complaint.findUnique({
    where: { id: parentComplaintId },
  });

  if (!parent) {
    throw new WorkflowError('PARENT_NOT_FOUND', 404, 'Master complaint record not found.');
  }

  if (parent.status === 'DUPLICATE_LINKED') {
    throw new WorkflowError(
      'INVALID_PARENT',
      400,
      'Cannot link to a ticket that is itself already linked as a duplicate. Link to the root master ticket.'
    );
  }

  const ver = expectedVersion ?? child.version;

  return await db.$transaction(async (tx) => {
    // Execute FSM transition with OCC
    const updated = await executeStatusTransitionWithOcc(tx, {
      complaintId: childComplaintId,
      expectedVersion: ver,
      fromStatus: child.status as ComplaintStatus,
      toStatus: 'DUPLICATE_LINKED',
      actorId: officerSession.userId,
      actorRole: officerSession.role,
      publicNote: `Duplicate petition identified. Linked to master ticket ${parent.referenceNumber}.`,
      internalNote: internalNote || `Linked as duplicate of ${parent.referenceNumber} by ${officerSession.fullName}.`,
      additionalData: {
        parentComplaint: { connect: { id: parentComplaintId } },
      },
    });

    // Notify child citizen of duplicate grouping and master tracking reference
    await tx.notification.create({
      data: {
        recipientPhone: child.citizenPhone,
        channel: 'SMS',
        templateCode: 'COMPLAINT_DUPLICATE_LINKED',
        payload: {
          referenceNumber: child.referenceNumber,
          masterReferenceNumber: parent.referenceNumber,
        },
        status: 'PENDING',
      },
    });

    return updated;
  });
}
