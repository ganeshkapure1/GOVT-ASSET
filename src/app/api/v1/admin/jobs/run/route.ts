import { NextRequest, NextResponse } from 'next/server';
import { runSchedulerCycle } from '@/server/worker';
import { getServerSession } from '@/server/auth';

/**
 * POST /api/v1/admin/jobs/run
 *
 * Executes recurring background maintenance:
 * - SLA breach detection & supervisor alerts
 * - 7-day auto-closure evaluation
 * - Background queue processing & bounded retries
 *
 * Security: Requires valid CRON_SECRET header OR active PLATFORM_ADMIN session.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');

  let isAuthorized = false;

  // 1. Check CRON_SECRET header
  if (cronSecret) {
    if (
      (authHeader && authHeader.replace(/^Bearer\s+/i, '') === cronSecret) ||
      cronSecretHeader === cronSecret
    ) {
      isAuthorized = true;
    }
  }

  // 2. Check PLATFORM_ADMIN session cookie
  if (!isAuthorized) {
    try {
      const session = await getServerSession();
      if (session && session.role === 'PLATFORM_ADMIN') {
        isAuthorized = true;
      }
    } catch {
      // Session extraction failed
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED_CRON',
          message: 'Access denied. Valid CRON_SECRET authorization or administrator session required.',
        },
      },
      { status: 401 }
    );
  }

  try {
    const summary = await runSchedulerCycle();
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SCHEDULER_CYCLE_FAILED',
          message: err.message || 'Error occurred during background scheduler execution.',
        },
      },
      { status: 500 }
    );
  }
}
