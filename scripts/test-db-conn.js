const { PrismaClient } = require('@prisma/client');

async function test() {
  console.log('Testing DATABASE_URL:', process.env.DATABASE_URL?.split('@')[1]);
  const p1 = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const u1 = await p1.user.findFirst();
    console.log('Pooler 6543 success:', Boolean(u1));
  } catch (e) {
    console.log('Pooler 6543 error:', e.message);
  } finally {
    await p1.$disconnect();
  }

  console.log('Testing DIRECT_URL:', process.env.DIRECT_URL?.split('@')[1]);
  const p2 = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const u2 = await p2.user.findFirst();
    console.log('Direct 5432 success:', Boolean(u2));
  } catch (e) {
    console.log('Direct 5432 error:', e.message);
  } finally {
    await p2.$disconnect();
  }
}

test();
