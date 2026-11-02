import { NextRequest, NextResponse } from 'next/server';
import { assignComplaint, WorkflowError } from '@/server/complaint-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { FsmError } from '@/server/fsm';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/v1/ops/complaints/[id]/assign
 *
 * Assigns an eligible field crew worker to a complaint work order.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const session = await requireAuth(
      ['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN'],
      { checkFreshness: true }
    );
    const body = await request.json();

    const workerId = body.assignedWorkerId || body.assignedToId;

    if (!workerId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'A designated field worker ID is required.' } },
        { status: 400 }
      );
    }

    const targetDate = body.targetCompletionAt
      ? new Date(body.targetCompletionAt)
      : new Date(Date.now() + 24 * 3600 * 1000);

    const result = await assignComplaint({
      complaintId: params.id,
      officerSession: session,
      assignedWorkerId: workerId,
      targetCompletionAt: targetDate,
      workerNotes: body.workerNotes,
      expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
      allowSkillOverride: Boolean(body.allowSkillOverride),
      overrideReason: body.overrideReason,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof WorkflowError || err instanceof FsmError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to assign complaint.' } },
      { status: 500 }
    );
  }
}
