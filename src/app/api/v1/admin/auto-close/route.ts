import { NextRequest, NextResponse } from 'next/server';
import { autoCloseResolvedComplaints } from '@/server/auto-close';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

/**
 * POST /api/v1/admin/auto-close
 *
 * Administrative & system daemon endpoint to execute the 7-day auto-closure loop.
 * Closes VERIFIED_RESOLVED grievances older than 7 calendar days with no active dispute.
 *
 * NOTE: Production background scheduling will be provisioned in Phase 9.
 */
export async function POST(request: NextRequest) {
  // Allow system cron tokens or CSRF-protected admin sessions
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuthorized) {
    if (!verifyCsrfProtection(request)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked by CSRF security policy.' },
        },
        { status: 403 }
      );
    }
  }

  try {
    if (!isCronAuthorized) {
      await requireAuth(['PLATFORM_ADMIN']);
    }

    const result = await autoCloseResolvedComplaints();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Auto-closure execution failed.' } },
      { status: 500 }
    );
  }
}
