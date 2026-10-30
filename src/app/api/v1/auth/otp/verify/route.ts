import { NextRequest, NextResponse } from 'next/server';
import { verifyPhoneOtp } from '@/server/otp-service';
import { verifyCsrfProtection } from '@/server/auth';
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth-session';
import { getDefaultRedirectForRole } from '@/lib/rbac';

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
    const { phoneNumber, otp } = body;

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Both phone number and 6-digit OTP are required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await verifyPhoneOtp(phoneNumber, otp);

    if (!result.success || !result.sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: result.error || 'Verification code failed.',
          },
        },
        { status: 401 }
      );
    }

    const redirectUrl = getDefaultRedirectForRole(result.user?.role || 'CITIZEN');

    const response = NextResponse.json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
        role: result.user?.role,
        redirectUrl,
      },
    });

    // Set secure HTTP-only session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify verification code.',
        },
      },
      { status: 500 }
    );
  }
}
