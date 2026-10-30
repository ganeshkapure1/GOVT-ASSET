import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';

/**
 * POST /api/v1/admin/notifications/test
 *
 * Dispatches an administrative test notification.
 * Restricted to PLATFORM_ADMIN.
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
    await requireAuth(['PLATFORM_ADMIN']);
    const body = await request.json();
    const { channel = 'SMS', recipientPhone = '+919822000001', recipientEmail = 'admin@csnmc.gov.in' } = body;

    const result = await sendNotification({
      channel,
      recipientPhone: channel === 'SMS' ? recipientPhone : undefined,
      recipientEmail: channel === 'EMAIL' ? recipientEmail : undefined,
      templateCode: 'ADMIN_DIAGNOSTIC_TEST',
      payload: {
        message: 'GovAsset Gateway Test: Diagnostic notification successfully dispatched.',
        subject: 'GovAsset Infrastructure Test',
      },
    });

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
      { success: false, error: { code: 'DISPATCH_FAILED', message: err.message || 'Failed to dispatch test notification.' } },
      { status: 400 }
    );
  }
}
