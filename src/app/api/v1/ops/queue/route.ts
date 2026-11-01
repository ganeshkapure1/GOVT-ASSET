import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, getCorporationIdForJurisdiction } from '@/server/auth';
import { db } from '@/lib/db';
import { maskPhoneNumber } from '@/lib/pii';

/**
 * GET /api/v1/ops/queue
 *
 * Returns operational complaints queue and dynamic dashboard metrics strictly
 * scoped to the authenticated officer's or supervisor's authorized corporation,
 * ward, and department.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth([
      'OFFICER',
      'SUPERVISOR',
      'DEPT_ADMIN',
      'PLATFORM_ADMIN',
    ]);

    const { searchParams } = new URL(request.url);
    const wardParam = searchParams.get('wardId');
    const deptParam = searchParams.get('departmentId');
    const statusParam = searchParams.get('status');
    const searchParam = searchParams.get('search')?.trim().toLowerCase();

    // 1. Resolve user's Corporation Scope
    let corporationId: string | null = null;
    let corpJurisdictionIds: string[] = [];

    if (session.role !== 'PLATFORM_ADMIN') {
      if (session.jurisdictionId) {
        corporationId = await getCorporationIdForJurisdiction(session.jurisdictionId);
      }

      if (corporationId) {
        const corpRecord = typeof db.jurisdiction?.findUnique === 'function'
          ? await db.jurisdiction.findUnique({
              where: { id: corporationId },
              select: { name: true, city: true },
            }).catch(() => null)
          : null;

        const siblingCorps = corpRecord
          ? await db.jurisdiction.findMany({
              where: {
                level: 'DISTRICT_CORP',
                OR: [
                  { id: corporationId },
                  ...(corpRecord.city ? [{ city: corpRecord.city }] : []),
                  { name: { equals: corpRecord.name, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            }).catch(() => [])
          : [];

        const allCorpIds = Array.from(new Set([corporationId, ...siblingCorps.map((c) => c.id)]));

        // Find all constituent zone IDs for this corporation
        const zones = await db.jurisdiction.findMany({
          where: { parentId: { in: allCorpIds }, level: 'ZONE' },
          select: { id: true },
        }).catch(() => []);
        const zoneIds = zones.map((z) => z.id);

        // Find all constituent jurisdictions under these zones or directly under corporation
        const childJurs = await db.jurisdiction.findMany({
          where: {
            OR: [
              { parentId: { in: zoneIds } },
              { parentId: { in: allCorpIds } },
            ],
          },
          select: { id: true },
        }).catch(() => []);
        corpJurisdictionIds = [
          ...allCorpIds,
          ...zoneIds,
          ...childJurs.map((w) => w.id),
        ];
      }
    }

    // 2. Build whereConditions
    const whereConditions: any = {};

    // Jurisdiction filtering
    if (session.role === 'PLATFORM_ADMIN') {
      if (wardParam && wardParam !== 'all') {
        const selectedJur = typeof db.jurisdiction?.findUnique === 'function'
          ? await db.jurisdiction.findUnique({
              where: { id: wardParam },
              select: { id: true, level: true },
            }).catch(() => null)
          : null;
        if (selectedJur && (selectedJur.level === 'DISTRICT_CORP' || selectedJur.level === 'STATE')) {
          const childWards = await db.jurisdiction.findMany({
            where: {
              OR: [
                { id: wardParam },
                { parentId: wardParam },
              ],
            },
            select: { id: true },
          }).catch(() => []);
          whereConditions.jurisdictionId = { in: childWards.map((c) => c.id) };
        } else {
          whereConditions.jurisdictionId = wardParam;
        }
      }
    } else {
      if (wardParam && wardParam !== 'all') {
        // Enforce corporation boundary if specific jurisdiction is requested
        const targetCorpId = await getCorporationIdForJurisdiction(wardParam);
        if (targetCorpId && corporationId && targetCorpId !== corporationId) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'CORPORATION_MISMATCH',
                message: 'Unauthorized: Cannot query complaints across municipal corporation boundaries.',
              },
            },
            { status: 403 }
          );
        }
        whereConditions.jurisdictionId = wardParam;
      } else if (corpJurisdictionIds.length > 0) {
        // Scoped within the user's corporation across all constituent areas
        whereConditions.jurisdictionId = { in: corpJurisdictionIds };
      } else if (session.jurisdictionId) {
        whereConditions.jurisdictionId = session.jurisdictionId;
      }
    }

    // Department filtering
    if (deptParam && deptParam !== 'all') {
      whereConditions.departmentId = deptParam;
    }
    // Default: show complaints across all civic categories (do not lock to single department)

    // Status filtering
    if (statusParam && statusParam !== 'all') {
      whereConditions.status = statusParam;
    }

    // Search filtering
    if (searchParam) {
      whereConditions.OR = [
        { referenceNumber: { contains: searchParam, mode: 'insensitive' } },
        { title: { contains: searchParam, mode: 'insensitive' } },
        { description: { contains: searchParam, mode: 'insensitive' } },
        { landmarkAddress: { contains: searchParam, mode: 'insensitive' } },
      ];
    }

    // 3. Fetch complaints matching scope
    const complaints = await db.complaint.findMany({
      where: whereConditions,
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        landmarkAddress: true,
        jurisdictionId: true,
        departmentId: true,
        citizenPhone: true,
        version: true,
        createdAt: true,
        resolutionDueAt: true,
        category: { select: { id: true, nameEn: true, code: true } },
        jurisdiction: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        assignments: {
          where: { isActive: true },
          select: {
            id: true,
            assignedWorker: {
              select: { id: true, fullName: true, staffCode: true, designation: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 4. Compute Metrics for the active corporation scope
    // We compute metrics based on corporation & department scope (or whereConditions)
    const metricsBaseWhere: any = {};
    if (whereConditions.jurisdictionId) {
      metricsBaseWhere.jurisdictionId = whereConditions.jurisdictionId;
    } else if (session.role !== 'OFFICER' && session.role !== 'PLATFORM_ADMIN' && corpJurisdictionIds.length > 0) {
      metricsBaseWhere.jurisdictionId = { in: corpJurisdictionIds };
    }
    if (whereConditions.departmentId) {
      metricsBaseWhere.departmentId = whereConditions.departmentId;
    }

    const allScopedComplaints = await db.complaint.findMany({
      where: metricsBaseWhere,
      select: {
        id: true,
        status: true,
        categoryId: true,
        category: { select: { nameEn: true } },
      },
    });

    let pendingCount = 0;
    let inProgressCount = 0;
    let solvedCount = 0;
    const categoryCounts: Record<string, number> = {};

    for (const c of allScopedComplaints) {
      if (c.status === 'SUBMITTED' || c.status === 'TRIAGED_VALIDATED') {
        pendingCount++;
      } else if (c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS') {
        inProgressCount++;
      } else if (c.status === 'WORK_COMPLETED' || c.status === 'VERIFIED_RESOLVED' || c.status === 'CLOSED') {
        solvedCount++;
      }

      const catName = c.category?.nameEn || 'Other Civic Issues';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
    }

    const totalCount = allScopedComplaints.length;
    const categoryPalette = [
      'bg-[#0B4FC2] dark:bg-blue-500',
      'bg-[#F97316] dark:bg-orange-500',
      'bg-[#10B981] dark:bg-emerald-500',
      'bg-[#06B6D4] dark:bg-cyan-500',
      'bg-[#8B5CF6] dark:bg-purple-500',
    ];

    const categoryBreakdown = Object.entries(categoryCounts).map(([name, count], index) => ({
      name,
      count,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      color: categoryPalette[index % categoryPalette.length],
    }));

    // 5. Sanitize complaints PII
    const sanitized = complaints.map((c) => ({
      ...c,
      ref: c.referenceNumber,
      citizenPhone: maskPhoneNumber(c.citizenPhone),
      assignedWorker: c.assignments[0]?.assignedWorker?.fullName || null,
      assignedWorkerId: c.assignments[0]?.assignedWorker?.id || null,
      assignedWorkerDesignation: c.assignments[0]?.assignedWorker?.designation || null,
    }));

    return NextResponse.json({
      success: true,
      data: sanitized,
      metrics: {
        pendingCount,
        inProgressCount,
        solvedCount,
        totalCount,
        categoryBreakdown,
      },
      scope: {
        role: session.role,
        departmentId: session.departmentId,
        jurisdictionId: session.jurisdictionId,
        corporationId,
        appliedWardFilter: wardParam || session.jurisdictionId || 'all',
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to retrieve queue.' } },
      { status: 500 }
    );
  }
}
