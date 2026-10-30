import { NextResponse } from 'next/server';
import { requireAuth, AuthError, getCorporationIdForJurisdiction } from '@/server/auth';
import { db } from '@/lib/db';

/**
 * GET /api/v1/ops/context
 *
 * Returns operational session context, the authenticated staff member's profile,
 * the municipal corporation they belong to, their assigned base ward,
 * and the list of authorized wards within their corporation.
 *
 * This prevents cross-corporation confusion (e.g. CSMC officers seeing Pune wards).
 */
export async function GET() {
  try {
    const session = await requireAuth([
      'OFFICER',
      'SUPERVISOR',
      'DEPT_ADMIN',
      'PLATFORM_ADMIN',
      'FIELD_WORKER',
    ]);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        staffCode: true,
        designation: true,
        skills: true,
        isActive: true,
        departmentId: true,
        jurisdictionId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        jurisdiction: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            parentId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User record not found.' } },
        { status: 404 }
      );
    }

    // Check if user has a valid jurisdiction
    if (!user.jurisdictionId || !user.jurisdiction) {
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            designation: user.designation,
            staffCode: user.staffCode,
            department: user.department,
            jurisdiction: null,
          },
          corporation: null,
          assignedWard: null,
          authorizedWards: [],
          hasValidJurisdiction: false,
          setupMessage: 'No electoral ward assigned to your staff account. Please contact your system administrator.',
        },
      });
    }

    // Resolve Corporation ID
    const corporationId = await getCorporationIdForJurisdiction(user.jurisdictionId);

    if (!corporationId) {
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            designation: user.designation,
            staffCode: user.staffCode,
            department: user.department,
            jurisdiction: user.jurisdiction,
          },
          corporation: null,
          assignedWard: user.jurisdiction.level === 'WARD' ? user.jurisdiction : null,
          authorizedWards: [],
          hasValidJurisdiction: false,
          setupMessage: 'Corporation hierarchy configuration missing for assigned jurisdiction.',
        },
      });
    }

    // Query Corporation Details
    const corporation = await db.jurisdiction.findUnique({
      where: { id: corporationId },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    // Query all Zones and Wards under this Corporation
    const zones = await db.jurisdiction.findMany({
      where: {
        parentId: corporationId,
        level: 'ZONE',
        isActive: true,
      },
      select: { id: true },
    });

    const zoneIds = zones.map((z) => z.id);

    // Fetch all active wards belonging to this Corporation
    const authorizedWards = await db.jurisdiction.findMany({
      where: {
        level: 'WARD',
        isActive: true,
        OR: [
          { parentId: { in: zoneIds } },
          { parentId: corporationId },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
      },
      orderBy: { code: 'asc' },
    });

    // Determine assigned ward (if user's jurisdiction is a ward)
    const assignedWard =
      user.jurisdiction.level === 'WARD'
        ? {
            id: user.jurisdiction.id,
            name: user.jurisdiction.name,
            code: user.jurisdiction.code,
          }
        : authorizedWards[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          designation: user.designation,
          staffCode: user.staffCode,
          department: user.department,
          jurisdiction: user.jurisdiction,
        },
        corporation: corporation
          ? {
              id: corporation.id,
              name: corporation.name,
              code: corporation.code,
              city: corporation.city || corporation.name,
              state: corporation.state || 'Maharashtra',
            }
          : null,
        city: corporation?.city || null,
        state: corporation?.state || null,
        locationLabel: corporation ? `${corporation.city || corporation.name}, ${corporation.state || 'India'}` : 'Location not configured',
        assignedWard,
        authorizedWards,
        hasValidJurisdiction: Boolean(corporation),
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to retrieve operations context.' } },
      { status: 500 }
    );
  }
}
