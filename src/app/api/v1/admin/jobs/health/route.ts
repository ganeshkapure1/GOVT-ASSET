import { NextResponse } from 'next/server';
import { getQueueMetrics, getDeadLetterJobs } from '@/server/queue';
import { getNotificationDeliveryStats } from '@/lib/notifications';
import { requireAuth, AuthError } from '@/server/auth';

/**
 * GET /api/v1/admin/jobs/health
 *
 * Provides real-time health diagnostics for:
 * - Background job queue backlog & dead-letter counts
 * - Notification delivery gateway metrics & success rates
 * - Scheduler operational configuration status
 *
 * Restricted to PLATFORM_ADMIN or DEPT_ADMIN.
 */
export async function GET() {
  try {
    await requireAuth(['PLATFORM_ADMIN', 'DEPT_ADMIN']);

    const queueMetrics = getQueueMetrics();
    const deadLetterJobs = getDeadLetterJobs(5);
    const notificationStats = await getNotificationDeliveryStats();

    return NextResponse.json({
      success: true,
      data: {
        queue: queueMetrics,
        deadLetterJobs: deadLetterJobs.map((j) => ({
          id: j.id,
          type: j.type,
          attempts: j.attempts,
          lastError: j.lastError,
          failedAt: j.deadLetteredAt?.toISOString() || null,
        })),
        notifications: notificationStats,
        systemStatus: {
          isSchedulerConfigured: queueMetrics.isSchedulerConfigured,
          smsMode: notificationStats.smsProvider.mode,
          emailMode: notificationStats.emailProvider.mode,
          timestamp: new Date().toISOString(),
        },
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve background job diagnostics.' } },
      { status: 500 }
    );
  }
}
