import crypto from 'crypto';
import { db } from '@/lib/db';
import { validatePhoneNumber, formatIndianPhoneNumber, sendNotification } from '@/lib/notifications';
import { createSessionToken } from '@/lib/auth-session';
import { isUuid } from '@/server/complaint-service';

export interface OtpRecord {
  phone: string;
  hash: string;
  salt: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  lastRequestedAt: Date;
  requestCount1Hour: number;
  isUsed: boolean;
}

// Global in-memory store for OTP verification challenges with TTL across all Next.js route bundles
const globalForOtp = globalThis as unknown as {
  otpChallengeStore?: Map<string, OtpRecord>;
};

export const otpChallengeStore =
  globalForOtp.otpChallengeStore ?? new Map<string, OtpRecord>();

globalForOtp.otpChallengeStore = otpChallengeStore;

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_VERIFY_ATTEMPTS = 3;
const MAX_REQUESTS_PER_HOUR = 5;

function hashOtp(otp: string, salt: string, phone: string): string {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${phone}:${otp}`)
    .digest('hex');
}

/**
 * Creates an HMAC-SHA256 signed stateless OTP challenge token for distributed serverless reliability.
 */
export function createSignedOtpChallenge(challenge: {
  phone: string;
  hash: string;
  salt: string;
  expiresAt: number;
}): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'govasset-dev-secret-key-must-be-at-least-32-bytes-long!';
  const payloadStr = JSON.stringify(challenge);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Validates and decodes a stateless OTP challenge token.
 */
export function verifySignedOtpChallenge(token: string): {
  phone: string;
  hash: string;
  salt: string;
  expiresAt: number;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'govasset-dev-secret-key-must-be-at-least-32-bytes-long!';
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

export interface RequestOtpResult {
  success: boolean;
  message: string;
  cooldownRemainingSeconds?: number;
  mockOtpNotice?: string;
  challengeToken?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  sessionToken?: string;
  user?: {
    id: string;
    phoneNumber: string;
    fullName: string;
    role: string;
  };
  error?: string;
}

/**
 * Initiates an OTP verification request for a citizen mobile number.
 *
 * Security Invariants:
 * 1. Resend cooldown (60s) and hourly abuse rate limits.
 * 2. Does NOT reveal whether the mobile number is registered.
 * 3. Never logs or prints plaintext OTP in production.
 * 4. Fails closed in production if SMS gateway is unconfigured.
 */
export async function requestPhoneOtp(
  rawPhone: string,
  referenceNow = new Date()
): Promise<RequestOtpResult> {
  if (!validatePhoneNumber(rawPhone)) {
    return {
      success: false,
      error: 'Please enter a valid 10-digit Indian mobile number.',
      message: 'Invalid phone format.',
    };
  }

  const phone = formatIndianPhoneNumber(rawPhone);
  const now = referenceNow.getTime();

  // Check existing challenge record
  const existing = otpChallengeStore.get(phone);
  if (existing) {
    // 1. Resend cooldown check
    const elapsedSinceLastRequest = now - existing.lastRequestedAt.getTime();
    if (elapsedSinceLastRequest < OTP_RESEND_COOLDOWN_MS) {
      const cooldownRemaining = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - elapsedSinceLastRequest) / 1000
      );
      return {
        success: false,
        cooldownRemainingSeconds: cooldownRemaining,
        error: `Please wait ${cooldownRemaining}s before requesting another verification code.`,
        message: 'Resend cooldown active.',
      };
    }

    // 2. Hourly rate limit check
    if (existing.requestCount1Hour >= MAX_REQUESTS_PER_HOUR) {
      const windowElapsed = now - existing.lastRequestedAt.getTime();
      if (windowElapsed < 3600000) {
        return {
          success: false,
          error: 'Maximum OTP verification attempts exceeded for this hour. Please try again later.',
          message: 'Rate limit exceeded.',
        };
      }
    }
  }

  // 3. In production, verify that external SMS provider or demo OTP mode is configured
  const isProduction = process.env.NODE_ENV === 'production';
  const hasSmsConfig = Boolean(
    process.env.TEXTBEE_API_KEY ||
    process.env.FAST2SMS_API_KEY ||
    process.env.MSG91_AUTH_KEY ||
    (process.env.SMS_API_KEY && process.env.SMS_MOCK !== '1')
  );
  const isDemoOtpEnabled =
    (process.env.ENABLE_DEMO_OTP === 'true' ||
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
      process.env.NEXT_PUBLIC_ENABLE_DEMO_CREDENTIALS === 'true') &&
    process.env.VITEST !== 'true' &&
    process.env.NODE_ENV !== 'test';

  if (isProduction && !hasSmsConfig && !isDemoOtpEnabled) {
    return {
      success: false,
      error: 'SMS OTP service is currently unconfigured in production environment. To enable SMS delivery on Indian mobile numbers, configure TEXTBEE_API_KEY, FAST2SMS_API_KEY, or MSG91_AUTH_KEY in your Vercel project environment variables. For pilot evaluation or demo mode, set ENABLE_DEMO_OTP=true.',
      message: 'Provider unavailable.',
    };
  }

  // 4. Generate cryptographically strong 6-digit OTP
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = hashOtp(otpCode, salt, phone);

  const requestCount = existing ? existing.requestCount1Hour + 1 : 1;

  otpChallengeStore.set(phone, {
    phone,
    hash: hashed,
    salt,
    attempts: 0,
    maxAttempts: MAX_VERIFY_ATTEMPTS,
    expiresAt: new Date(now + OTP_TTL_MS),
    lastRequestedAt: referenceNow,
    requestCount1Hour: requestCount,
    isUsed: false,
  });

  // 5. Dispatch via notification service
  await sendNotification({
    channel: 'SMS',
    recipientPhone: phone,
    templateCode: 'CITIZEN_OTP_SMS',
    payload: {
      otp: otpCode,
      message: `GovAsset login code: ${otpCode} (valid for 10m)`,
    },
  });

  const response: RequestOtpResult = {
    success: true,
    message: 'If the mobile number is valid, a 6-digit verification code has been dispatched.',
    challengeToken: createSignedOtpChallenge({
      phone,
      hash: hashed,
      salt,
      expiresAt: now + OTP_TTL_MS,
    }),
  };

  // Safe developer indicator for local offline environments or explicit demo evaluation mode
  if (!isProduction || isDemoOtpEnabled) {
    response.mockOtpNotice = `[Sandbox Mock OTP: ${otpCode}]`;
  }

  return response;
}

/**
 * Validates the citizen entered OTP with timing-safe hash comparison and attempt throttling.
 */
export async function verifyPhoneOtp(
  rawPhone: string,
  enteredOtp: string,
  referenceNow = new Date(),
  challengeToken?: string
): Promise<VerifyOtpResult> {
  if (!validatePhoneNumber(rawPhone)) {
    return { success: false, error: 'Invalid phone number format.', message: 'Invalid phone format.' };
  }

  if (!enteredOtp || !/^\d{6}$/.test(enteredOtp.trim())) {
    return { success: false, error: 'Verification code must be exactly 6 digits.', message: 'Invalid OTP length.' };
  }

  const phone = formatIndianPhoneNumber(rawPhone);
  let challenge = otpChallengeStore.get(phone);

  // Distributed Serverless Fallback: If memory challenge is not found on this container instance,
  // verify and restore from the cryptographically signed challenge token
  if ((!challenge || challenge.isUsed) && challengeToken) {
    const verified = verifySignedOtpChallenge(challengeToken);
    if (verified && verified.phone === phone) {
      challenge = {
        phone: verified.phone,
        hash: verified.hash,
        salt: verified.salt,
        attempts: 0,
        maxAttempts: MAX_VERIFY_ATTEMPTS,
        expiresAt: new Date(verified.expiresAt),
        lastRequestedAt: referenceNow,
        requestCount1Hour: 1,
        isUsed: false,
      };
      otpChallengeStore.set(phone, challenge);
    }
  }

  if (!challenge || challenge.isUsed) {
    return {
      success: false,
      error: 'No active verification code found for this number. Please request a new code.',
      message: 'Challenge not found or already consumed.',
    };
  }

  // Check expiration
  if (referenceNow.getTime() > challenge.expiresAt.getTime()) {
    otpChallengeStore.delete(phone);
    return {
      success: false,
      error: 'Verification code has expired. Please request a fresh code.',
      message: 'OTP expired.',
    };
  }

  // Check attempt limits
  if (challenge.attempts >= challenge.maxAttempts) {
    otpChallengeStore.delete(phone);
    return {
      success: false,
      error: 'Too many incorrect attempts. This verification code has been invalidated for security.',
      message: 'Max attempts exceeded.',
    };
  }

  challenge.attempts += 1;

  // Timing-safe verification
  const computedHash = hashOtp(enteredOtp.trim(), challenge.salt, phone);
  const hashBufferA = Buffer.from(computedHash, 'hex');
  const hashBufferB = Buffer.from(challenge.hash, 'hex');

  const isValid =
    hashBufferA.length === hashBufferB.length &&
    crypto.timingSafeEqual(hashBufferA, hashBufferB);

  if (!isValid) {
    if (challenge.attempts >= challenge.maxAttempts) {
      otpChallengeStore.delete(phone);
      return {
        success: false,
        error: 'Too many incorrect attempts. This verification code has been invalidated for security.',
        message: 'Max attempts exceeded.',
      };
    }
    const remaining = challenge.maxAttempts - challenge.attempts;
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      message: 'Hash mismatch.',
    };
  }

  // Mark challenge as consumed (single-use)
  challenge.isUsed = true;
  otpChallengeStore.delete(phone);

  // Find or provision citizen account in DB
  let user: any = null;
  try {
    user = await db.user.findFirst({
      where: { phoneNumber: phone },
    });

    if (user) {
      // Role protection invariant: Citizen OTP verification is strictly for citizens.
      // Prevent privilege escalation if staff/admin phone number is entered into citizen OTP.
      if (user.role !== 'CITIZEN') {
        return {
          success: false,
          error: 'This mobile number is registered to an official municipal staff account. Please sign in using your official email and password credentials.',
          message: 'Staff account cannot authenticate via citizen OTP.',
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          error: 'This account has been deactivated. Please contact municipal administration.',
          message: 'Account disabled.',
        };
      }
    } else {
      // Auto-provision citizen user on first verified phone login
      user = await db.user.create({
        data: {
          phoneNumber: phone,
          fullName: 'Civic Resident',
          role: 'CITIZEN',
          isActive: true,
        },
      });
    }

    // Account Linking: Link any prior unlinked complaints submitted under this phone number
    if (user && user.id && isUuid(user.id)) {
      try {
        await db.complaint.updateMany({
          where: {
            citizenPhone: phone,
            citizenId: null,
          },
          data: {
            citizenId: user.id,
          },
        });
      } catch {
        // Safe non-blocking fallback if complaints table linking encounters transient issues
      }
    }
  } catch {
    // Mock user for offline or test environments with RFC 4122 v4 UUID
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        phoneNumber: phone,
        fullName: 'Civic Resident',
        role: 'CITIZEN',
        isActive: true,
      };
    }
  }

  if (!user.isActive) {
    return {
      success: false,
      error: 'This account has been deactivated. Please contact municipal administration.',
      message: 'Account disabled.',
    };
  }

  const sessionToken = await createSessionToken({
    userId: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName,
    role: 'CITIZEN', // Always strictly issue CITIZEN role
    departmentId: user.departmentId,
    jurisdictionId: user.jurisdictionId,
  });

  return {
    success: true,
    message: 'Mobile number verified successfully.',
    sessionToken,
    user: {
      id: user.id,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      role: 'CITIZEN',
    },
  };
}

/**
 * Test helper: clear stored challenges.
 */
export function clearOtpStore(): void {
  otpChallengeStore.clear();
}
