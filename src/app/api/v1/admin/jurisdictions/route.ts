import { NextRequest, NextResponse } from 'next/server';
import {
  getJurisdictionsHierarchy,
  createJurisdiction,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

/**
 * GET /api/v1/admin/jurisdictions
 * List jurisdiction hierarchy (Corporations, Zones, Wards).
 */
export async function GET() {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'OFFICER']);
    const hierarchy = await getJurisdictionsHierarchy();

    return NextResponse.json({
      success: true,
      data: hierarchy,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve jurisdictions.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/jurisdictions
 * Create a new Zone or Ward.
 */
export async function POST(request: NextRequest) {
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

    const created = await createJurisdiction(session, body);

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create jurisdiction.' } },
      { status: 500 }
    );
  }
}
