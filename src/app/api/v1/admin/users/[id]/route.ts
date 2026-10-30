import { NextRequest, NextResponse } from 'next/server';
import { updateStaffAccess, AdminServiceError } from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

interface RouteContext {
  params: { id: string };
}

/**
 * PUT /api/v1/admin/users/[id]
 * Updates staff role, active status, department, or jurisdiction.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
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

    const updated = await updateStaffAccess(session, params.id, body);

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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update user access.' } },
      { status: 500 }
    );
  }
}
