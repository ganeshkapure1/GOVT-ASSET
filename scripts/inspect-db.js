const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('--- Inspecting Database Complaints ---');
  const complaints = await prisma.complaint.findMany({
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      category: true,
      departmentId: true,
      jurisdictionId: true,
      landmarkAddress: true,
      title: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Complaints count:', complaints.length);
  for (const c of complaints) {
    console.log(JSON.stringify(c));
  }
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
