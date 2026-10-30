const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('--- Inspecting Database Jurisdictions ---');
  const jurisdictions = await prisma.jurisdiction.findMany({
    select: { id: true, name: true, code: true, level: true, parentId: true },
    orderBy: { level: 'asc' }
  });
  console.log(`Total Jurisdictions: ${jurisdictions.length}`);
  console.log(jurisdictions);

  console.log('--- Inspecting Database Complaints ---');
  const complaints = await prisma.complaint.findMany({
    select: { id: true, referenceNumber: true, status: true, jurisdictionId: true, landmarkAddress: true }
  });
  console.log(complaints);

  console.log('--- Inspecting Users ---');
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, phoneNumber: true, email: true, role: true, jurisdictionId: true }
  });
  console.log(users);
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
