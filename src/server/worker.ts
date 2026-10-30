import {
  registerJobHandler,
  processPendingJobs,
  getQueueMetrics,
  enqueueJob,
  JobRecord,
} from './queue';
import { sendNotification, SendNotificationOptions } from '@/lib/notifications';
import { checkAndEscalateSlaBreaches, SlaEscalationResult } from './sla-cron';
import { autoCloseResolvedComplaints, AutoCloseResult } from './auto-close';

let isInitialized = false;

/**
 * Initializes and registers all background job handlers.
 */
export function initializeWorker(): void {
  if (isInitialized) return;

  // 1. Notification dispatch handler
  registerJobHandler('SEND_NOTIFICATION', async (job: JobRecord<SendNotificationOptions>) => {
    const result = await sendNotification(job.payload);
    if (result.status === 'FAILED') {
      throw new Error(result.error || 'Notification delivery failed at provider.');
    }
  });

  // 2. SLA breach monitor handler
  registerJobHandler('CHECK_SLA_BREACHES', async (job: JobRecord<{ referenceNow?: string }>) => {
    const refNow = job.payload.referenceNow ? new Date(job.payload.referenceNow) : new Date();
    await checkAndEscalateSlaBreaches({ referenceNow: refNow });
  });

  // 3. 7-day auto-closure handler
  registerJobHandler('AUTO_CLOSE_COMPLAINTS', async (job: JobRecord<{ referenceNow?: string }>) => {
    const refNow = job.payload.referenceNow ? new Date(job.payload.referenceNow) : new Date();
    await autoCloseResolvedComplaints({ referenceNow: refNow });
  });

  // 4. Escalation dispatch handler
  registerJobHandler('DISPATCH_ESCALATION', async (job: JobRecord<SendNotificationOptions>) => {
    await sendNotification(job.payload);
  });

  isInitialized = true;
}

// Auto-initialize on import
initializeWorker();

export interface SchedulerExecutionResult {
  timestamp: string;
  slaBreachSummary: SlaEscalationResult;
  autoCloseSummary: AutoCloseResult;
  queueSummary: {
    processed: number;
    completed: number;
    failed: number;
    deadLettered: number;
  };
  metrics: ReturnType<typeof getQueueMetrics>;
}

/**
 * Runs a complete background maintenance cycle:
 * 1. Evaluates SLA breaches and enqueues supervisor escalation alerts.
 * 2. Evaluates verified complaints for 7-calendar-day auto-closure.
 * 3. Drains and processes pending jobs from the queue with exponential backoff.
 */
export async function runSchedulerCycle(
  options: { referenceNow?: Date; batchSize?: number } = {}
): Promise<SchedulerExecutionResult> {
  initializeWorker();
  const referenceNow = options.referenceNow || new Date();

  // 1. Run SLA breach escalation
  const slaBreachSummary = await checkAndEscalateSlaBreaches({ referenceNow });

  // 2. Run 7-day auto-close
  const autoCloseSummary = await autoCloseResolvedComplaints({ referenceNow });

  // 3. Process ready jobs from the queue
  const queueSummary = await processPendingJobs({
    batchSize: options.batchSize || 50,
    referenceNow,
  });

  return {
    timestamp: referenceNow.toISOString(),
    slaBreachSummary,
    autoCloseSummary,
    queueSummary,
    metrics: getQueueMetrics(),
  };
}
