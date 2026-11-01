import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/live
 *
 * Lightweight Liveness Probe for edge gateways, reverse proxies, and Kubernetes.
 * Verifies that the HTTP server process is responsive without querying databases.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'UP',
      service: 'govasset-platform',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

