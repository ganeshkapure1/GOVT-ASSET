import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, AuthError } from '@/server/auth';
import { maskPhoneNumber } from '@/lib/pii';

/**
 * GET /api/v1/ops/field/tasks
 *
 * Returns tasks strictly assigned to the authenticated field worker.
 * Provides active tasks, jobs awaiting verification, and historical completed tasks.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['FIELD_WORKER', 'PLATFORM_ADMIN', 'OFFICER', 'SUPERVISOR']);
    const searchParams = request.nextUrl.searchParams;
    const workerIdParam = searchParams.get('workerId');

    // Security invariant: A FIELD_WORKER can strictly ONLY read their own assigned work
    const targetWorkerId =
      session.role === 'FIELD_WORKER'
        ? session.userId
        : workerIdParam || session.userId;

    const assignments = await db.complaintAssignment.findMany({
      where: {
        assignedWorkerId: targetWorkerId,
      },
      include: {
        complaint: {
          include: {
            category: true,
            department: true,
            jurisdiction: true,
            evidence: true,
            timeline: {
              orderBy: { createdAt: 'desc' },
              take: 6,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tasks = assignments.map((a) => {
      const timelineList = a.complaint?.timeline || [];
      const verifiedEntry = timelineList.find(
        (t) => t.toStatus === 'VERIFIED_RESOLVED' || t.toStatus === 'CLOSED'
      );
      const submittedEntry = timelineList.find(
        (t) => t.toStatus === 'WORK_COMPLETED'
      );

      const evidenceList = a.complaint?.evidence || [];

      return {
        assignmentId: a.id,
        complaintId: a.complaint?.id || a.complaintId,
        ref: a.complaint?.referenceNumber || '',
        title: a.complaint?.title || '',
        description: a.complaint?.description || '',
        category: a.complaint?.category?.nameEn || 'General Civic Issue',
        department: a.complaint?.department?.name || 'Municipal Works',
        ward: a.complaint?.jurisdiction?.name || 'Assigned Area',
        locality: a.complaint?.landmarkAddress || 'Assigned Site',
        location: a.complaint?.jurisdiction?.name || 'Local Jurisdiction',
        status: a.complaint?.status || 'ASSIGNED',
        priority: a.complaint?.priority || 'P2_HIGH',
        landmarkAddress: a.complaint?.landmarkAddress || '',
        version: a.complaint?.version || 1,
        assignedAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString(),
        targetCompletionAt: a.targetCompletionAt ? a.targetCompletionAt.toISOString() : new Date().toISOString(),
        workerNotes: a.workerNotes,
        citizenPhone: a.complaint?.citizenPhone ? maskPhoneNumber(a.complaint.citizenPhone) : '',
        evidence: evidenceList.map((e) => ({
          id: e.id,
          stage: e.stage,
          fileKey: e.fileKey,
          mimeType: e.mimeType,
          isVerifiedProximity: Boolean(e.isVerifiedProximity),
          createdAt: e.createdAt ? e.createdAt.toISOString() : new Date().toISOString(),
        })),
        completedAt: submittedEntry ? submittedEntry.createdAt.toISOString() : null,
        verifiedAt: verifiedEntry ? verifiedEntry.createdAt.toISOString() : null,
        verifierNote: verifiedEntry?.publicNote || null,
        isActiveAssignment: a.isActive,
      };
    });

    const counts = {
      assigned: tasks.filter((t) => t.status === 'ASSIGNED' && t.isActiveAssignment).length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS' && t.isActiveAssignment).length,
      awaitingVerification: tasks.filter((t) => t.status === 'WORK_COMPLETED').length,
      completed: tasks.filter((t) => t.status === 'VERIFIED_RESOLVED' || t.status === 'CLOSED').length,
      total: tasks.length,
    };

    return NextResponse.json({
      success: true,
      data: tasks,
      counts,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve field tasks.' } },
      { status: 500 }
    );
  }
}
