import { NextRequest, NextResponse } from 'next/server';
import {
  getStaffDirectory,
  inviteStaffUser,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { UserRole } from '@/lib/auth-session';

/**
 * GET /api/v1/admin/users
 * Returns staff directory filtered by role, department, jurisdiction, search, or status.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR']);

    const searchParams = request.nextUrl.searchParams;
    const roleParam = searchParams.get('role') as UserRole | null;
    const departmentId = searchParams.get('departmentId') || undefined;
    const jurisdictionId = searchParams.get('jurisdictionId') || undefined;
    const search = searchParams.get('search') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;

    const users = await getStaffDirectory({
      role: roleParam || undefined,
      departmentId,
      jurisdictionId,
      search,
      isActive,
    });

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve staff directory.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/users
 * Provision or invite a new staff member.
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
    const session = await requireAuth(['PLATFORM_ADMIN']);
    const body = await request.json();

    const created = await inviteStaffUser(session, body);

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to invite staff member.' } },
      { status: 500 }
    );
  }
}
