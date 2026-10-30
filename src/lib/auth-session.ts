/**
 * Stateless Sealed Session Cookie Service for GovAsset
 *
 * Implements HMAC-SHA256 signed session tokens using the Web Crypto API (crypto.subtle).
 * 100% compatible with both Next.js Edge Middleware and Node.js App Router runtimes.
 * Does not require external packages or native binary dependencies.
 */

export type UserRole =
  | 'CITIZEN'
  | 'OFFICER'
  | 'SUPERVISOR'
  | 'FIELD_WORKER'
  | 'DEPT_ADMIN'
  | 'PLATFORM_ADMIN';

export interface UserSession {
  userId: string;
  email: string | null;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  jurisdictionId: string | null;
  issuedAt: number;
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = 'govasset_session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

// Secret key for HMAC signing with fail-closed behavior in production
export const GET_SECRET_KEY = (): string => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.trim() === '') {
      throw new Error(
        'FATAL: Production security requirement failed. AUTH_SECRET or NEXTAUTH_SECRET must be configured.'
      );
    }
    return secret;
  }
  return secret || 'govasset-dev-secret-key-must-be-at-least-32-bytes-long!';
};

// Base64Url helpers
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = GET_SECRET_KEY();
  const enc = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    enc,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Creates a signed, tamper-proof session token.
 */
export async function createSessionToken(
  sessionData: Omit<UserSession, 'issuedAt' | 'expiresAt'>
): Promise<string> {
  const now = Date.now();
  const session: UserSession = {
    ...sessionData,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_SECONDS * 1000,
  };

  const payloadString = JSON.stringify(session);
  const encodedPayload = base64UrlEncode(payloadString);

  const key = await getCryptoKey();
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload)
  );
  const encodedSignature = bufferToBase64Url(signatureBuffer);

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies and parses a signed session token.
 * Returns null if token is malformed, has invalid signature, or is expired.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<UserSession | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;

  try {
    const key = await getCryptoKey();

    // Reconstruct raw signature bytes from base64url
    let base64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const signatureBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      signatureBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(encodedPayload)
    );

    if (!isValid) {
      return null;
    }

    const payloadString = base64UrlDecode(encodedPayload);
    const session: UserSession = JSON.parse(payloadString);

    // Verify expiry
    if (!session.expiresAt || session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
