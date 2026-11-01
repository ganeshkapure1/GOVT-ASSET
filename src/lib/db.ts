import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance configured for Next.js App Router and
 * Supabase Managed PostgreSQL with automatic transient connection retry.
 * Prevents intermittent "closed the connection" and "Can't reach database server"
 * errors from interrupting user operations.
 */
function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  let tuned = url;
  if (tuned) {
    const separator = tuned.includes('?') ? '&' : '?';
    if (!tuned.includes('connect_timeout')) {
      tuned += `${separator}connect_timeout=30`;
    }
    if (!tuned.includes('pool_timeout')) {
      tuned += `${tuned.includes('?') ? '&' : '?'}pool_timeout=60`;
    }
  }

  const baseClient = new PrismaClient({
    datasources: tuned ? { db: { url: tuned } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const maxRetries = 2;
          let lastError: any;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await query(args);
            } catch (error: any) {
              lastError = error;
              const msg = error?.message || '';
              const code = error?.code || '';
              const isConnectionError =
                code === 'P1001' ||
                code === 'P1002' ||
                code === 'P1008' ||
                code === 'P1017' ||
                code === 'P2024' ||
                msg.includes('closed the connection') ||
                msg.includes("Can't reach database server") ||
                msg.includes('Connection terminated') ||
                msg.includes('connection closed unexpectedly') ||
                msg.includes('ECONNRESET') ||
                msg.includes('ETIMEDOUT') ||
                msg.includes('Socket closed');

              if (isConnectionError && attempt < maxRetries) {
                console.warn(
                  `[Prisma DB Auto-Retry] Reconnecting for ${model}.${operation} (attempt ${attempt + 1}/${maxRetries})...`
                );
                await new Promise((resolve) => setTimeout(resolve, 350 * Math.pow(2, attempt)));
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
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const db: ExtendedPrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

// In serverless / Node environments, cache on globalThis to share pool across warm lambdas
globalForPrisma.prisma = db;

/**
 * Executes an arbitrary database operation with automatic transient network retry
 * using exponential backoff.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 350
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const msg = error?.message || '';
      const code = error?.code || '';
      const isTransient =
        code === 'P1001' ||
        code === 'P1002' ||
        code === 'P1008' ||
        code === 'P1017' ||
        code === 'P2024' ||
        msg.includes('closed the connection') ||
        msg.includes("Can't reach database server") ||
        msg.includes('Connection terminated') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT');

      if (isTransient && attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, baseDelayMs * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
