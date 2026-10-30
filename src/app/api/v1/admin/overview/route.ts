import { NextResponse } from 'next/server';
import { getAdminOverviewStats, AdminServiceError } from '@/server/admin-service';
import { requireAuth, AuthError } from '@/server/auth';

/**
 * GET /api/v1/admin/overview
 *
 * Provides system-wide backlog, SLA compliance, and department metrics.
 * Strictly restricted to PLATFORM_ADMIN.
 */
export async function GET() {
  try {
    await requireAuth(['PLATFORM_ADMIN']);
    const stats = await getAdminOverviewStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve overview analytics.' } },
      { status: 500 }
    );
  }
}
