/**
 * Production Environment Configuration & Strict Security Validation
 *
 * Enforces fail-closed validation for critical production secrets (DATABASE_URL,
 * AUTH_SECRET, CRON_SECRET) while providing resilient fallbacks for development
 * and CI/test execution.
 */

export class EnvValidationError extends Error {
  public readonly missingKeys: string[];
  public readonly invalidKeys: string[];

  constructor(message: string, missingKeys: string[] = [], invalidKeys: string[] = []) {
    super(message);
    this.name = 'EnvValidationError';
    this.missingKeys = missingKeys;
    this.invalidKeys = invalidKeys;
  }
}

export interface AppEnvConfig {
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
  database: {
    url: string;
    isPooled: boolean;
    directUrl?: string;
  };
  auth: {
    secret: string;
    cookieDomain?: string;
    sessionTtlHours: number;
  };
  cron: {
    secret: string;
  };
  storage: {
    mode: 's3' | 'mock';
    endpoint?: string;
    bucketName?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  notifications: {
    smsMode: 'live' | 'mock';
    smsProvider: string;
    smsSenderId: string;
    emailMode: 'live' | 'mock';
  };
  geo: {
    mode: 'live' | 'mock';
  };
  app: {
    url: string;
    defaultLat: number;
    defaultLng: number;
    municipalName: string;
  };
}

/**
 * Validates the runtime environment against required production security standards.
 * In production mode, throws EnvValidationError if critical secrets are absent or weak.
 */
export function validateProductionEnv(env: Record<string, string | undefined> = process.env): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const isProd = env.NODE_ENV === 'production';
  const errList: string[] = [];
  const warnList: string[] = [];
  const missingKeys: string[] = [];
  const invalidKeys: string[] = [];

  // 1. DATABASE_URL
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    if (isProd) {
      errList.push('DATABASE_URL is required in production.');
      missingKeys.push('DATABASE_URL');
    } else {
      warnList.push('DATABASE_URL is not set. Defaulting to local/test configuration.');
    }
  } else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    errList.push('DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://');
    invalidKeys.push('DATABASE_URL');
  } else if (isProd && !dbUrl.includes(':6543') && !dbUrl.includes('pgbouncer=true')) {
    warnList.push('Production DATABASE_URL should use connection pooler (port 6543 / pgbouncer=true) for serverless scalability.');
  }

  // 2. AUTH_SECRET
  const authSecret = env.AUTH_SECRET;
  if (!authSecret) {
    if (isProd) {
      errList.push('AUTH_SECRET is required in production.');
      missingKeys.push('AUTH_SECRET');
    } else {
      warnList.push('AUTH_SECRET is not set. Using test fallback key.');
    }
  } else if (authSecret.length < 32) {
    if (isProd) {
      errList.push('AUTH_SECRET must be at least 32 characters long in production for HMAC-SHA256 security.');
      invalidKeys.push('AUTH_SECRET');
    } else {
      warnList.push('AUTH_SECRET is shorter than 32 characters.');
    }
  }

  // 3. CRON_SECRET
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    if (isProd) {
      errList.push('CRON_SECRET is required in production to safeguard scheduled maintenance endpoints.');
      missingKeys.push('CRON_SECRET');
    } else {
      warnList.push('CRON_SECRET is not configured. Admin jobs can only run via session cookie.');
    }
  } else if (cronSecret.length < 16) {
    if (isProd) {
      errList.push('CRON_SECRET must be at least 16 characters long in production.');
      invalidKeys.push('CRON_SECRET');
    } else {
      warnList.push('CRON_SECRET is shorter than 16 characters.');
    }
  }

  // 4. Object Storage
  const isS3Mock = env.S3_MOCK === '1' || !env.S3_BUCKET_NAME;
  if (!isS3Mock) {
    if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET_NAME) {
      if (isProd) {
        errList.push('When S3_MOCK is disabled, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME are required.');
        invalidKeys.push('S3_CREDENTIALS');
      } else {
        warnList.push('S3 credentials incomplete. Local storage fallback will be activated.');
      }
    }
  } else {
    warnList.push('Storage is operating in local mock mode (S3_MOCK=1). Files saved to .storage_mock/');
  }

  // 5. SMS Gateway
  const isSmsMock = env.SMS_MOCK === '1' || (!env.SMS_API_KEY && !env.FAST2SMS_API_KEY && !env.MSG91_AUTH_KEY);
  if (isSmsMock) {
    warnList.push('SMS gateway is operating in local mock mode (SMS_MOCK=1).');
  }

  if (isProd && errList.length > 0) {
    throw new EnvValidationError(
      `Production environment validation failed with ${errList.length} error(s):\n- ${errList.join('\n- ')}`,
      missingKeys,
      invalidKeys
    );
  }

  return {
    isValid: errList.length === 0,
    errors: errList,
    warnings: warnList,
  };
}

/**
 * Parses and returns the full application environment configuration.
 */
export function getEnvConfig(env: Record<string, string | undefined> = process.env): AppEnvConfig {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const isDev = !isProd && !isTest;

  const dbUrl = env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/govasset';
  const isPooled = dbUrl.includes(':6543') || dbUrl.includes('pgbouncer=true');

  const isS3Mock = env.S3_MOCK === '1' || !env.S3_BUCKET_NAME || !env.S3_ACCESS_KEY_ID;
  const isSmsMock = env.SMS_MOCK === '1' || (!env.SMS_API_KEY && !env.FAST2SMS_API_KEY && !env.MSG91_AUTH_KEY);

  return {
    isProduction: isProd,
    isTest,
    isDevelopment: isDev,
    database: {
      url: dbUrl,
      isPooled,
      directUrl: env.DIRECT_URL,
    },
    auth: {
      secret:
        env.AUTH_SECRET && env.AUTH_SECRET.length >= 32
          ? env.AUTH_SECRET
          : 'dev_auth_secret_minimum_32_characters_for_hmac_sha256',
      cookieDomain: env.AUTH_COOKIE_DOMAIN || undefined,
      sessionTtlHours: Number.parseInt(env.SESSION_TTL_HOURS || '12', 10),
    },
    cron: {
      secret:
        env.CRON_SECRET && env.CRON_SECRET.length >= 16
          ? env.CRON_SECRET
          : 'dev_cron_secret_16_chars_min',
    },
    storage: {
      mode: isS3Mock ? 'mock' : 's3',
      endpoint: env.S3_ENDPOINT,
      bucketName: env.S3_BUCKET_NAME,
      region: env.S3_REGION || 'auto',
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    notifications: {
      smsMode: isSmsMock ? 'mock' : 'live',
      smsProvider: env.SMS_PROVIDER || 'MSG91',
      smsSenderId: env.SMS_SENDER_ID || 'GOVCSM',
      emailMode: env.RESEND_API_KEY ? 'live' : 'mock',
    },
    geo: {
      mode: env.GEO_MOCK === '1' ? 'mock' : 'live',
    },
    app: {
      url: env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      defaultLat: Number.parseFloat(env.NEXT_PUBLIC_DEFAULT_LAT || '20.5937'),
      defaultLng: Number.parseFloat(env.NEXT_PUBLIC_DEFAULT_LNG || '78.9629'),
      municipalName: env.NEXT_PUBLIC_MUNICIPAL_NAME || 'GovAsset National Civic Redressal Platform',
    },
  };
}
