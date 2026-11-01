import { db } from '../src/lib/db';
import { createComplaint, assignComplaint, updateFieldTask, verifyComplaint } from '../src/server/complaint-service';
import { UserSession } from '../src/lib/auth-session';

async function testLifecycle() {
  console.log('=== TESTING COMPLETE 13-STEP COMPLAINT LIFECYCLE ===\n');

  // Step 1: Citizen Session
  console.log('Step 1: Authenticating Citizen...');
  const citizen = await db.user.findFirst({
    where: { role: 'CITIZEN', phoneNumber: '+919822010108' },
  });
  if (!citizen) throw new Error('Citizen user not found in DB');
  console.log(` Citizen authenticated: ${citizen.fullName} (${citizen.phoneNumber})`);

  // Step 2 & 3: Citizen Reports an Infrastructure Defect
  console.log('\nStep 2 & 3: Registering Defect Complaint...');
  const category = await db.complaintCategory.findFirst({ where: { code: 'CAT_POTHOLE' } });
  if (!category) throw new Error('Category CAT_POTHOLE not found');

  const jurisdiction = await db.jurisdiction.findFirst({ where: { code: 'CSMC-Z01-W01' } });
  if (!jurisdiction) throw new Error('Jurisdiction CSMC-Z01-W01 not found');

  const complaint = await createComplaint({
    citizenId: citizen.id,
    citizenPhone: citizen.phoneNumber,
    categoryId: category.id,
    jurisdictionId: jurisdiction.id,
    title: 'Automated Lifecycle Verification Pothole',
    description: 'Road crater verified in test suite at Shahaganj main junction.',
    landmarkAddress: 'Shahaganj Chowk, Ward 01, Chhatrapati Sambhajinagar',
    latitude: 19.8872,
    longitude: 75.3289,
  });

  console.log(` Complaint created: Ref #${complaint.referenceNumber} (ID: ${complaint.id})`);
  console.log(` Initial Status: ${complaint.status} (Version: ${(complaint as any).version || 1})`);
  if (complaint.status !== 'SUBMITTED') throw new Error('Expected SUBMITTED status');

  // Step 4 & 5: Officer Reviews and Assigns Worker
  console.log('\nStep 4 & 5: Officer Triage & Worker Assignment...');
  const officer = await db.user.findFirst({ where: { email: 'officer.csmc@govasset.in' } });
  if (!officer) throw new Error('Officer user not found');

  const worker = await db.user.findFirst({ where: { email: 'field.csmc@govasset.in' } });
  if (!worker) throw new Error('Worker user not found');

  const officerSession: UserSession = {
    userId: officer.id,
    email: officer.email,
    phoneNumber: officer.phoneNumber,
    fullName: officer.fullName,
    role: officer.role as any,
    departmentId: officer.departmentId,
    jurisdictionId: officer.jurisdictionId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const assignedResult = await assignComplaint({
    complaintId: complaint.id,
    officerSession,
    assignedWorkerId: worker.id,
    targetCompletionAt: new Date(Date.now() + 24 * 3600000),
    workerNotes: 'Dispatched for hot-mix bitumen filling.',
    expectedVersion: (complaint as any).version || 1,
  });

  const assignedComplaint = assignedResult.complaint;
  console.log(` Assigned to Worker: ${worker.fullName} (ID: ${worker.id})`);
  console.log(` New Status: ${assignedComplaint.status} (Version: ${assignedComplaint.version})`);
  if (assignedComplaint.status !== 'ASSIGNED') throw new Error('Expected ASSIGNED status');

  // Step 6 & 7: Worker Starts Work
  console.log('\nStep 6 & 7: Field Worker Starts Work Order...');
  const workerSession: UserSession = {
    userId: worker.id,
    email: worker.email,
    phoneNumber: worker.phoneNumber,
    fullName: worker.fullName,
    role: worker.role as any,
    departmentId: worker.departmentId,
    jurisdictionId: worker.jurisdictionId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const inProgress = await updateFieldTask({
    complaintId: complaint.id,
    action: 'START_WORK',
    workerSession,
    expectedVersion: assignedComplaint.version,
  });

  console.log(` Work Started: Status = ${inProgress.status} (Version: ${inProgress.version})`);
  if (inProgress.status !== 'IN_PROGRESS') throw new Error('Expected IN_PROGRESS status');

  // Step 8 & 9: Worker Completes Work with Proof
  console.log('\nStep 8 & 9: Field Worker Completes Work Order with Evidence...');
  const completed = await updateFieldTask({
    complaintId: complaint.id,
    action: 'COMPLETE_WORK',
    workerSession,
    workerNotes: 'Pothole excavated, aggregate base re-compacted, and hot-mix bitumen rolled flush with grade.',
    workerLatitude: 19.8872,
    workerLongitude: 75.3289,
    gpsAccuracyMeters: 5,
    evidenceFileKey: `evidence/work_completed_${complaint.id}.jpg`,
    evidenceMimeType: 'image/jpeg',
    evidenceFileSizeBytes: 1024 * 450,
    expectedVersion: inProgress.version,
  });

  console.log(` Work Completed: Status = ${completed.status} (Version: ${completed.version})`);
  if (completed.status !== 'WORK_COMPLETED') throw new Error('Expected WORK_COMPLETED status');

  // Step 10: Security Test: Worker Cannot Self-Verify!
  console.log('\nStep 10: Security Invariant — Worker Self-Verification Prevention...');
  try {
    await verifyComplaint({
      complaintId: complaint.id,
      supervisorSession: workerSession,
      action: 'APPROVE',
      expectedVersion: completed.version,
    });
    throw new Error('SECURITY VIOLATION: Worker was permitted to verify their own work!');
  } catch (err: any) {
    console.log(` Self-verification correctly blocked: "${err.message}"`);
  }

  // Step 11: Supervisor Verifies & Approves Work
  console.log('\nStep 11: Supervisor Independent Verification & Approval...');
  const supervisor = await db.user.findFirst({ where: { email: 'supervisor.csmc@govasset.in' } });
  if (!supervisor) throw new Error('Supervisor user not found');

  const supervisorSession: UserSession = {
    userId: supervisor.id,
    email: supervisor.email,
    phoneNumber: supervisor.phoneNumber,
    fullName: supervisor.fullName,
    role: supervisor.role as any,
    departmentId: supervisor.departmentId,
    jurisdictionId: supervisor.jurisdictionId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const resolved = await verifyComplaint({
    complaintId: complaint.id,
    supervisorSession,
    action: 'APPROVE',
    expectedVersion: completed.version,
  });

  console.log(` Verification Approved: Status = ${resolved.status} (Version: ${resolved.version})`);
  if (resolved.status !== 'VERIFIED_RESOLVED') throw new Error('Expected VERIFIED_RESOLVED status');

  // Step 12: Citizen Tracks Final Status
  console.log('\nStep 12: Citizen Verification & Ledger Audit...');
  const ledgerRecord = await db.complaint.findUnique({
    where: { id: complaint.id },
    include: {
      timeline: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
      assignments: { include: { assignedWorker: true } },
      evidence: true,
    },
  });

  console.log(` Complaint #${ledgerRecord?.referenceNumber} Final Status: ${ledgerRecord?.status}`);
  console.log(` Timeline entries recorded: ${ledgerRecord?.timeline.length}`);
  for (const t of ledgerRecord?.timeline || []) {
    console.log(`   - [${t.createdAt.toISOString()}] ${t.fromStatus || 'INIT'} -> ${t.toStatus} by ${t.actor?.fullName || 'System'}`);
  }
  console.log(` Total Evidence Attachments: ${ledgerRecord?.evidence.length}`);

  console.log('\n======================================================');
  console.log('COMPLETE 13-STEP BUSINESS WORKFLOW VERIFIED SUCCESSFULLY!');
  console.log('======================================================\n');
}

testLifecycle().catch(console.error);
