import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateEvidenceFile,
  sanitizeFileKey,
  generateSafeEvidenceKey,
  generateSigV4PresignedUrl,
  generatePresignedUploadUrl,
  generatePresignedViewUrl,
  saveEvidenceFile,
  readLocalEvidenceFile,
  canAccessEvidence,
  STORAGE_BACKEND_NOTICE,
} from '@/lib/storage';
import { UserSession } from '@/lib/auth-session';

describe('Phase 11: Secure Private Evidence Storage & S3/R2 Adapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.S3_MOCK = '1';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('MIME & Size Security Validation', () => {
    it('approves compliant JPEG, PNG, and WebP evidence under 5MB', () => {
      expect(validateEvidenceFile('defect.jpg', 'image/jpeg', 1024 * 500).isValid).toBe(true);
      expect(validateEvidenceFile('pothole.png', 'image/png', 1024 * 800).isValid).toBe(true);
      expect(validateEvidenceFile('work.webp', 'image/webp', 1024 * 300).isValid).toBe(true);
    });

    it('rejects files exceeding the 5MB municipal release threshold', () => {
      const oversized = 5.1 * 1024 * 1024;
      const res = validateEvidenceFile('huge.jpg', 'image/jpeg', oversized);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exceeds maximum limit of 5MB');
    });

    it('rejects empty files (0 bytes)', () => {
      const res = validateEvidenceFile('empty.png', 'image/png', 0);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('File is empty');
    });

    it('rejects forbidden file extensions (.exe, .pdf, .sh, .html)', () => {
      expect(validateEvidenceFile('script.sh', 'image/jpeg', 1024).isValid).toBe(false);
      expect(validateEvidenceFile('report.pdf', 'image/png', 1024).isValid).toBe(false);
      expect(validateEvidenceFile('trojan.exe', 'application/x-msdownload', 1024).isValid).toBe(false);
    });

    it('rejects unapproved MIME types even with image extensions', () => {
      const res = validateEvidenceFile('evil.jpg', 'application/javascript', 1024);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Unsupported MIME type');
    });
  });

  describe('Path Traversal Prevention & Key Sanitization', () => {
    it('accepts safe relative path keys', () => {
      const key = 'evidence/20261029/a1b2c3d4e5f6.jpg';
      expect(sanitizeFileKey(key)).toBe(key);
    });

    it('rejects directory traversal attempts (../ or ..\\)', () => {
      expect(() => sanitizeFileKey('../../etc/passwd')).toThrowError(/path traversal/i);
      expect(() => sanitizeFileKey('evidence/../../../secret.env')).toThrowError(/path traversal/i);
      expect(() => sanitizeFileKey('..\\..\\windows\\system32')).toThrowError(/path traversal/i);
    });

    it('rejects null byte injection attacks', () => {
      expect(() => sanitizeFileKey('evidence/image.jpg\0.exe')).toThrowError(/path traversal/i);
    });

    it('rejects root or absolute paths', () => {
      expect(() => sanitizeFileKey('/etc/shadow')).toThrowError(/path traversal/i);
      expect(() => sanitizeFileKey('\\Windows\\win.ini')).toThrowError(/path traversal/i);
    });

    it('generates non-colliding date-partitioned safe keys', () => {
      const key1 = generateSafeEvidenceKey('photo.jpg', 'image/jpeg');
      const key2 = generateSafeEvidenceKey('photo.jpg', 'image/jpeg');

      expect(key1).toMatch(/^evidence\/\d{8}\/[a-f0-9]{24}\.jpg$/);
      expect(key2).toMatch(/^evidence\/\d{8}\/[a-f0-9]{24}\.jpg$/);
      expect(key1).not.toBe(key2);
    });
  });

  describe('AWS SigV4 Presigned URL Generation for S3 / Cloudflare R2', () => {
    it('generates valid SigV4 presigned GET URL with <= 15 minutes TTL', () => {
      const url = generateSigV4PresignedUrl({
        method: 'GET',
        fileKey: 'evidence/20261029/mock123.jpg',
        bucket: 'govasset-pilot',
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
        region: 'auto',
        accessKeyId: 'test_access_key',
        secretAccessKey: 'test_secret_key_1234567890',
        ttlSeconds: 900,
      });

      expect(url).toContain('govasset-pilot.test-account.r2.cloudflarestorage.com');
      expect(url).toContain('evidence/20261029/mock123.jpg');
      expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
      expect(url).toContain('X-Amz-Expires=900');
      expect(url).toContain('X-Amz-Signature=');
      expect(url).toContain('X-Amz-Credential=');
    });

    it('enforces maximum 15-minute TTL bound even if higher TTL is requested', () => {
      const url = generateSigV4PresignedUrl({
        method: 'GET',
        fileKey: 'evidence/20261029/mock123.jpg',
        bucket: 'govasset-pilot',
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
        region: 'auto',
        accessKeyId: 'test_access_key',
        secretAccessKey: 'test_secret_key_1234567890',
        ttlSeconds: 3600, // Attempt 1 hour
      });

      // Must be capped at 900 seconds (15 minutes)
      expect(url).toContain('X-Amz-Expires=900');
    });

    it('switches between S3 and Local Mock mode cleanly based on credentials', async () => {
      // Mock mode active
      process.env.S3_MOCK = '1';
      const mockResult = await generatePresignedUploadUrl('defect.jpg', 'image/jpeg');
      expect(mockResult.backend).toBe('LOCAL_MOCK');
      expect(mockResult.url).toBe('/api/v1/evidence/upload');

      // Live S3 credentials active
      process.env.S3_MOCK = '0';
      process.env.S3_BUCKET_NAME = 'govasset-evidence-pilot';
      process.env.S3_ACCESS_KEY_ID = 'live_r2_access_key';
      process.env.S3_SECRET_ACCESS_KEY = 'live_r2_secret_key_abcdef';
      process.env.S3_ENDPOINT = 'https://cloudflare-r2.test';

      const liveResult = await generatePresignedUploadUrl('defect.jpg', 'image/jpeg');
      expect(liveResult.backend).toBe('S3_R2');
      expect(liveResult.url).toContain('X-Amz-Signature');
    });
  });

  describe('Local Mock Persistence & Binary Retrieval', () => {
    it('saves and reads evidence file locally in mock mode', async () => {
      const testContent = Buffer.from('FAKE_JPEG_IMAGE_BINARY_DATA');
      const stored = await saveEvidenceFile(testContent, 'repair_work.jpg', 'image/jpeg');

      expect(stored.fileKey).toContain('evidence/');
      expect(stored.sizeBytes).toBe(testContent.byteLength);

      const readBack = readLocalEvidenceFile(stored.fileKey);
      expect(readBack).not.toBeNull();
      expect(readBack!.mimeType).toBe('image/jpeg');
      expect(readBack!.buffer.toString()).toBe('FAKE_JPEG_IMAGE_BINARY_DATA');
    });
  });

  describe('Evidence Access Authorization & Scoping', () => {
    const adminSession: UserSession = {
      userId: 'admin-01',
      email: 'admin@govasset.in',
      phoneNumber: '+919822010001',
      fullName: 'Rajesh Sharma',
      role: 'PLATFORM_ADMIN',
      departmentId: null,
      jurisdictionId: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const citizenA: UserSession = {
      userId: 'citizen-01',
      email: 'citizen.aarav@govasset.in',
      phoneNumber: '+919822010008',
      fullName: 'Aarav Mehta',
      role: 'CITIZEN',
      departmentId: null,
      jurisdictionId: 'ward-28',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const workerA: UserSession = {
      userId: 'worker-01',
      email: 'worker.vikram@govasset.in',
      phoneNumber: '+919822010006',
      fullName: 'Vikram Singh',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      jurisdictionId: 'ward-28',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };

    const complaintContext = {
      citizenUserId: 'citizen-01',
      jurisdictionId: 'ward-28',
      departmentId: 'dept-roads',
      assignedToWorkerId: 'worker-01',
    };

    it('grants access to Platform Admin universally', () => {
      expect(canAccessEvidence(adminSession, complaintContext)).toBe(true);
    });

    it('grants access to Citizen only for their own complaints', () => {
      expect(canAccessEvidence(citizenA, complaintContext)).toBe(true);

      const otherCitizen: UserSession = {
        ...citizenA,
        userId: 'citizen-other',
      };
      expect(canAccessEvidence(otherCitizen, complaintContext)).toBe(false);
    });

    it('grants access to assigned Field Worker', () => {
      expect(canAccessEvidence(workerA, complaintContext)).toBe(true);

      const otherWorker: UserSession = {
        ...workerA,
        userId: 'worker-unassigned',
        jurisdictionId: 'ward-12',
      };
      expect(canAccessEvidence(otherWorker, complaintContext)).toBe(false);
    });
  });
});
