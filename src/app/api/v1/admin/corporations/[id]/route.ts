import { NextRequest, NextResponse } from 'next/server';
import {
  getCorporationById,
  updateCorporation,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/v1/admin/corporations/[id]
 * Retrieve details of a specific municipal corporation with its zones and wards.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'OFFICER']);
    const corporation = await getCorporationById(params.id);

    return NextResponse.json({
      success: true,
      data: corporation,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve municipal corporation.' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/corporations/[id]
 * Update a municipal corporation's configuration, contact details, or active status.
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

    const updated = await updateCorporation(session, params.id, body);

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
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to update municipal corporation.' } },
      { status: 500 }
    );
  }
}
