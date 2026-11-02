import { PrismaClient } from '@prisma/client';
import { hashPassword, PILOT_DEV_PASSWORD } from '../src/lib/auth-crypto';

const prisma = new PrismaClient();

/**
 * Safe, idempotent development-only demo account seeder.
 * Upserts the core demo accounts without modifying or deleting existing complaints,
 * assignments, or citizen records.
 */
export async function seedDemoAccounts() {
  console.log('Ensuring development demo accounts exist in database...');

  // 1. Locate or verify CSMC Ward 01 jurisdiction
  let csmcWard = await prisma.jurisdiction.findFirst({
    where: {
      OR: [
        { code: 'CSMC-Z01-W01' },
        { name: { contains: 'Shahaganj', mode: 'insensitive' } },
      ],
    },
  });

  let csmcCorp = await prisma.jurisdiction.findFirst({
    where: {
      OR: [
        { code: 'CSMC-01' },
        { code: 'CSMC' },
        { name: { contains: 'Sambhajinagar', mode: 'insensitive' } },
      ],
      level: 'DISTRICT_CORP',
    },
  });

  // 2. Locate or verify PWD Road Maintenance department
  let roadDept = await prisma.department.findFirst({
    where: {
      OR: [
        { code: 'ROAD_MAINTENANCE' },
        { code: 'PWD' },
      ],
    },
  });

  const demoAccounts = [
    {
      id: '66666666-6666-6666-6666-666666660101',
      phone: '+919822010101',
      email: 'officer.csmc@govasset.in',
      fullName: 'Sachin Waghmare (CSMC Civic Triage Officer)',
      role: 'OFFICER' as const,
      staffCode: 'CSMC-OFF-01',
      designation: 'Municipal Civic Triage Officer',
      skills: 'Civic Triage, Work Order Dispatch',
      departmentId: null,
      jurisdictionId: csmcCorp?.id || null,
    },
    {
      id: '66666666-6666-6666-6666-666666660102',
      phone: '+919822010102',
      email: 'supervisor.csmc@govasset.in',
      fullName: 'Pooja Gaikwad (CSMC Zone 1 Roads Supervisor)',
      role: 'SUPERVISOR' as const,
      staffCode: 'CSMC-SUP-01',
      designation: 'Civil Maintenance Supervisor',
      skills: 'Quality Inspection, Verification Approval',
      departmentId: roadDept?.id || null,
      jurisdictionId: csmcWard?.id || null,
    },
    {
      id: '66666666-6666-6666-6666-666666660103',
      phone: '+919822010103',
      email: 'field.csmc@govasset.in',
      fullName: 'Ganesh Shinde (CSMC Road Crew Lead #1)',
      role: 'FIELD_WORKER' as const,
      staffCode: 'CSMC-WRK-01',
      designation: 'Senior Asphalt Compactor Lead',
      skills: 'Road Repair, Asphalt Paving, Roller Operation, Cold Mix Patching',
      departmentId: roadDept?.id || null,
      jurisdictionId: csmcWard?.id || null,
    },
    {
      id: '66666666-6666-6666-6666-666666660001',
      phone: '+919822010001',
      email: 'admin@govasset.in',
      fullName: 'Rajesh Sharma (Platform Administrator)',
      role: 'PLATFORM_ADMIN' as const,
      staffCode: 'GOV-ADM-001',
      designation: 'Chief Technology Director',
      skills: 'System Oversight, Cross-Corp Administration',
      departmentId: null,
      jurisdictionId: null,
    },
  ];

  const defaultPasswordHash = await hashPassword(PILOT_DEV_PASSWORD);

  for (const acc of demoAccounts) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: acc.email },
          { phoneNumber: acc.phone },
        ],
      },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: acc.email,
          fullName: acc.fullName,
          role: acc.role,
          staffCode: acc.staffCode,
          designation: acc.designation,
          skills: acc.skills,
          isActive: true,
          passwordHash: defaultPasswordHash,
          ...(acc.departmentId ? { departmentId: acc.departmentId } : {}),
          ...(acc.jurisdictionId ? { jurisdictionId: acc.jurisdictionId } : {}),
        },
      });
      console.log(`Updated active demo account: ${acc.email} (${acc.role})`);
    } else {
      await prisma.user.create({
        data: {
          id: acc.id,
          phoneNumber: acc.phone,
          email: acc.email,
          fullName: acc.fullName,
          role: acc.role,
          staffCode: acc.staffCode,
          designation: acc.designation,
          skills: acc.skills,
          isActive: true,
          passwordHash: defaultPasswordHash,
          departmentId: acc.departmentId,
          jurisdictionId: acc.jurisdictionId,
        },
      });
      console.log(`Created new demo account: ${acc.email} (${acc.role})`);
    }
  }

  console.log(`Demo accounts verification complete. Development password for all demo accounts is "${PILOT_DEV_PASSWORD}".`);
}

if (require.main === module) {
  seedDemoAccounts()
    .catch((err) => {
      console.error('Failed to seed demo accounts:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
