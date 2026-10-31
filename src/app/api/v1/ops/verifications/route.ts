import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/server/auth';
import { maskPhoneNumber } from '@/lib/pii';

/**
 * GET /api/v1/ops/verifications
 *
 * Returns complaints awaiting physical verification by supervisors (WORK_COMPLETED status).
 */
export async function GET() {
  try {
    const session = await requireAuth(['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);

    const whereConditions: any = {
      status: 'WORK_COMPLETED',
    };

    if (session.departmentId && session.role !== 'PLATFORM_ADMIN' && session.role !== 'OFFICER') {
      whereConditions.departmentId = session.departmentId;
    }

    if (session.jurisdictionId && session.role !== 'PLATFORM_ADMIN' && session.role !== 'OFFICER') {
      const { getCorporationIdForJurisdiction } = await import('@/server/auth');
      const corporationId = await getCorporationIdForJurisdiction(session.jurisdictionId);
      if (corporationId) {
        const corpRecord = await db.jurisdiction.findUnique({
          where: { id: corporationId },
          select: { name: true, city: true },
        });

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
            })
          : [];

        const allCorpIds = Array.from(new Set([corporationId, ...siblingCorps.map((c) => c.id)]));

        const zones = await db.jurisdiction.findMany({
          where: { parentId: { in: allCorpIds }, level: 'ZONE' },
          select: { id: true },
        });
        const zoneIds = zones.map((z) => z.id);

        const childJurs = await db.jurisdiction.findMany({
          where: {
            OR: [
              { parentId: { in: zoneIds } },
              { parentId: { in: allCorpIds } },
            ],
          },
          select: { id: true },
        });

        const allowedJurIds = [
          ...allCorpIds,
          ...zoneIds,
          ...childJurs.map((w) => w.id),
        ];
        whereConditions.jurisdictionId = { in: allowedJurIds };
      } else {
        whereConditions.jurisdictionId = session.jurisdictionId;
      }
    }

    const complaints = await db.complaint.findMany({
      where: whereConditions,
      include: {
        category: true,
        jurisdiction: true,
        department: true,
        evidence: {
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          where: { isActive: true },
          include: {
            assignedWorker: { select: { fullName: true, phoneNumber: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = complaints.map((c) => ({
      id: c.id,
      ref: c.referenceNumber,
      title: c.title,
      category: c.category.nameEn,
      ward: c.jurisdiction.name,
      landmark: c.landmarkAddress,
      completedBy: c.assignments[0]?.assignedWorker?.fullName || 'Field Worker',
      completedAt: c.updatedAt.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      workerNotes: c.assignments[0]?.workerNotes || null,
      beforeEvidence: c.evidence.filter((e) => e.stage === 'BEFORE_SUBMISSION'),
      afterEvidence: c.evidence.filter((e) => e.stage === 'AFTER_REPAIR'),
      citizenPhone: maskPhoneNumber(c.citizenPhone),
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve verification queue.' } },
      { status: 500 }
    );
  }
}
