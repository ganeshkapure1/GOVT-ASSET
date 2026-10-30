import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-session';
import { verifyCsrfProtection } from '@/server/auth';

export async function POST(request: NextRequest | Request) {
  // CSRF validation for state-changing logout
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

  const response = NextResponse.json({
    success: true,
    message: 'Session terminated successfully.',
  });

  // Ensure no-cache headers so browsers do not cache authenticated views
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  // Expire session cookie immediately across multiple deletion strategies
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function GET(request: NextRequest | Request) {
  // Gracefully clear cookie and redirect to landing page if user hits logout via GET
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL('/', url.origin));

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
