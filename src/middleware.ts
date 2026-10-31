import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth-session';
import { getDefaultRedirectForRole } from '@/lib/rbac';

/**
 * Next.js Edge Middleware for GovAsset
 *
 * Enforces authentication, session integrity, and role boundaries before
 * requests reach server components or route handlers.
 * Public pages, complaint tracking, geocoding, and static assets remain freely accessible.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Static files & Next.js internal paths - always allow
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // image, font, icon assets
  ) {
    return NextResponse.next();
  }

  // 2. Public API endpoints - always allow
  if (
    pathname.startsWith('/api/geocode') ||
    pathname.startsWith('/api/health') ||
    pathname === '/api/v1/auth/login' ||
    pathname === '/api/v1/auth/logout' ||
    pathname.startsWith('/api/v1/auth/otp') ||
    pathname === '/api/v1/complaints' ||
    pathname.startsWith('/api/v1/complaints/track') ||
    pathname.startsWith('/api/v1/evidence')
  ) {
    return NextResponse.next();
  }

  // 3. Extract and verify session token from cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionCookie);

  // 4. Handle Login Page: Redirect already authenticated visitors to their role's home portal
  if (pathname === '/login') {
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    if (redirectParam) {
      return NextResponse.next();
    }
    if (session) {
      const redirectTarget = getDefaultRedirectForRole(session.role);
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }
    return NextResponse.next();
  }

  // 5. Public Web Pages: Free access for all citizens and search engines
  if (pathname === '/' || pathname === '/report' || pathname.startsWith('/track')) {
    return NextResponse.next();
  }

  // =========================================================================
  // PROTECTED API ENDPOINTS
  // =========================================================================

  // Admin APIs: PLATFORM_ADMIN only
  if (pathname.startsWith('/api/v1/admin')) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform Administrator role required' } },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Ops APIs: Staff only
  if (pathname.startsWith('/api/v1/ops')) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (session.role === 'CITIZEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Citizen role cannot access operational endpoints' } },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Citizen APIs: Authenticated Citizens
  if (pathname.startsWith('/api/v1/citizen')) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (session.role !== 'CITIZEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Citizen role required for citizen grievance APIs' } },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // =========================================================================
  // PROTECTED WEB PORTAL ROUTES
  // =========================================================================

  // Admin Portal Routes: /admin/*
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== 'PLATFORM_ADMIN') {
      // Non-admin logged in -> redirect to their authorized portal
      return NextResponse.redirect(new URL(getDefaultRedirectForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  // Operations Portal Routes: /ops/*
  if (pathname.startsWith('/ops')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role === 'CITIZEN') {
      return NextResponse.redirect(new URL('/my-complaints', request.url));
    }
    // Base /ops route redirects to the role's dedicated portal
    if (pathname === '/ops' || pathname === '/ops/') {
      return NextResponse.redirect(new URL(getDefaultRedirectForRole(session.role), request.url));
    }
    // Field worker restricted to /ops/field
    if (session.role === 'FIELD_WORKER' && !pathname.startsWith('/ops/field')) {
      return NextResponse.redirect(new URL('/ops/field', request.url));
    }
    return NextResponse.next();
  }

  // Citizen My Complaints Route: /my-complaints
  if (pathname.startsWith('/my-complaints')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== 'CITIZEN') {
      return NextResponse.redirect(new URL(getDefaultRedirectForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
