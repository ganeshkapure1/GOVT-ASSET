import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEnvConfig } from '@/lib/env';

/**
 * GET /api/health/ready
 *
 * Readiness Probe for deployment rollout gates and traffic routing.
 * Probes database connectivity and storage adapter availability.
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
    // Probe database with minimal query
    await db.$queryRawUnsafe('SELECT 1');
    dbStatus = 'CONNECTED';
    dbLatencyMs = Date.now() - startTime;
    isDbOk = true;
  } catch (err: any) {
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
