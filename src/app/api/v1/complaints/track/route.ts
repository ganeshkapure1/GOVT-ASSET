import { NextRequest, NextResponse } from 'next/server';
import { getTrackedComplaint } from '@/server/complaint-service';

/**
 * GET /api/v1/complaints/track?ref=GOV-2026-00482
 *
 * Public tracking endpoint for citizens to query status and audit timeline.
 * Contact numbers and actor identities are sanitized and masked.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref');

  if (!ref || ref.trim() === '') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'MISSING_REFERENCE', message: 'A grievance reference number is required.' },
      },
      { status: 400 }
    );
  }

  try {
    const complaint = await getTrackedComplaint(ref);

    if (!complaint) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `No grievance found matching reference number "${ref}".` },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: complaint,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred while retrieving complaint status.' },
      },
      { status: 500 }
    );
  }
}
