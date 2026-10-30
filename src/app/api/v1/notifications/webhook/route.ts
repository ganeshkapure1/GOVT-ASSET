import { NextRequest, NextResponse } from 'next/server';
import { verifyAndProcessDeliveryWebhook } from '@/lib/notifications';

/**
 * POST /api/v1/notifications/webhook
 *
 * Receives delivery receipts and bounce reports from SMS/Email gateways.
 */
export async function POST(request: NextRequest) {
  try {
    const signature =
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-fast2sms-signature') ||
      request.headers.get('resend-signature');

    const body = await request.json();

    if (!body || !body.messageId || !body.status) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload structure. messageId and status are required.' },
        { status: 400 }
      );
    }

    const result = await verifyAndProcessDeliveryWebhook(body, signature);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Webhook processing exception.' },
      { status: 500 }
    );
  }
}
