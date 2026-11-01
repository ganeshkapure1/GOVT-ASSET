import { GET as getHealth } from '@/app/api/health/route';

/**
 * GET /api/v1/health
 *
 * REST API v1 Health & Diagnostics Alias.
 * Re-exports the comprehensive system health probe.
 */
export const GET = getHealth;

