import crypto from 'crypto';

export type JobType =
  | 'SEND_NOTIFICATION'
  | 'CHECK_SLA_BREACHES'
  | 'AUTO_CLOSE_COMPLAINTS'
  | 'DISPATCH_ESCALATION';

export type JobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

export interface JobRecord<T = Record<string, any>> {
  id: string;
  type: JobType;
  payload: T;
  idempotencyKey: string;
  status: JobStatus;
  attempts: number;
  maxRetries: number;
  backoffMs: number;
  runAt: Date;
  lastError: string | null;
  errorStack?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  deadLetteredAt: Date | null;
}

export interface EnqueueOptions {
  idempotencyKey?: string;
  runAt?: Date;
  maxRetries?: number;
  baseBackoffMs?: number;
}

export interface QueueMetrics {
  totalJobs: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  deadLetterCount: number;
  oldestPendingAgeMs: number;
  isSchedulerConfigured: boolean;
}

export type JobHandler<T = Record<string, any>> = (
  job: JobRecord<T>
) => Promise<void | Record<string, any>>;

// In-Memory resilient queue store with idempotency indexing
const jobStore = new Map<string, JobRecord>();
const idempotencyIndex = new Map<string, string>(); // idempotencyKey -> jobId
const handlers = new Map<JobType, JobHandler>();

/**
 * Calculates exponential backoff duration based on attempt number.
 * formula: baseBackoffMs * 2^(attempt - 1), capped at 1 hour.
 */
export function calculateBackoffMs(attempt: number, baseBackoffMs = 1000): number {
  const exponent = Math.max(0, attempt - 1);
  const backoff = baseBackoffMs * Math.pow(2, exponent);
  return Math.min(backoff, 3600000); // 1 hour max
}

/**
 * Registers an execution handler for a specific job type.
 */
export function registerJobHandler<T = Record<string, any>>(
  type: JobType,
  handler: JobHandler<T>
): void {
  handlers.set(type, handler as JobHandler);
}

/**
 * Enqueues a background job with strict idempotency and bounded retry semantics.
 */
export async function enqueueJob<T = Record<string, any>>(
  type: JobType,
  payload: T,
  options: EnqueueOptions = {}
): Promise<{ job: JobRecord<T>; isDuplicate: boolean }> {
  const idempotencyKey = options.idempotencyKey || `${type}-${crypto.randomUUID()}`;

  // Idempotency check: if already recorded and not dead-lettered, return existing job
  if (idempotencyIndex.has(idempotencyKey)) {
    const existingId = idempotencyIndex.get(idempotencyKey)!;
    const existing = jobStore.get(existingId);
    if (existing && existing.status !== 'DEAD_LETTER') {
      return { job: existing as unknown as JobRecord<T>, isDuplicate: true };
    }
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 3;
  const runAt = options.runAt || now;

  const job: JobRecord<T> = {
    id,
    type,
    payload,
    idempotencyKey,
    status: 'PENDING',
    attempts: 0,
    maxRetries,
    backoffMs: options.baseBackoffMs || 1000,
    runAt,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deadLetteredAt: null,
  };

  jobStore.set(id, job as unknown as JobRecord);
  idempotencyIndex.set(idempotencyKey, id);

  return { job, isDuplicate: false };
}

/**
 * Processes a single job through its registered handler with bounded retries & DLQ.
 */
export async function processJob(jobId: string, referenceNow = new Date()): Promise<JobRecord> {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (job.status === 'COMPLETED' || job.status === 'DEAD_LETTER') {
    return job;
  }

  const handler = handlers.get(job.type);
  if (!handler) {
    job.status = 'DEAD_LETTER';
    job.lastError = `No handler registered for job type: ${job.type}`;
    job.deadLetteredAt = new Date();
    job.updatedAt = new Date();
    return job;
  }

  job.status = 'PROCESSING';
  job.attempts += 1;
  job.updatedAt = new Date();

  try {
    await handler(job);

    job.status = 'COMPLETED';
    job.completedAt = new Date();
    job.lastError = null;
    job.updatedAt = new Date();
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    job.lastError = errorMessage;
    job.errorStack = err?.stack || null;
    job.updatedAt = new Date();

    if (job.attempts >= job.maxRetries) {
      // Terminal Failure -> Transition to Dead-Letter Queue (DLQ)
      job.status = 'DEAD_LETTER';
      job.deadLetteredAt = new Date();
    } else {
      // Transient Failure -> Schedule Retry with Exponential Backoff
      job.status = 'FAILED';
      const delay = calculateBackoffMs(job.attempts, job.backoffMs);
      job.runAt = new Date(referenceNow.getTime() + delay);
    }
  }

  return job;
}

/**
 * Worker entry point: drains pending/due jobs up to a given batch limit.
 */
export async function processPendingJobs(
  options: { batchSize?: number; referenceNow?: Date } = {}
): Promise<{ processed: number; completed: number; failed: number; deadLettered: number }> {
  const batchSize = options.batchSize || 20;
  const referenceNow = options.referenceNow || new Date();

  // Find pending or retryable failed jobs whose runAt <= referenceNow
  const readyJobs: JobRecord[] = [];
  for (const job of Array.from(jobStore.values())) {
    if (
      (job.status === 'PENDING' || job.status === 'FAILED') &&
      job.runAt.getTime() <= referenceNow.getTime()
    ) {
      readyJobs.push(job);
      if (readyJobs.length >= batchSize) break;
    }
  }

  let completed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of readyJobs) {
    const result = await processJob(job.id, referenceNow);
    if (result.status === 'COMPLETED') completed++;
    else if (result.status === 'DEAD_LETTER') deadLettered++;
    else failed++;
  }

  return {
    processed: readyJobs.length,
    completed,
    failed,
    deadLettered,
  };
}

/**
 * Retrieves overall queue telemetry and health diagnostics.
 */
export function getQueueMetrics(): QueueMetrics {
  const now = Date.now();
  let pendingCount = 0;
  let processingCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;
  let oldestPendingAgeMs = 0;

  for (const job of Array.from(jobStore.values())) {
    if (job.status === 'PENDING') {
      pendingCount++;
      const age = now - job.createdAt.getTime();
      if (age > oldestPendingAgeMs) oldestPendingAgeMs = age;
    } else if (job.status === 'PROCESSING') {
      processingCount++;
    } else if (job.status === 'COMPLETED') {
      completedCount++;
    } else if (job.status === 'FAILED') {
      failedCount++;
    } else if (job.status === 'DEAD_LETTER') {
      deadLetterCount++;
    }
  }

  return {
    totalJobs: jobStore.size,
    pendingCount,
    processingCount,
    completedCount,
    failedCount,
    deadLetterCount,
    oldestPendingAgeMs,
    // Indicates if worker trigger endpoints or cron secrets are defined in environment
    isSchedulerConfigured: Boolean(process.env.CRON_SECRET || process.env.ENABLE_BACKGROUND_CRON === '1'),
  };
}

/**
 * Lists dead-lettered jobs for administrative inspection and diagnostic tracing.
 */
export function getDeadLetterJobs(limit = 50): JobRecord[] {
  const dlq: JobRecord[] = [];
  for (const job of Array.from(jobStore.values())) {
    if (job.status === 'DEAD_LETTER') {
      dlq.push(job);
      if (dlq.length >= limit) break;
    }
  }
  return dlq.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Resets a dead-letter job for manual administrative retry.
 */
export function retryDeadLetterJob(jobId: string): JobRecord | null {
  const job = jobStore.get(jobId);
  if (!job || job.status !== 'DEAD_LETTER') {
    return null;
  }
  job.status = 'PENDING';
  job.attempts = 0;
  job.runAt = new Date();
  job.lastError = null;
  job.deadLetteredAt = null;
  job.updatedAt = new Date();
  return job;
}

/**
 * Resets the in-memory queue store. Used primarily for test isolation.
 */
export function clearQueueStore(): void {
  jobStore.clear();
  idempotencyIndex.clear();
}
