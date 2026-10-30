import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, canAccessComplaint, AuthError, getCorporationIdForJurisdiction } from '@/server/auth';
import { maskPhoneNumber } from '@/lib/pii';
import { findPotentialDuplicates, SYNTHETIC_BOUNDARY_DISCLAIMER } from '@/server/duplicate-finder';
import {
  identifyComplaintWorkType,
  evaluateWorkerSkillMatch,
  WorkTypeDefinition,
} from '@/lib/skills-taxonomy';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/v1/ops/complaints/[id]
 *
 * Operational detail view for triage officers, supervisors, and field workers.
 * Features smart work-type identification and skill-based field worker suggestions.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth([
      'OFFICER',
      'SUPERVISOR',
      'FIELD_WORKER',
      'DEPT_ADMIN',
      'PLATFORM_ADMIN',
    ]);

    const complaint = await db.complaint.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        department: true,
        jurisdiction: true,
        assignments: {
          include: {
            assignedWorker: { select: { id: true, fullName: true, phoneNumber: true, staffCode: true, designation: true } },
            assignedBy: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        timeline: {
          include: {
            actor: { select: { fullName: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Complaint not found.' } },
        { status: 404 }
      );
    }

    // Check jurisdiction and role boundary
    const isAssignedWorker = complaint.assignments.some(
      (a) => a.assignedWorkerId === session.userId && a.isActive
    );

    const hasAccess =
      canAccessComplaint(session, complaint) ||
      (session.role === 'FIELD_WORKER' && isAssignedWorker);

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied for this jurisdiction/department.' } },
        { status: 403 }
      );
    }

    // Identify Complaint Work Type & Suggest Relevant Field Workers
    let detectedWorkType: WorkTypeDefinition | null = null;
    let eligibleWorkers: any[] = [];
    let otherWorkers: any[] = [];
    let noQualifiedWorkersNotice: string | null = null;
    let potentialDuplicates: any[] = [];

    if (['OFFICER', 'SUPERVISOR', 'DEPT_ADMIN', 'PLATFORM_ADMIN'].includes(session.role)) {
      // 1. Determine Work Type
      detectedWorkType = identifyComplaintWorkType({
        categoryCode: complaint.category?.code,
        categoryName: complaint.category?.nameEn,
        title: complaint.title,
        description: complaint.description,
      });

      const complaintCorpId = complaint.jurisdictionId
        ? await getCorporationIdForJurisdiction(complaint.jurisdictionId)
        : null;

      // 2. Retrieve active workers authorized for the complaint's corporation
      // Note: Workers are NOT restricted to complaint's single ward; they serve their authorized corporation
      const workers = await db.user.findMany({
        where: {
          role: 'FIELD_WORKER',
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          staffCode: true,
          designation: true,
          skills: true,
          departmentId: true,
          jurisdictionId: true,
          assignedWorkOrders: {
            where: {
              isActive: true,
              complaint: {
                status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
              },
            },
            select: { id: true },
          },
        },
        orderBy: { fullName: 'asc' },
      });

      // Filter by Corporation isolation
      const corpWorkers: typeof workers = [];
      for (const w of workers) {
        if (!complaintCorpId || !w.jurisdictionId) {
          corpWorkers.push(w);
          continue;
        }
        const wCorpId = await getCorporationIdForJurisdiction(w.jurisdictionId);
        if (wCorpId === complaintCorpId) {
          corpWorkers.push(w);
        }
      }

      // 3. Match complaint's required work type against worker's skills
      const qualifiedList: any[] = [];
      const unqualifiedList: any[] = [];

      for (const w of corpWorkers) {
        const activeWorkload = w.assignedWorkOrders ? w.assignedWorkOrders.length : 0;

        if (detectedWorkType) {
          const evalResult = evaluateWorkerSkillMatch(w.skills, detectedWorkType, {
            workerDepartmentId: w.departmentId,
            complaintDepartmentId: complaint.departmentId,
            workerJurisdictionId: w.jurisdictionId,
            complaintJurisdictionId: complaint.jurisdictionId,
          });

          const workerPayload = {
            id: w.id,
            fullName: w.fullName,
            phoneNumber: maskPhoneNumber(w.phoneNumber),
            staffCode: w.staffCode,
            designation: w.designation,
            skills: w.skills,
            matchingSkills: evalResult.matchingSkills,
            activeWorkload,
            matchScore: evalResult.matchScore,
            isSkillMatched: evalResult.isSkillMatched,
          };

          if (evalResult.isSkillMatched) {
            qualifiedList.push(workerPayload);
          } else {
            unqualifiedList.push(workerPayload);
          }
        } else {
          // If work type is ambiguous / unclassified
          unqualifiedList.push({
            id: w.id,
            fullName: w.fullName,
            phoneNumber: maskPhoneNumber(w.phoneNumber),
            staffCode: w.staffCode,
            designation: w.designation,
            skills: w.skills,
            matchingSkills: [],
            activeWorkload,
            matchScore: 0,
            isSkillMatched: false,
          });
        }
      }

      // 4. Rank suitable qualified workers by matchScore (desc) and activeWorkload (asc)
      qualifiedList.sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        return a.activeWorkload - b.activeWorkload;
      });

      unqualifiedList.sort((a, b) => a.activeWorkload - b.activeWorkload);

      eligibleWorkers = qualifiedList;
      otherWorkers = unqualifiedList;

      if (eligibleWorkers.length === 0) {
        noQualifiedWorkersNotice =
          'No active worker with the required skills is currently available. Add or qualify a worker, or review the complaint\'s work type.';
      }

      // Search for potential duplicates within 50m and 48h
      const submissionTimeline = complaint.timeline.find((t) => t.toStatus === 'SUBMITTED');
      const meta = (submissionTimeline?.metadata as any) || {};
      const lat = typeof meta.latitude === 'number' ? meta.latitude : 19.8872;
      const lng = typeof meta.longitude === 'number' ? meta.longitude : 75.3289;

      try {
        potentialDuplicates = await findPotentialDuplicates({
          complaintId: complaint.id,
          latitude: lat,
          longitude: lng,
          categoryId: complaint.categoryId,
          referenceDate: complaint.createdAt,
        });
      } catch {
        potentialDuplicates = [];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...complaint,
        citizenPhone: maskPhoneNumber(complaint.citizenPhone),
        workType: detectedWorkType
          ? {
              id: detectedWorkType.id,
              label: detectedWorkType.label,
              departmentCode: detectedWorkType.departmentCode,
              primarySkills: detectedWorkType.primarySkills,
              description: detectedWorkType.description,
            }
          : null,
        eligibleWorkers,
        otherWorkers,
        noQualifiedWorkersNotice,
        potentialDuplicates,
        boundaryDisclaimer: SYNTHETIC_BOUNDARY_DISCLAIMER,
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
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve complaint details.' } },
      { status: 500 }
    );
  }
}
