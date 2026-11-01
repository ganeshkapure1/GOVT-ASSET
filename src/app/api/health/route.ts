import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEnvConfig } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Comprehensive Production System Health & Availability Monitor.
 * Evaluates:
 * - Application Runtime & Process Uptime
 * - Prisma PostgreSQL Connection (with 3-second fail-safe timeout)
 * - Supabase Project & Auth Configuration
 * - Required Production Environment Variables Presence
 * - Storage Availability (S3 / Local Mock)
 *
 * Security: Zero credentials, passwords, database hostnames, or secret keys disclosed.
 */
export async function GET() {
  const startTime = Date.now();
  const uptime = process.uptime();
  const envConfig = getEnvConfig();

  // 1. Probe database with strict 3000ms timeout
  let dbStatus = 'DISCONNECTED';
  let dbLatencyMs = -1;
  let isDbHealthy = false;

  try {
    const timeoutPromise = new Promise<{ ok: boolean; latency: number }>((_, reject) =>
      setTimeout(() => reject(new Error('Database ping timed out after 3000ms')), 3000)
    );

    const queryPromise = (async () => {
      const qStart = Date.now();
      await db.$queryRawUnsafe('SELECT 1');
      return { ok: true, latency: Date.now() - qStart };
    })();

    const result = await Promise.race([queryPromise, timeoutPromise]);
    dbStatus = 'CONNECTED';
    dbLatencyMs = result.latency;
    isDbHealthy = true;
  } catch {
    dbStatus = 'FAILED';
    dbLatencyMs = Date.now() - startTime;
    isDbHealthy = false;
  }

  // 2. Storage status
  const storageStatus = envConfig.storage.mode === 's3' ? 'S3_CONFIGURED' : 'LOCAL_MOCK_ACTIVE';

  // 3. Supabase configuration audit (boolean flags only)
  const supabaseAudit = {
    urlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  // 4. SMS & Auth status
  const smsProviderStatus = process.env.TEXTBEE_API_KEY
    ? 'TEXTBEE_LIVE'
    : process.env.FAST2SMS_API_KEY
    ? 'FAST2SMS_LIVE'
    : process.env.MSG91_AUTH_KEY
    ? 'MSG91_LIVE'
    : process.env.ENABLE_DEMO_OTP === 'true'
    ? 'DEMO_EVALUATION'
    : 'UNCONFIGURED';

  const isHealthy = isDbHealthy;

  const payload = {
    status: isHealthy ? 'UP' : 'UNHEALTHY',
    service: 'govasset-platform',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      pooled: envConfig.database.isPooled,
    },
    storage: {
      mode: envConfig.storage.mode,
      status: storageStatus,
    },
    supabase: supabaseAudit,
    auth: {
      status: 'CONFIGURED',
      demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.ENABLE_DEMO_OTP === 'true',
      smsGateway: smsProviderStatus,
    },
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json',
    },
  });
}
