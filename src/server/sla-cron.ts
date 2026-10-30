import { db } from '@/lib/db';
import { enqueueJob } from './queue';

export interface SlaEscalationResult {
  evaluated: number;
  newlyBreached: number;
  escalationsSent: number;
  skippedAlreadyHandled: number;
  errors: Array<{ complaintId: string; error: string }>;
}

export interface SlaCronOptions {
  referenceNow?: Date;
  batchLimit?: number;
}

/**
 * Checks all active complaints against SLA deadlines and escalates breached tickets.
 *
 * Idempotent: Evaluates timestamps deterministically and checks existing escalation
 * records so recurring scheduler invocations do NOT cause notification storms.
 */
export async function checkAndEscalateSlaBreaches(
  options: SlaCronOptions = {}
): Promise<SlaEscalationResult> {
  const referenceNow = options.referenceNow || new Date();
  const batchLimit = options.batchLimit || 100;

  // Active complaint statuses eligible for SLA tracking
  const activeStatuses = [
    'SUBMITTED',
    'TRIAGED_VALIDATED',
    'ASSIGNED',
    'IN_PROGRESS',
    'DISPUTED_REOPENED',
  ];

  const candidates = await db.complaint.findMany({
    where: {
      status: { in: activeStatuses as any },
    },
    include: {
      department: { select: { id: true, name: true, code: true } },
      jurisdiction: { select: { id: true, name: true, code: true } },
      category: {
        include: {
          slaPolicies: true,
        },
      },
    },
    take: batchLimit,
    orderBy: { resolutionDueAt: 'asc' },
  });

  const result: SlaEscalationResult = {
    evaluated: candidates.length,
    newlyBreached: 0,
    escalationsSent: 0,
    skippedAlreadyHandled: 0,
    errors: [],
  };

  for (const complaint of candidates) {
    try {
      const isResponseBreached =
        complaint.status === 'SUBMITTED' && referenceNow > complaint.responseDueAt;
      const isResolutionBreached = referenceNow > complaint.resolutionDueAt;

      if (!isResponseBreached && !isResolutionBreached) {
        continue;
      }

      // Determine breach stage and unique escalation key to prevent notification storms
      const breachType = isResolutionBreached ? 'RESOLUTION_BREACH' : 'RESPONSE_BREACH';
      const escalationKey = `sla-breach-${complaint.id}-${breachType}`;

      // Check if this specific breach stage was already recorded in ComplaintTimeline
      const existingTimelineAlert = await db.complaintTimeline.findFirst({
        where: {
          complaintId: complaint.id,
          publicNote: { contains: breachType },
        },
      });

      if (existingTimelineAlert) {
        result.skippedAlreadyHandled++;
        continue;
      }

      // Mark slaBreached = true if not already marked
      if (!complaint.slaBreached) {
        await db.complaint.update({
          where: { id: complaint.id },
          data: { slaBreached: true },
        });
        result.newlyBreached++;
      }

      // Record immutable audit timeline entry
      const elapsedHours = Math.round(
        (referenceNow.getTime() -
          (isResolutionBreached ? complaint.resolutionDueAt.getTime() : complaint.responseDueAt.getTime())) /
          (1000 * 60 * 60)
      );

      const alertNote = `SLA Escalation Alert: ${breachType} (${Math.max(1, elapsedHours)}h overdue). Ticket flagged for department review.`;

      await db.complaintTimeline.create({
        data: {
          complaintId: complaint.id,
          fromStatus: complaint.status,
          toStatus: complaint.status,
          publicNote: alertNote,
          internalNote: `Automated SLA Escalation Engine: flagged by scheduled job at ${referenceNow.toISOString()}.`,
          metadata: {
            breachType,
            referenceNow: referenceNow.toISOString(),
            resolutionDueAt: complaint.resolutionDueAt.toISOString(),
            responseDueAt: complaint.responseDueAt.toISOString(),
          },
        },
      });

      // Enqueue notification for Department Admin and Zonal Supervisors with idempotency key
      await enqueueJob(
        'SEND_NOTIFICATION',
        {
          channel: 'SMS',
          recipientPhone: complaint.citizenPhone,
          templateCode: 'SLA_BREACH_ALERT_SMS',
          payload: {
            complaintRef: complaint.referenceNumber,
            department: complaint.department?.name,
            breachType,
            message: `GovAsset Alert: Complaint ${complaint.referenceNumber} has exceeded target SLA. Department supervisor notified.`,
          },
        },
        { idempotencyKey: escalationKey }
      );

      result.escalationsSent++;
    } catch (err: any) {
      result.errors.push({
        complaintId: complaint.id,
        error: err.message || 'Error processing SLA breach for ticket',
      });
    }
  }

  return result;
}
