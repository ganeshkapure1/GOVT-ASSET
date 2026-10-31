const { PrismaClient } = require('@prisma/client');

const basePrisma = new PrismaClient();

const db = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const maxRetries = 2;
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            const msg = error?.message || '';
            const isConnectionError =
              msg.includes('closed the connection') ||
              msg.includes("Can't reach database server") ||
              msg.includes('Connection terminated') ||
              msg.includes('ECONNRESET') ||
              msg.includes('ETIMEDOUT');

            if (isConnectionError && attempt < maxRetries) {
              console.log(`[DB Auto-Retry] Retrying ${model}.${operation} (attempt ${attempt + 1})...`);
              await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
              continue;
            }
            throw error;
          }
        }
        throw lastError;
      },
    },
  },
});

async function run() {
  const users = await db.user.findMany({ take: 2, select: { id: true, fullName: true } });
  console.log('Successfully queried users through retry extension:', users);
}

run()
  .catch(console.error)
  .finally(() => basePrisma.$disconnect());

