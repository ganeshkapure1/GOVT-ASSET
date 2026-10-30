import { db } from '@/lib/db';
import { UserSession } from '@/lib/auth-session';
import { maskPhoneNumber } from '@/lib/pii';
import { triageComplaint, assignComplaint, TriageInput, AssignInput } from './complaint-service';
import { findPotentialDuplicates } from './duplicate-finder';
import { getCorporationIdForJurisdiction } from './auth';

/**
 * Retrieves jurisdiction-scoped and department-scoped complaints for the triage queue.
 */
export async function getTriageQueue(session: UserSession) {
  const whereConditions: any = {};

  if (session.role === 'OFFICER' || session.role === 'DEPT_ADMIN' || session.role === 'SUPERVISOR') {
    if (session.departmentId) {
      whereConditions.departmentId = session.departmentId;
    }

    if (session.jurisdictionId) {
      const corpId = await getCorporationIdForJurisdiction(session.jurisdictionId);
      if (corpId) {
        const zones = await db.jurisdiction.findMany({
          where: { parentId: corpId, level: 'ZONE' },
          select: { id: true },
        });
        const zoneIds = zones.map((z) => z.id);
        const childJurs = await db.jurisdiction.findMany({
          where: {
            OR: [
              { parentId: { in: zoneIds } },
              { parentId: corpId },
            ],
          },
          select: { id: true },
        });
        const allCorpJurIds = [corpId, ...zoneIds, ...childJurs.map((c) => c.id)];
        whereConditions.jurisdictionId = { in: allCorpJurIds };
      } else {
        whereConditions.jurisdictionId = session.jurisdictionId;
      }
    }
  }

  const complaints = await db.complaint.findMany({
    where: whereConditions,
    include: {
      category: { select: { nameEn: true, code: true } },
      jurisdiction: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } },
      assignments: {
        where: { isActive: true },
        select: {
          assignedWorker: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return complaints.map((c) => ({
    ...c,
    citizenPhone: maskPhoneNumber(c.citizenPhone),
    assignedWorker: c.assignments[0]?.assignedWorker?.fullName || null,
  }));
}

export { triageComplaint, assignComplaint, findPotentialDuplicates };
export type { TriageInput, AssignInput };
