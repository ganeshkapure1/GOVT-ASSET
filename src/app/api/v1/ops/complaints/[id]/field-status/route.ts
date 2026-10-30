import { NextRequest, NextResponse } from 'next/server';
import { updateFieldTask, WorkflowError } from '@/server/complaint-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { FsmError } from '@/server/fsm';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/v1/ops/complaints/[id]/field-status
 *
 * Field worker status transitions (START_WORK, COMPLETE_WORK).
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
    const session = await requireAuth(['FIELD_WORKER', 'PLATFORM_ADMIN']);
    const body = await request.json();

    const {
      action,
      workerNotes,
      evidenceFileKey,
      evidenceMimeType,
      evidenceFileSizeBytes,
      workerLatitude,
      workerLongitude,
      gpsAccuracyMeters,
      expectedVersion,
    } = body;

    if (!action || !['START_WORK', 'COMPLETE_WORK'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Action must be START_WORK or COMPLETE_WORK.' },
        },
        { status: 400 }
      );
    }

    const updated = await updateFieldTask({
      complaintId: params.id,
      workerSession: session,
      action,
      workerNotes,
      evidenceFileKey,
      evidenceMimeType,
      evidenceFileSizeBytes,
      workerLatitude: typeof workerLatitude === 'number' ? workerLatitude : undefined,
      workerLongitude: typeof workerLongitude === 'number' ? workerLongitude : undefined,
      gpsAccuracyMeters: typeof gpsAccuracyMeters === 'number' ? gpsAccuracyMeters : undefined,
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to update field status.' } },
      { status: 500 }
    );
  }
}
