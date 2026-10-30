import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance configured for Next.js App Router and
 * Supabase Connection Pooling (via Supavisor transaction pooler).
 * Prevents multiple client instances during hot-reloads in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
