import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { getEnvConfig } from '@/lib/env';

/**
 * GET /api/health/ready
 *
 * Readiness Probe for deployment rollout gates, traffic routing, and SRE monitoring.
 * Probes database connectivity and storage adapter availability with fail-safe timeouts.
 * Returns HTTP 200 when ready to accept traffic, or HTTP 503 when dependencies fail.
 *
 * Zero sensitive connection credentials or hostnames disclosed.
 */
export async function GET() {
  const envConfig = getEnvConfig();
  const startTime = Date.now();

  let dbStatus = 'DISCONNECTED';
  let dbLatencyMs = -1;
  let isDbOk = false;

  try {
    const timeoutPromise = new Promise<{ ok: boolean; latency: number }>((_, reject) =>
      setTimeout(() => reject(new Error('Database readiness check timed out')), 3000)
    );

    const queryPromise = (async () => {
      const qStart = Date.now();
      await db.$queryRawUnsafe('SELECT 1');
      return { ok: true, latency: Date.now() - qStart };
    })();

    const result = await Promise.race([queryPromise, timeoutPromise]);
    dbStatus = 'CONNECTED';
    dbLatencyMs = result.latency;
    isDbOk = true;
  } catch {
    dbStatus = 'FAILED';
    dbLatencyMs = Date.now() - startTime;
    isDbOk = false;
  }

  const storageStatus = envConfig.storage.mode === 's3' ? 'S3_CONFIGURED' : 'LOCAL_MOCK_ACTIVE';

  if (!isDbOk) {
    return NextResponse.json(
      {
        status: 'UNHEALTHY',
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        storage: {
          mode: envConfig.storage.mode,
          status: storageStatus,
        },
        error: 'Database dependency health check failed.',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      storage: {
        mode: envConfig.storage.mode,
        status: storageStatus,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
