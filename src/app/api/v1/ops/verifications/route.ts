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
    const session = await requireAuth(['SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);

    const whereConditions: any = {
      status: 'WORK_COMPLETED',
    };

    if (session.departmentId && session.role !== 'PLATFORM_ADMIN') {
      whereConditions.departmentId = session.departmentId;
    }

    if (session.role === 'SUPERVISOR' && session.jurisdictionId) {
      const childWards = await db.jurisdiction.findMany({
        where: { parentId: session.jurisdictionId },
        select: { id: true },
      });
      const allowedWardIds = [session.jurisdictionId, ...childWards.map((w) => w.id)];
      whereConditions.jurisdictionId = { in: allowedWardIds };
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
