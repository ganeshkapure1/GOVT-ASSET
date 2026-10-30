import { describe, it, expect } from 'vitest';
import { validateProductionEnv, getEnvConfig, EnvValidationError } from '@/lib/env';

describe('Phase 11: Production Environment Validation & Security Configuration', () => {
  const validProductionEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://postgres.testref:secretpass@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    AUTH_SECRET: 'f9a8d7c6b5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8', // 64 chars
    CRON_SECRET: 'super_secure_cron_secret_key_123', // 32 chars
    S3_MOCK: '1',
    SMS_MOCK: '1',
  };

  it('validates a correct production environment configuration without errors', () => {
    const result = validateProductionEnv(validProductionEnv);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('detects Supavisor connection pooling (port 6543 & pgbouncer=true)', () => {
    const config = getEnvConfig(validProductionEnv);
    expect(config.database.isPooled).toBe(true);
    expect(config.isProduction).toBe(true);
    expect(config.storage.mode).toBe('mock');
    expect(config.notifications.smsMode).toBe('mock');
  });

  it('throws EnvValidationError in production if DATABASE_URL is missing', () => {
    const env = {
      ...validProductionEnv,
      DATABASE_URL: undefined,
    };
    expect(() => validateProductionEnv(env)).toThrowError(EnvValidationError);
    try {
      validateProductionEnv(env);
    } catch (err: any) {
      expect(err.missingKeys).toContain('DATABASE_URL');
    }
  });

  it('throws EnvValidationError in production if DATABASE_URL is not postgresql protocol', () => {
    const env = {
      ...validProductionEnv,
      DATABASE_URL: 'mysql://root:pass@localhost:3306/db',
    };
    expect(() => validateProductionEnv(env)).toThrowError(EnvValidationError);
  });

  it('throws EnvValidationError in production if AUTH_SECRET is shorter than 32 characters', () => {
    const env = {
      ...validProductionEnv,
      AUTH_SECRET: 'short_secret_key',
    };
    expect(() => validateProductionEnv(env)).toThrowError(EnvValidationError);
    try {
      validateProductionEnv(env);
    } catch (err: any) {
      expect(err.invalidKeys).toContain('AUTH_SECRET');
    }
  });

  it('throws EnvValidationError in production if CRON_SECRET is shorter than 16 characters', () => {
    const env = {
      ...validProductionEnv,
      CRON_SECRET: 'short_cron',
    };
    expect(() => validateProductionEnv(env)).toThrowError(EnvValidationError);
    try {
      validateProductionEnv(env);
    } catch (err: any) {
      expect(err.invalidKeys).toContain('CRON_SECRET');
    }
  });

  it('requires S3 credentials in production when S3_MOCK is disabled', () => {
    const env = {
      ...validProductionEnv,
      S3_MOCK: '0',
      S3_BUCKET_NAME: 'prod-bucket',
      S3_ACCESS_KEY_ID: undefined,
    };
    expect(() => validateProductionEnv(env)).toThrowError(EnvValidationError);
  });

  it('provides safe fallbacks and warnings in development/test mode without throwing', () => {
    const devEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: undefined,
      AUTH_SECRET: 'dev',
    };
    const result = validateProductionEnv(devEnv);
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);

    const config = getEnvConfig(devEnv);
    expect(config.isDevelopment).toBe(true);
    expect(config.auth.secret.length).toBeGreaterThanOrEqual(32);
  });
});
