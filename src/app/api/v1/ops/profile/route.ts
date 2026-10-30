import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, verifyCsrfProtection, AuthError } from '@/server/auth';
import { db } from '@/lib/db';
import { maskPhoneNumber } from '@/lib/pii';
import { hashPassword, verifyPassword } from '@/lib/auth-crypto';

/**
 * GET /api/v1/ops/profile
 * Retrieves the current authenticated staff member or field worker's profile.
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        role: true,
        staffCode: true,
        designation: true,
        skills: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        jurisdiction: { select: { id: true, name: true, code: true, level: true } },
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User profile not found.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        phoneNumberMasked: maskPhoneNumber(user.phoneNumber),
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve profile.' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/ops/profile
 * Allows staff members / field workers to update permitted profile fields (e.g. designation, skills).
 * Self-escalation of role or jurisdiction is strictly prevented.
 */
export async function PUT(request: NextRequest) {
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
    const session = await requireAuth();
    const body = await request.json();

    const allowedUpdates: any = {};

    if (body.fullName && typeof body.fullName === 'string' && body.fullName.trim().length >= 2) {
      allowedUpdates.fullName = body.fullName.trim();
    }

    if (body.designation !== undefined) {
      allowedUpdates.designation = typeof body.designation === 'string' ? body.designation.trim() : null;
    }

    if (body.skills !== undefined) {
      allowedUpdates.skills = typeof body.skills === 'string' ? body.skills.trim() : null;
    }

    if (body.newPassword) {
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 8 characters long.' } },
          { status: 400 }
        );
      }
      if (!body.currentPassword) {
        return NextResponse.json(
          { success: false, error: { code: 'CURRENT_PASSWORD_REQUIRED', message: 'Current password is required to change password.' } },
          { status: 400 }
        );
      }
      const existingUser = await db.user.findUnique({
        where: { id: session.userId },
        select: { passwordHash: true },
      });
      const isValid = await verifyPassword(body.currentPassword, existingUser?.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Current password does not match.' } },
          { status: 400 }
        );
      }
      allowedUpdates.passwordHash = await hashPassword(body.newPassword);
    }

    const updated = await db.user.update({
      where: { id: session.userId },
      data: allowedUpdates,
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
        department: { select: { id: true, name: true } },
        jurisdiction: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to update profile.' } },
      { status: 500 }
    );
  }
}
