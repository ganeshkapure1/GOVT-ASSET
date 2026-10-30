import { NextRequest, NextResponse } from 'next/server';
import {
  recordCitizenFeedback,
  getCitizenFeedback,
  WorkflowError,
} from '@/server/complaint-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/v1/complaints/[id]/feedback
 *
 * Retrieves submitted citizen feedback for a complaint if present.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(['CITIZEN', 'PLATFORM_ADMIN']);
    const feedback = await getCitizenFeedback(params.id, session);

    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof WorkflowError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve feedback.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/complaints/[id]/feedback
 *
 * Submits 1-5 star citizen rating and optional feedback for resolved/closed complaints.
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

    const { rating, feedbackText } = body;

    const recorded = await recordCitizenFeedback({
      complaintId: params.id,
      citizenSession: session,
      rating: Number(rating),
      feedbackText,
    });

    return NextResponse.json({
      success: true,
      data: recorded,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof WorkflowError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to submit feedback.' } },
      { status: 500 }
    );
  }
}
