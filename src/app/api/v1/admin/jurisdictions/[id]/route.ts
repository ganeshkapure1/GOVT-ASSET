import { NextRequest, NextResponse } from 'next/server';
import {
  updateJurisdiction,
  deleteJurisdiction,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

interface RouteContext {
  params: { id: string };
}

/**
 * PUT /api/v1/admin/jurisdictions/[id]
 * Updates jurisdiction name, code, or parent.
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

    const updated = await updateJurisdiction(session, params.id, body);

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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update jurisdiction.' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/jurisdictions/[id]
 * Safely deletes an empty jurisdiction (fails if complaints, users, or child zones exist).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
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
    const deleted = await deleteJurisdiction(session, params.id);

    return NextResponse.json({
      success: true,
      data: deleted,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete jurisdiction.' } },
      { status: 500 }
    );
  }
}
