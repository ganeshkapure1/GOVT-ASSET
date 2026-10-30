import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Lightweight Liveness Probe for container orchestrators (Docker, Kubernetes)
 * and edge load balancers. Verifies that the HTTP runtime process is alive.
 *
 * Zero secrets or internal infrastructure details disclosed.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
      service: 'govasset-platform',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
