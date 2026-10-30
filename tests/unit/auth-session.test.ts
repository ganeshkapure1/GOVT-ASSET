import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, PILOT_DEV_PASSWORD } from '@/lib/auth-crypto';
import { createSessionToken, verifySessionToken, UserSession } from '@/lib/auth-session';

describe('Phase 3: Password Hashing & Stateless Sealed Sessions', () => {
  describe('Cryptographic Password Hashing (scrypt)', () => {
    it('hashes passwords with unique salts producing different hashes for the same password', async () => {
      const password = 'SuperSecretGovPassword2026!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).toMatch(/^scrypt\$v1\$N=16384,r=8,p=1\$/);
      expect(hash2).toMatch(/^scrypt\$v1\$N=16384,r=8,p=1\$/);
      expect(hash1).not.toBe(hash2); // Different salts
    });

    it('verifies correct passwords and rejects incorrect passwords', async () => {
      const password = 'CorrectCivicPassword#1';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword('WrongPassword', hash)).toBe(false);
      expect(await verifyPassword('', hash)).toBe(false);
      expect(await verifyPassword(password, null)).toBe(false);
    });

    it('validates pilot development seeded accounts in dev mode', async () => {
      const pilotMockHash = '$argon2id$v=19$m=65536,t=3,p=4$pilot_mock_password_hash_only';

      // Correct dev password succeeds
      expect(await verifyPassword(PILOT_DEV_PASSWORD, pilotMockHash)).toBe(true);
      // Wrong password fails
      expect(await verifyPassword('incorrect_pw', pilotMockHash)).toBe(false);
    });
  });

  describe('Stateless Sealed Session Tokens (HMAC-SHA256)', () => {
    const mockSession: Omit<UserSession, 'issuedAt' | 'expiresAt'> = {
      userId: '66666666-6666-6666-6666-666666660002',
      email: 'officer.kothrud@govasset.in',
      phoneNumber: '+919822010002',
      fullName: 'Sunita Patil',
      role: 'OFFICER',
      departmentId: '44444444-4444-4444-4444-444444440001',
      jurisdictionId: '33333333-3333-3333-3333-333333330028',
    };

    it('creates and verifies a valid signed session token', async () => {
      const token = await createSessionToken(mockSession);
      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(mockSession.userId);
      expect(verified?.email).toBe(mockSession.email);
      expect(verified?.role).toBe('OFFICER');
      expect(verified?.jurisdictionId).toBe(mockSession.jurisdictionId);
      expect(verified?.departmentId).toBe(mockSession.departmentId);
      expect(verified?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('rejects tampered payload data', async () => {
      const token = await createSessionToken(mockSession);
      const [payload, signature] = token.split('.');

      // Attacker attempts privilege escalation to PLATFORM_ADMIN
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      decoded.role = 'PLATFORM_ADMIN';
      const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');

      const forgedToken = `${forgedPayload}.${signature}`;
      const result = await verifySessionToken(forgedToken);
      expect(result).toBeNull();
    });

    it('rejects tampered or forged signatures', async () => {
      const token = await createSessionToken(mockSession);
      const [payload] = token.split('.');
      const corruptedToken = `${payload}.invalid_signature_bytes_12345`;

      const result = await verifySessionToken(corruptedToken);
      expect(result).toBeNull();
    });

    it('rejects malformed or empty tokens', async () => {
      expect(await verifySessionToken('')).toBeNull();
      expect(await verifySessionToken(null)).toBeNull();
      expect(await verifySessionToken(undefined)).toBeNull();
      expect(await verifySessionToken('no_dot_in_token')).toBeNull();
      expect(await verifySessionToken('one.two.three.dots')).toBeNull();
    });
  });
});
