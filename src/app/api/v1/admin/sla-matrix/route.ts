import { NextRequest, NextResponse } from 'next/server';
import {
  getSlaPoliciesMatrix,
  updateSlaPolicy,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

/**
 * GET /api/v1/admin/sla-matrix
 * Returns categories with their P1-P4 SLA policies.
 */
export async function GET() {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'OFFICER']);
    const matrix = await getSlaPoliciesMatrix();

    return NextResponse.json({
      success: true,
      data: matrix,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve SLA policy matrix.' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/sla-matrix
 * Updates turnaround hours for category & priority tuple.
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
    const session = await requireAuth(['PLATFORM_ADMIN']);
    const body = await request.json();

    const updated = await updateSlaPolicy(session, body);

    return NextResponse.json({
      success: true,
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update SLA policy.' } },
      { status: 500 }
    );
  }
}
