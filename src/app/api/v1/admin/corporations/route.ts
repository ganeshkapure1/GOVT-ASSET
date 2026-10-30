import { NextRequest, NextResponse } from 'next/server';
import {
  getCorporationsList,
  createCorporation,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

/**
 * GET /api/v1/admin/corporations
 * List all registered municipal corporations with zone and ward counts.
 */
export async function GET() {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'OFFICER']);
    const corporations = await getCorporationsList();

    return NextResponse.json({
      success: true,
      data: corporations,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve municipal corporations.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/corporations
 * Register a new municipal corporation (Platform Administrator only).
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

    const created = await createCorporation(session, body);

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
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to register municipal corporation.' } },
      { status: 500 }
    );
  }
}
