import { NextRequest, NextResponse } from 'next/server';
import { createComplaint, getActiveCategories, isUuid, WorkflowError } from '@/server/complaint-service';
import { getServerSession, verifyCsrfProtection } from '@/server/auth';

/**
 * GET /api/v1/complaints
 * Returns active complaint categories for citizen report wizards and intake forms.
 */
export async function GET() {
  try {
    const categories = await getActiveCategories();
    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to retrieve categories.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/complaints
 *
 * Citizen complaint intake endpoint.
 * Requires authenticated citizen session with verified mobile identity.
 * Rejects unauthenticated requests with 401 Unauthorized.
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
    const session = await getServerSession();

    if (!session || session.role !== 'CITIZEN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Citizen authentication required. Please sign in with your verified mobile number to register a complaint.',
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate UUID inputs at the API boundary when a UUID is explicitly provided
    if (body.categoryId !== undefined && body.categoryId !== null && !isUuid(body.categoryId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_UUID',
            message: 'The provided categoryId must be a valid UUID format (e.g. 55555555-5555-5555-5555-555555550001).',
          },
        },
        { status: 400 }
      );
    }

    // Derive citizen identity strictly from verified session (prevent IDOR & spoofing)
    const citizenId = session.userId;
    const citizenPhone = session.phoneNumber;

    const complaint = await createComplaint({
      ...body,
      citizenId,
      citizenPhone,
    });

    return NextResponse.json({
      success: true,
      data: complaint,
    });
  } catch (err: any) {
    if (err instanceof WorkflowError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to register complaint.' } },
      { status: 500 }
    );
  }
}
