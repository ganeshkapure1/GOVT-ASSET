import { NextResponse } from 'next/server';
import { getServerSession } from '@/server/auth';
import { maskPhoneNumber, maskEmail } from '@/lib/pii';

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No active session.',
        },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      userId: session.userId,
      fullName: session.fullName,
      email: maskEmail(session.email),
      phoneNumber: maskPhoneNumber(session.phoneNumber),
      role: session.role,
      departmentId: session.departmentId,
      jurisdictionId: session.jurisdictionId,
      expiresAt: session.expiresAt,
    },
  });
}
