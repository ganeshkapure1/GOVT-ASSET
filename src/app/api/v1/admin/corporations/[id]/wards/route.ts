import { NextRequest, NextResponse } from 'next/server';
import {
  createWard,
  AdminServiceError,
} from '@/server/admin-service';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { db } from '@/lib/db';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/v1/admin/corporations/[id]/wards
 * List all wards belonging to a specific municipal corporation.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'OFFICER']);

    const zones = await db.jurisdiction.findMany({
      where: { parentId: params.id, level: 'ZONE' },
      select: { id: true, name: true, code: true },
    });

    const zoneIds = zones.map((z) => z.id);

    const wards = await db.jurisdiction.findMany({
      where: { parentId: { in: zoneIds }, level: 'WARD' },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        isActive: true,
        metadata: true,
        _count: { select: { complaints: true, users: true } },
      },
      orderBy: { code: 'asc' },
    });

    const zoneMap = new Map(zones.map((z) => [z.id, z]));

    const result = wards.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      zoneId: w.parentId,
      zoneName: w.parentId ? zoneMap.get(w.parentId)?.name : null,
      isActive: w.isActive,
      complaintsCount: w._count.complaints,
      staffCount: w._count.users,
      metadata: w.metadata,
    }));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof AuthError || err instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve wards.' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/corporations/[id]/wards
 * Create a new ward under a zone in this municipal corporation.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const session = await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN']);
    const body = await request.json();

    const created = await createWard(session, {
      ...body,
      corporationId: params.id,
    });

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
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to create ward.' } },
      { status: 500 }
    );
  }
}
