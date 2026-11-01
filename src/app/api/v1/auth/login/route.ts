import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth-crypto';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth-session';
import { getDefaultRedirectForRole } from '@/lib/rbac';
import { maskPhoneNumber, maskEmail } from '@/lib/pii';
import { verifyCsrfProtection } from '@/server/auth';

export async function POST(request: NextRequest) {
  // CSRF validation for state-changing authentication request
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
    const { email, username, staffCode, password, phoneNumber, isCitizen, otp, portalType } = body;

    // 1. Citizen Phone Login
    if (isCitizen || phoneNumber) {
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Mobile number is required for citizen sign-in.',
            },
          },
          { status: 400 }
        );
      }

      // If OTP is provided, verify via provider-backed OTP engine
      if (otp) {
        const { verifyPhoneOtp } = await import('@/server/otp-service');
        const otpResult = await verifyPhoneOtp(phoneNumber, otp);
        if (!otpResult.success || !otpResult.sessionToken) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_OTP',
                message: otpResult.error || 'Invalid or expired OTP verification code.',
              },
            },
            { status: 401 }
          );
        }

        const response = NextResponse.json({
          success: true,
          data: {
            user: otpResult.user,
            role: otpResult.user?.role,
            redirectUrl: '/my-complaints',
          },
        });

        response.cookies.set({
          name: SESSION_COOKIE_NAME,
          value: otpResult.sessionToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_DURATION_SECONDS,
        });

        return response;
      }

      // In production, direct passwordless sign-in without OTP is forbidden.
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'OTP_REQUIRED_IN_PRODUCTION',
              message:
                'Direct phone-only login without verified OTP is disabled in production. External SMS OTP gateway configured in Phase 9. Please request an OTP verification code via /api/v1/auth/otp/request.',
            },
          },
          { status: 403 }
        );
      }

      // Format clean phone number
      const cleanPhone = phoneNumber.startsWith('+91')
        ? phoneNumber.trim()
        : `+91${phoneNumber.replace(/\D/g, '')}`;

      const user = await db.user.findFirst({
        where: {
          OR: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneNumber.trim() }],
        },
      });

      if (!user) {
        // Generic error to prevent phone enumeration
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'No registered citizen account found with this mobile number. Please report an issue to register.',
            },
          },
          { status: 401 }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ACCOUNT_DISABLED',
              message: 'This account has been deactivated. Please contact platform administration.',
            },
          },
          { status: 403 }
        );
      }

      // Generate signed session token
      const sessionToken = await createSessionToken({
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
        jurisdictionId: user.jurisdictionId,
      });

      // Update last login
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }).catch(() => {});

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: maskEmail(user.email),
          phoneNumber: maskPhoneNumber(user.phoneNumber),
          role: user.role,
        },
        redirectTo: getDefaultRedirectForRole(user.role),
      });

      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: sessionToken,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: (process.env.NODE_ENV as string) === 'production',
        maxAge: SESSION_DURATION_SECONDS,
      });

      return response;
    }

    // 2. Staff / Worker Email or Username/StaffCode + Password Login
    const identifier = (email || username || staffCode || '').trim();
    if (!identifier || !password || typeof password !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Official email/username and password are required.',
          },
        },
        { status: 400 }
      );
    }

    // Query user by email, staffCode, or registered phone number
    const cleanDigits = identifier.replace(/\D/g, '');
    const phoneVariants: any[] = [];
    if (cleanDigits.length === 10) {
      phoneVariants.push({ phoneNumber: { equals: `+91${cleanDigits}` } });
      phoneVariants.push({ phoneNumber: { equals: cleanDigits } });
    }

    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { staffCode: { equals: identifier, mode: 'insensitive' } },
          { phoneNumber: { equals: identifier } },
          ...phoneVariants,
        ],
      },
    });

    // Timing-attack safe generic rejection if user not found
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'This account has been deactivated. Please contact platform administration.',
          },
        },
        { status: 403 }
      );
    }

    // Strict Portal Separation: Prevent role privilege confusion or role crossover
    if (portalType === 'WORKER') {
      if (user.role !== 'FIELD_WORKER') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ROLE_MISMATCH',
              message: 'Worker Login is strictly for authorized Field Workers. Government officials must sign in using the Government Official portal.',
            },
          },
          { status: 403 }
        );
      }
    } else if (portalType === 'OFFICIAL') {
      if (user.role === 'FIELD_WORKER') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ROLE_MISMATCH',
              message: 'Field Workers must sign in via the Worker Login portal.',
            },
          },
          { status: 403 }
        );
      } else if (user.role === 'CITIZEN') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ROLE_MISMATCH',
              message: 'Citizens must sign in via the Citizen Login portal using mobile OTP verification.',
            },
          },
          { status: 403 }
        );
      }
    }

    // Verify password against stored hash
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        },
        { status: 401 }
      );
    }

    // Create session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId,
      jurisdictionId: user.jurisdictionId,
    });

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: maskPhoneNumber(user.phoneNumber),
        role: user.role,
      },
      redirectTo: getDefaultRedirectForRole(user.role),
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (err: any) {
    console.error('Login error detail:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_AUTH_ERROR',
          message: err?.message || 'An error occurred during authentication. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
