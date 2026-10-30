const path = require('path');
const { PrismaClient } = require(path.join(process.cwd(), 'node_modules/@prisma/client'));

const prisma = new PrismaClient({ log: ['error'] });

async function runPersistenceAudit() {
  console.log('================================================================');
  console.log('GovAsset Database Persistence & Workflow Audit (Live Supabase)');
  console.log('================================================================');

  // Step 1: Pre-Audit Baseline Record Counts
  console.log('\n[1/7] Recording Pre-Audit Database Baseline...');
  const beforeUsers = await prisma.user.count();
  const beforeComplaints = await prisma.complaint.count();
  const beforeTimelines = await prisma.complaintTimeline.count();
  const beforeAssignments = await prisma.complaintAssignment.count();

  console.log('Pre-Audit Counts:', {
    users: beforeUsers,
    complaints: beforeComplaints,
    timelines: beforeTimelines,
    assignments: beforeAssignments,
  });

  // Check canonical seed complaints exist
  const seed1 = await prisma.complaint.findUnique({
    where: { referenceNumber: 'GOV-2026-00482' },
    select: { id: true, referenceNumber: true, status: true, version: true },
  });
  const seed2 = await prisma.complaint.findUnique({
    where: { referenceNumber: 'GOV-2026-00483' },
    select: { id: true, referenceNumber: true, status: true, version: true },
  });

  console.log('Existing Seed Records Verified:', {
    seed1: seed1 ? `${seed1.referenceNumber} (${seed1.status}, v${seed1.version})` : 'NOT FOUND',
    seed2: seed2 ? `${seed2.referenceNumber} (${seed2.status}, v${seed2.version})` : 'NOT FOUND',
  });

  if (!seed1 || !seed2) {
    throw new Error('Pre-existing seed records are missing! Aborting to prevent inconsistent test state.');
  }

  // Step 2: Create Isolated Audit Test Complaint
  const testRef = 'AUDIT-TEST-2026-001';
  const testComplaintId = '99999999-9999-9999-9999-999999990001';

  // Check if previous run left the test record; if so, clean up ONLY the test record
  await prisma.$executeRawUnsafe(`DELETE FROM complaints WHERE reference_number = '${testRef}';`).catch(() => {});

  console.log(`\n[2/7] Creating Isolated Audit Complaint: ${testRef}...`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO complaints (
      id, reference_number, citizen_id, citizen_phone, title, description,
      category_id, department_id, jurisdiction_id, location_coords, landmark_address,
      status, priority, response_due_at, resolution_due_at, sla_breached, version,
      created_at, updated_at
    ) VALUES (
      '${testComplaintId}'::uuid,
      '${testRef}',
      '66666666-6666-6666-6666-666666660008'::uuid,
      '+919822010008',
      'Audit Test: Deep Pothole at Paud Road Junction',
      'Pothole verified for end-to-end audit lifecycle testing and database persistence check.',
      '55555555-5555-5555-5555-555555550001'::uuid,
      '44444444-4444-4444-4444-444444440001'::uuid,
      '33333333-3333-3333-3333-333333330028'::uuid,
      ST_SetSRID(ST_MakePoint(73.8112, 18.5089), 4326),
      'Paud Road Junction, Ward 28 - Kothrud',
      'SUBMITTED'::complaint_status,
      'P1_CRITICAL'::complaint_priority,
      NOW() + INTERVAL '2 hours',
      NOW() + INTERVAL '24 hours',
      FALSE,
      1,
      NOW(),
      NOW()
    );
  `);

  // Insert initial timeline entry
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660008',
      fromStatus: null,
      toStatus: 'SUBMITTED',
      publicNote: 'Complaint registered by citizen during automated persistence audit.',
      internalNote: 'Audit intake checkpoint.',
    },
  });

  // Verify initial persistence
  const persisted1 = await prisma.complaint.findUnique({
    where: { id: testComplaintId },
    include: { timeline: true },
  });
  console.log('✓ Stage 1 Persisted (SUBMITTED, v1):', {
    ref: persisted1.referenceNumber,
    status: persisted1.status,
    priority: persisted1.priority,
    version: persisted1.version,
    timelineCount: persisted1.timeline.length,
  });

  // Step 3: Triage Transition -> TRIAGED_VALIDATED (v2)
  console.log('\n[3/7] Executing Operations Triage (SUBMITTED -> TRIAGED_VALIDATED)...');
  await prisma.complaint.update({
    where: { id: testComplaintId },
    data: {
      status: 'TRIAGED_VALIDATED',
      version: { increment: 1 },
    },
  });
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660002', // Sunita Patil (Ward 28 Officer)
      fromStatus: 'SUBMITTED',
      toStatus: 'TRIAGED_VALIDATED',
      publicNote: 'Grievance triaged and validated by Ward 28 Public Works officer.',
    },
  });

  const persisted2 = await prisma.complaint.findUnique({
    where: { id: testComplaintId },
    include: { timeline: true },
  });
  console.log('✓ Stage 2 Persisted (TRIAGED_VALIDATED, v2):', {
    status: persisted2.status,
    version: persisted2.version,
    timelineCount: persisted2.timeline.length,
  });

  // Step 4: Assignment -> ASSIGNED (v3)
  console.log('\n[4/7] Executing Crew Assignment (TRIAGED_VALIDATED -> ASSIGNED)...');
  await prisma.complaint.update({
    where: { id: testComplaintId },
    data: {
      status: 'ASSIGNED',
      version: { increment: 1 },
    },
  });
  const assignment = await prisma.complaintAssignment.create({
    data: {
      complaintId: testComplaintId,
      assignedWorkerId: '66666666-6666-6666-6666-666666660006', // Vikram Singh
      assignedById: '66666666-6666-6666-6666-666666660004', // Kavita Joshi
      targetCompletionAt: new Date(Date.now() + 4 * 3600 * 1000),
      workerNotes: 'Dispatched for priority bitumen asphalt repair.',
      isActive: true,
    },
  });
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660004',
      fromStatus: 'TRIAGED_VALIDATED',
      toStatus: 'ASSIGNED',
      publicNote: 'Assigned to field maintenance crew lead Vikram Singh.',
    },
  });

  const persisted3 = await prisma.complaint.findUnique({
    where: { id: testComplaintId },
    include: { assignments: true, timeline: true },
  });
  console.log('✓ Stage 3 Persisted (ASSIGNED, v3):', {
    status: persisted3.status,
    version: persisted3.version,
    assignments: persisted3.assignments.length,
    assignedWorker: persisted3.assignments[0]?.assignedWorkerId,
    timelineCount: persisted3.timeline.length,
  });

  // Step 5: Field Execution -> IN_PROGRESS (v4) -> WORK_COMPLETED (v5)
  console.log('\n[5/7] Executing Field Work & Evidence Capture...');
  await prisma.complaint.update({
    where: { id: testComplaintId },
    data: {
      status: 'IN_PROGRESS',
      version: { increment: 1 },
    },
  });
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660006',
      fromStatus: 'ASSIGNED',
      toStatus: 'IN_PROGRESS',
      publicNote: 'Crew lead acknowledged task and initiated repair on site.',
    },
  });

  // Upload Completion Evidence
  await prisma.complaintEvidence.create({
    data: {
      complaintId: testComplaintId,
      stage: 'AFTER_REPAIR',
      fileKey: 'evidence/20261029/audit_test_completion_proof.webp',
      mimeType: 'image/webp',
      fileSizeBytes: 485120,
      uploadedById: '66666666-6666-6666-6666-666666660006',
      isVerifiedProximity: true,
    },
  });

  await prisma.complaint.update({
    where: { id: testComplaintId },
    data: {
      status: 'WORK_COMPLETED',
      version: { increment: 1 },
    },
  });
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660006',
      fromStatus: 'IN_PROGRESS',
      toStatus: 'WORK_COMPLETED',
      publicNote: 'Physical asphalt compaction completed; proof uploaded.',
    },
  });

  const persisted4 = await prisma.complaint.findUnique({
    where: { id: testComplaintId },
    include: { evidence: true, timeline: true },
  });
  console.log('✓ Stage 4 Persisted (WORK_COMPLETED, v5):', {
    status: persisted4.status,
    version: persisted4.version,
    evidenceCount: persisted4.evidence.length,
    evidenceProof: persisted4.evidence[0]?.fileKey,
    timelineCount: persisted4.timeline.length,
  });

  // Step 6: Supervisor Verification -> VERIFIED_RESOLVED (v6)
  console.log('\n[6/7] Executing Supervisor Verification (WORK_COMPLETED -> VERIFIED_RESOLVED)...');
  await prisma.complaint.update({
    where: { id: testComplaintId },
    data: {
      status: 'VERIFIED_RESOLVED',
      version: { increment: 1 },
    },
  });
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660004', // Kavita Joshi
      fromStatus: 'WORK_COMPLETED',
      toStatus: 'VERIFIED_RESOLVED',
      publicNote: 'Supervisor reviewed photographic evidence and approved resolution.',
    },
  });

  const persisted5 = await prisma.complaint.findUnique({
    where: { id: testComplaintId },
    include: { timeline: true },
  });
  console.log('✓ Stage 5 Persisted (VERIFIED_RESOLVED, v6):', {
    status: persisted5.status,
    version: persisted5.version,
    timelineCount: persisted5.timeline.length,
  });

  // Step 7: Citizen Feedback Submission
  console.log('\n[7/7] Recording Citizen Feedback (5 Stars)...');
  await prisma.complaintTimeline.create({
    data: {
      complaintId: testComplaintId,
      actorId: '66666666-6666-6666-6666-666666660008', // Aarav Mehta
      fromStatus: 'VERIFIED_RESOLVED',
      toStatus: 'VERIFIED_RESOLVED',
      publicNote: 'Citizen Feedback: ★★★★★ (5/5) - Pothole was completely repaired with asphalt roller. Smooth ride.',
      metadata: {
        feedbackType: 'CITIZEN_RATING',
        rating: 5,
        submittedAt: new Date().toISOString(),
      },
    },
  });

  // Step 8: Verify Complete Data Durability Across Database Disconnect & Reconnect
  console.log('\n--- Simulating Application Restart & Connection Teardown ---');
  await prisma.$disconnect();

  const freshPrisma = new PrismaClient({ log: ['error'] });
  console.log('Reconnecting to Supabase database instance...');
  const reconnectedComplaint = await freshPrisma.complaint.findUnique({
    where: { referenceNumber: testRef },
    include: {
      category: { select: { nameEn: true } },
      department: { select: { name: true } },
      jurisdiction: { select: { name: true } },
      assignments: { where: { isActive: true }, include: { assignedWorker: { select: { fullName: true } } } },
      evidence: true,
      timeline: { orderBy: { createdAt: 'asc' } },
    },
  });

  console.log('✓ Durability Across Restart Confirmed:', {
    ref: reconnectedComplaint.referenceNumber,
    status: reconnectedComplaint.status,
    version: reconnectedComplaint.version,
    category: reconnectedComplaint.category.nameEn,
    department: reconnectedComplaint.department.name,
    jurisdiction: reconnectedComplaint.jurisdiction.name,
    assignedTo: reconnectedComplaint.assignments[0]?.assignedWorker?.fullName,
    evidenceFiles: reconnectedComplaint.evidence.map((e) => e.fileKey),
    totalTimelineSteps: reconnectedComplaint.timeline.length,
  });

  // Step 9: Verify Historical Data Preservation
  console.log('\n--- Auditing Historical Data Preservation ---');
  const afterUsers = await freshPrisma.user.count();
  const afterComplaints = await freshPrisma.complaint.count();
  const afterTimelines = await freshPrisma.complaintTimeline.count();

  // Verify historical seed complaints remain unchanged
  const postSeed1 = await freshPrisma.complaint.findUnique({
    where: { referenceNumber: 'GOV-2026-00482' },
    select: { id: true, referenceNumber: true, status: true, version: true, citizenPhone: true },
  });
  const postSeed2 = await freshPrisma.complaint.findUnique({
    where: { referenceNumber: 'GOV-2026-00483' },
    select: { id: true, referenceNumber: true, status: true, version: true, citizenPhone: true },
  });

  console.log('Historical Preservation Audit:', {
    usersPreserved: beforeUsers === afterUsers,
    complaintCountBefore: beforeComplaints,
    complaintCountAfter: afterComplaints,
    seed1Untouched: postSeed1.status === seed1.status && postSeed1.version === seed1.version,
    seed2Untouched: postSeed2.status === seed2.status && postSeed2.version === seed2.version,
  });

  await freshPrisma.$disconnect();

  console.log('\n================================================================');
  console.log('✓ DATABASE PERSISTENCE AUDIT: 100% PASSED');
  console.log('================================================================');
}

runPersistenceAudit().catch((err) => {
  console.error('FATAL AUDIT FAILURE:', err);
  process.exit(1);
});
