import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, getCorporationIdForJurisdiction, verifyCsrfProtection } from '@/server/auth';
import { db } from '@/lib/db';
import { maskPhoneNumber } from '@/lib/pii';
import { inviteStaffUser, updateStaffAccess, AdminServiceError } from '@/server/admin-service';

/**
 * GET /api/v1/ops/workers
 * Retrieves field workers for assignment and crew management, scoped by corporation and department.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);
    const searchParams = request.nextUrl.searchParams;
    const rawDept = searchParams.get('departmentId');
    const departmentId = rawDept === 'all' ? undefined : (rawDept || (session.role === 'FIELD_WORKER' ? session.departmentId : undefined));
    const requestedCorpId = searchParams.get('corporationId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeTasks = searchParams.get('includeTasks') === 'true';
    const search = searchParams.get('search')?.trim().toLowerCase();

    // Resolve user's authorized corporation scope
    let corporationId: string | null = null;
    if (session.role !== 'PLATFORM_ADMIN') {
      corporationId = await getCorporationIdForJurisdiction(session.jurisdictionId);
    } else if (requestedCorpId && requestedCorpId !== 'all') {
      corporationId = requestedCorpId;
    }

    // Build filter
    const where: any = {
      role: 'FIELD_WORKER',
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { staffCode: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { skills: { contains: search, mode: 'insensitive' } },
      ];
    }

    const workers = await db.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        staffCode: true,
        designation: true,
        skills: true,
        isActive: true,
        departmentId: true,
        jurisdictionId: true,
        createdAt: true,
        department: { select: { id: true, name: true, code: true } },
        jurisdiction: { select: { id: true, name: true, code: true, level: true, parentId: true } },
        assignedWorkOrders: {
          select: {
            id: true,
            isActive: true,
            targetCompletionAt: true,
            createdAt: true,
            complaint: {
              select: {
                id: true,
                referenceNumber: true,
                title: true,
                status: true,
                priority: true,
                landmarkAddress: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    // Corporation Tenant Isolation: filter workers belonging to this corporation
    let filteredWorkers = workers;
    if (corporationId) {
      const allowedWorkers: typeof workers = [];
      for (const w of workers) {
        if (!w.jurisdictionId) {
          continue;
        }
        const workerCorpId = await getCorporationIdForJurisdiction(w.jurisdictionId);
        if (workerCorpId === corporationId) {
          allowedWorkers.push(w);
        }
      }
      filteredWorkers = allowedWorkers;
    }

    const result = filteredWorkers.map((w) => ({
      id: w.id,
      fullName: w.fullName,
      email: w.email,
      phoneNumber:
        session.role === 'PLATFORM_ADMIN' ||
        session.role === 'DEPT_ADMIN' ||
        session.role === 'SUPERVISOR' ||
        session.role === 'OFFICER'
          ? w.phoneNumber
          : maskPhoneNumber(w.phoneNumber),
      staffCode: w.staffCode || null,
      designation: w.designation || 'Field Crew Specialist',
      skills: w.skills || 'Civil Maintenance',
      isActive: w.isActive,
      departmentId: w.departmentId,
      departmentName: w.department?.name || 'Unassigned',
      jurisdictionId: w.jurisdictionId,
      wardName: w.jurisdiction?.name || 'Unassigned Ward',
      activeWorkload: w.assignedWorkOrders.filter(
        (a) => a.isActive !== false && ['ASSIGNED', 'IN_PROGRESS'].includes(a.complaint?.status || '')
      ).length,
      assignedTasks: includeTasks
        ? w.assignedWorkOrders
            .filter((a) => a.isActive !== false && ['ASSIGNED', 'IN_PROGRESS'].includes(a.complaint?.status || ''))
            .map((a) => ({
              assignmentId: a.id,
              complaintId: a.complaint?.id || '',
              ref: a.complaint?.referenceNumber || '',
              title: a.complaint?.title || '',
              status: a.complaint?.status || 'ASSIGNED',
              priority: a.complaint?.priority || 'P2_HIGH',
              landmark: a.complaint?.landmarkAddress || '',
              targetCompletionAt: a.targetCompletionAt,
            }))
        : undefined,
      completedTasks: includeTasks
        ? w.assignedWorkOrders
            .filter((a) => ['WORK_COMPLETED', 'VERIFIED_RESOLVED', 'CLOSED'].includes(a.complaint?.status || ''))
            .map((a) => ({
              assignmentId: a.id,
              complaintId: a.complaint?.id || '',
              ref: a.complaint?.referenceNumber || '',
              title: a.complaint?.title || '',
              status: a.complaint?.status || 'VERIFIED_RESOLVED',
              priority: a.complaint?.priority || 'P2_HIGH',
              landmark: a.complaint?.landmarkAddress || '',
              completedAt: a.complaint?.updatedAt,
            }))
        : undefined,
      createdAt: w.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve eligible workers.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/ops/workers
 * Onboards / invites a new field worker to the officer's corporation & department.
 */
export async function POST(request: NextRequest) {
  if (!verifyCsrfProtection(request)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked by CSRF security policy.' },
      },
      { status: 403 }
    );
  }

  try {
    const session = await requireAuth(['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);
    const body = await request.json();

    // Corporation isolation: Non-platform admins cannot onboard workers into other corporations
    if (session.role !== 'PLATFORM_ADMIN' && session.role !== 'OFFICER') {
      const sessionCorpId = await getCorporationIdForJurisdiction(session.jurisdictionId);
      const targetWardId = body.jurisdictionId || session.jurisdictionId;
      if (targetWardId) {
        const targetCorpId = await getCorporationIdForJurisdiction(targetWardId);
        if (sessionCorpId && targetCorpId && sessionCorpId !== targetCorpId) {
          return NextResponse.json(
            {
              success: false,
              error: { code: 'FORBIDDEN', message: 'Unauthorized: Cannot create workers in a different municipal corporation.' },
            },
            { status: 403 }
          );
        }
      }
    }

    // Default role is FIELD_WORKER for this endpoint
    const created = await inviteStaffUser(session, {
      ...body,
      role: 'FIELD_WORKER',
      departmentId: body.departmentId || session.departmentId || undefined,
      jurisdictionId: body.jurisdictionId || session.jurisdictionId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Field worker "${created.fullName}" onboarded successfully.`,
        data: created,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to onboard field worker.' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/ops/workers
 * Updates field worker active status, designation, skills, or staff code.
 */
export async function PUT(request: NextRequest) {
  if (!verifyCsrfProtection(request)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked by CSRF security policy.' },
      },
      { status: 403 }
    );
  }

  try {
    const session = await requireAuth(['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);
    const body = await request.json();
    const { workerId, isActive, designation, skills, staffCode } = body;

    if (!workerId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Worker ID is required.' } },
        { status: 400 }
      );
    }

    const updated = await updateStaffAccess(session, workerId, {
      isActive,
      designation,
      skills,
      staffCode,
    });

    return NextResponse.json({
      success: true,
      message: `Worker account status updated.`,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to update worker.' } },
      { status: 500 }
    );
  }
}
