import { NextRequest, NextResponse } from 'next/server';
import { verifyComplaint, WorkflowError } from '@/server/complaint-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { FsmError } from '@/server/fsm';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/v1/ops/complaints/[id]/verify
 *
 * Supervisor approves resolution or returns work order for rework.
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
    const session = await requireAuth(['SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN']);
    const body = await request.json();

    const { action, rejectionReason, notes } = body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Action must be APPROVE or REJECT.' } },
        { status: 400 }
      );
    }

    const updated = await verifyComplaint({
      complaintId: params.id,
      supervisorSession: session,
      action,
      rejectionReason,
      notes,
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to verify complaint.' } },
      { status: 500 }
    );
  }
}
