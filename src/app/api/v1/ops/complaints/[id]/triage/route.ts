import { NextRequest, NextResponse } from 'next/server';
import { triageComplaint, WorkflowError } from '@/server/complaint-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { FsmError } from '@/server/fsm';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/v1/ops/complaints/[id]/triage
 *
 * Triage validation or rejection by Ward Triage Officers or Supervisors.
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
    const session = await requireAuth(['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);
    const body = await request.json();

    const updated = await triageComplaint({
      complaintId: params.id,
      officerSession: session,
      action: body.action || 'VALIDATE',
      priority: body.priority,
      rejectionReason: body.rejectionReason,
      internalNote: body.internalNote,
      parentComplaintId: body.parentComplaintId,
      expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof WorkflowError || err instanceof FsmError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to triage complaint.' } },
      { status: 500 }
    );
  }
}
