import crypto from 'node:crypto';

/**
 * GovAsset Cryptographic Password Utilities
 *
 * Uses Node.js native scrypt with a 16-byte cryptographically secure random salt,
 * N=16384, r=8, p=1 (NIST recommended key derivation parameters).
 * Verifies with constant-time equality check to prevent side-channel timing attacks.
 */

const SCRYPT_PREFIX = 'scrypt$v1$N=16384,r=8,p=1$';
const PILOT_MOCK_HASH = '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only';
export const PILOT_DEV_PASSWORD = 'password123';

/**
 * Generates a salted scrypt hash of a plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  const salt = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${SCRYPT_PREFIX}${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a plaintext password against a stored password hash.
 * Supports:
 * 1. Standard scrypt hashes produced by hashPassword()
 * 2. Pilot seed test accounts in non-production environments with PILOT_DEV_PASSWORD
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!password || !storedHash) {
    return false;
  }

  // Handle seeded pilot development accounts in non-production environments
  if (
    process.env.NODE_ENV !== 'production' &&
    storedHash === PILOT_MOCK_HASH &&
    password === PILOT_DEV_PASSWORD
  ) {
    return true;
  }

  // Standard scrypt format: scrypt$v1$N=16384,r=8,p=1$<salt>$<hash>
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const remainder = storedHash.slice(SCRYPT_PREFIX.length);
    const parts = remainder.split('$');
    if (parts.length !== 2) {
      return false;
    }

    const [salt, expectedHashHex] = parts;
    const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

    return new Promise((resolve) => {
      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        try {
          // Timing-safe comparison to prevent timing side-channel attacks
          const match = crypto.timingSafeEqual(derivedKey, expectedBuffer);
          resolve(match);
        } catch {
          resolve(false);
        }
      });
    });
  }

  return false;
}
