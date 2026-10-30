import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/server/auth';
import { getCombinedAuditLogs, AdminServiceError } from '@/server/admin-service';

/**
 * GET /api/v1/admin/audit-logs
 *
 * Provides system-wide audit records and configuration audit history.
 * Strictly restricted to PLATFORM_ADMIN.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['PLATFORM_ADMIN']);

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const logs = await getCombinedAuditLogs({ action, limit });

    return NextResponse.json({
      success: true,
      data: logs,
      admin: session.email,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve audit logs' } },
      { status: 500 }
    );
  }
}
