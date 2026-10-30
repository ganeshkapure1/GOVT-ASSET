import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getLiveness } from '@/app/api/health/route';
import { GET as getReadiness } from '@/app/api/health/ready/route';
import { db } from '@/lib/db';

describe('Phase 11: Production Health & Liveness Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/health (Liveness Probe)', () => {
    it('returns 200 OK with UP status and runtime metadata', async () => {
      const response = await getLiveness();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe('UP');
      expect(json.service).toBe('govasset-platform');
      expect(json.version).toBe('0.1.0');
      expect(json.timestamp).toBeDefined();
      expect(typeof json.uptime).toBe('number');

      // Verify no sensitive internal strings or passwords
      const serialized = JSON.stringify(json);
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('DATABASE_URL');
    });
  });

  describe('GET /api/health/ready (Readiness Probe)', () => {
    it('returns 200 HEALTHY when database connection check succeeds', async () => {
      vi.spyOn(db, '$queryRawUnsafe').mockResolvedValue([{ 1: 1 }] as any);

      const response = await getReadiness();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe('HEALTHY');
      expect(json.database.status).toBe('CONNECTED');
      expect(json.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(json.storage).toBeDefined();

      // Verify zero leak of connection strings or pooler URLs
      const serialized = JSON.stringify(json);
      expect(serialized).not.toContain('postgres:');
      expect(serialized).not.toContain('supabase.co');
      expect(serialized).not.toContain('pooler');
    });

    it('returns 503 UNHEALTHY when database connection fails without leaking error secrets', async () => {
      vi.spyOn(db, '$queryRawUnsafe').mockRejectedValue(
        new Error('Can not reach database server at aws-0-ap-northeast-1.pooler.supabase.com:6543')
      );

      const response = await getReadiness();
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json.status).toBe('UNHEALTHY');
      expect(json.database.status).toBe('FAILED');
      expect(json.error).toBe('Database dependency health check failed.');

      // Strict check: raw error with hostname/port is NOT leaked to caller
      const serialized = JSON.stringify(json);
      expect(serialized).not.toContain('aws-0-ap-northeast-1.pooler.supabase.com');
      expect(serialized).not.toContain(':6543');
    });
  });
});
