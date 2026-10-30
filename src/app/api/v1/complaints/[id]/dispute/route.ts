import { NextRequest, NextResponse } from 'next/server';
import { disputeComplaint, WorkflowError } from '@/server/complaint-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { FsmError } from '@/server/fsm';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/v1/complaints/[id]/dispute
 *
 * Allows authenticated citizens to dispute a complaint within 7 calendar days
 * of resolution verification.
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
    const session = await requireAuth(['CITIZEN', 'PLATFORM_ADMIN']);
    const body = await request.json();

    const { disputeReason, evidenceFileKey, expectedVersion } = body;

    const updated = await disputeComplaint({
      complaintId: params.id,
      citizenSession: session,
      disputeReason,
      evidenceFileKey,
      expectedVersion: typeof expectedVersion === 'number' ? expectedVersion : undefined,
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to submit dispute.' } },
      { status: 500 }
    );
  }
}
