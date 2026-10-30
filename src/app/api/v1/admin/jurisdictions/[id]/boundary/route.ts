import { NextRequest, NextResponse } from 'next/server';
import { inspectWardBoundary, AdminServiceError } from '@/server/admin-service';
import { requireAuth, AuthError } from '@/server/auth';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/v1/admin/jurisdictions/[id]/boundary
 *
 * Inspects ward boundary polygon metadata, SRID, validity, and outputs
 * the explicit synthetic placeholder disclaimer.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'OFFICER']);
    const inspection = await inspectWardBoundary(params.id);

    return NextResponse.json({
      success: true,
      data: inspection,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to inspect ward boundary.' } },
      { status: 500 }
    );
  }
}
