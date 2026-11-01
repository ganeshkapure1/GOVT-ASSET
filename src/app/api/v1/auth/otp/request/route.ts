import { NextRequest, NextResponse } from 'next/server';
import { requestPhoneOtp } from '@/server/otp-service';
import { verifyCsrfProtection } from '@/server/auth';

export async function POST(request: NextRequest) {
  if (!verifyCsrfProtection(request)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CSRF_REJECTED',
          message: 'Cross-origin request blocked by CSRF security policy.',
        },
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Phone number is required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await requestPhoneOtp(phoneNumber);

    if (!result.success) {
      const statusCode = result.cooldownRemainingSeconds ? 429 : 400;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.cooldownRemainingSeconds ? 'RATE_LIMITED' : 'OTP_REQUEST_FAILED',
            message: result.error,
          },
        },
        { status: statusCode }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: result.message,
      ...(result.mockOtpNotice ? { mockNotice: result.mockOtpNotice } : {}),
    });

    if (result.challengeToken) {
      response.cookies.set({
        name: 'govasset_otp_challenge',
        value: result.challengeToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      });
    }

    return response;
  } catch (err: any) {
    console.error('[AUTH_OTP_REQUEST_ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err?.message || 'Failed to process OTP verification request.',
        },
      },
      { status: 500 }
    );
  }
}
