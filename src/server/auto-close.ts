import { db } from '@/lib/db';
import { executeStatusTransitionWithOcc, ComplaintStatus as FsmComplaintStatus } from './fsm';

/**
 * Seven-day auto-closure policy window:
 * Complaints remain eligible for citizen disputes for 7 calendar days after resolution verification.
 * If 7 days elapse without dispute, tickets transition to CLOSED.
 */
export const AUTO_CLOSE_WINDOW_DAYS = 7;
export const AUTO_CLOSE_WINDOW_MS = AUTO_CLOSE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface AutoCloseResult {
  processed: number;
  closed: number;
  skipped: number;
  errors: Array<{ complaintId: string; error: string }>;
}

export interface AutoCloseOptions {
  /**
   * Deterministic cutoff date or reference timestamp for testing date boundaries.
   * If omitted, defaults to now - 7 calendar days.
   */
  cutoffDate?: Date;
  referenceNow?: Date;
  batchLimit?: number;
}

/**
 * Evaluates whether a complaint in VERIFIED_RESOLVED status is eligible for auto-closure
 * based on its actual recorded resolution timestamp.
 */
export function isEligibleForAutoClosure(
  resolvedAt: Date,
  referenceNow: Date = new Date()
): boolean {
  const elapsedMs = referenceNow.getTime() - resolvedAt.getTime();
  return elapsedMs >= AUTO_CLOSE_WINDOW_MS;
}

/**
 * Automatically transitions complaints from VERIFIED_RESOLVED to CLOSED
 * following the 7-calendar-day resolution dispute window.
 *
 * Idempotent: Can safely run repeatedly without duplicating timeline or notification records.
 * Race-Protected: Uses transactions with OCC to prevent closing concurrently disputed complaints.
 */
export async function autoCloseResolvedComplaints(
  options: AutoCloseOptions = {}
): Promise<AutoCloseResult> {
  const referenceNow = options.referenceNow || new Date();
  const cutoff = options.cutoffDate || new Date(referenceNow.getTime() - AUTO_CLOSE_WINDOW_MS);
  const batchLimit = options.batchLimit || 100;

  // 1. Find complaints currently in VERIFIED_RESOLVED status
  const candidates = await db.complaint.findMany({
    where: {
      status: 'VERIFIED_RESOLVED',
      updatedAt: { lte: cutoff },
    },
    take: batchLimit,
    orderBy: { updatedAt: 'asc' },
  });

  const result: AutoCloseResult = {
    processed: candidates.length,
    closed: 0,
    skipped: 0,
    errors: [],
  };

  for (const complaint of candidates) {
    try {
      // 2. Deterministically verify resolution timestamp via timeline
      let resolvedAt = complaint.updatedAt;
      try {
        const resolutionTimeline = await db.complaintTimeline.findFirst({
          where: { complaintId: complaint.id, toStatus: 'VERIFIED_RESOLVED' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        if (resolutionTimeline?.createdAt) {
          resolvedAt = resolutionTimeline.createdAt;
        }
      } catch {
        // Fallback to complaint.updatedAt
      }

      // Check if resolution was strictly at least 7 days before cutoff/referenceNow
      if (resolvedAt.getTime() > cutoff.getTime()) {
        result.skipped++;
        continue;
      }

      // 3. Execute transactional transition to CLOSED with OCC
      await db.$transaction(async (tx) => {
        // Check fresh status within transaction to avoid race conditions
        const fresh = await tx.complaint.findUnique({
          where: { id: complaint.id },
          select: { status: true, version: true },
        });

        if (!fresh || fresh.status !== 'VERIFIED_RESOLVED') {
          // Complaint was disputed or changed status in the interim; skip it safely
          result.skipped++;
          return;
        }

        await executeStatusTransitionWithOcc(tx, {
          complaintId: complaint.id,
          expectedVersion: fresh.version,
          fromStatus: 'VERIFIED_RESOLVED',
          toStatus: 'CLOSED',
          actorRole: 'PLATFORM_ADMIN', // system daemon
          publicNote: 'Complaint automatically closed following 7-day post-resolution window with no disputes.',
          internalNote: 'Auto-closure daemon policy applied.',
          timelineMetadata: {
            autoClosed: true,
            resolvedAt: resolvedAt.toISOString(),
            closedAt: referenceNow.toISOString(),
          },
        });

        // 4. Notification to citizen confirming formal closure
        await tx.notification.create({
          data: {
            recipientPhone: complaint.citizenPhone,
            channel: 'SMS',
            templateCode: 'COMPLAINT_AUTO_CLOSED',
            payload: {
              referenceNumber: complaint.referenceNumber,
            },
            status: 'PENDING',
          },
        });

        result.closed++;
      });
    } catch (err: any) {
      result.errors.push({ complaintId: complaint.id, error: err?.message || 'Unknown error' });
    }
  }

  return result;
}
