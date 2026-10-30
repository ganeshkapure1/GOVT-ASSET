import { NextRequest, NextResponse } from 'next/server';
import {
  importWards,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/v1/admin/corporations/[id]/wards/import
 * Batch imports wards into a municipal corporation from CSV or GeoJSON payload.
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
    const session = await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN']);
    const body = await request.json();

    const result = await importWards(session, params.id, body);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to import wards.' } },
      { status: 500 }
    );
  }
}
