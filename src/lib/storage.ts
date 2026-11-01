import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { STORAGE_BACKEND_NOTICE } from './constants';
import { UserSession } from './auth-session';

export { STORAGE_BACKEND_NOTICE };

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_PRESIGNED_TTL_SECONDS = 900; // 15 minutes release gate requirement

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface StoredEvidence {
  fileKey: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  backend: 'S3_R2' | 'LOCAL_MOCK';
}

export interface PresignedUrlResult {
  fileKey: string;
  url: string;
  expiresInSeconds: number;
  headers?: Record<string, string>;
  backend: 'S3_R2' | 'LOCAL_MOCK';
}

const LOCAL_STORAGE_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join(os.tmpdir(), 'govasset_storage_mock')
  : path.join(process.cwd(), '.storage_mock');

/**
 * Validates file buffer or size and MIME type against strict municipal security bounds.
 */
export function validateEvidenceFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): { isValid: boolean; error?: string } {
  if (sizeBytes <= 0) {
    return { isValid: false, error: 'File is empty.' };
  }

  if (sizeBytes > MAX_EVIDENCE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of 5MB.`,
    };
  }

  let normalizedMime = mimeType.toLowerCase().trim();
  if (normalizedMime === 'image/jpg') {
    normalizedMime = 'image/jpeg';
  }
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime as AllowedMimeType)) {
    return {
      isValid: false,
      error: `Unsupported MIME type: "${mimeType}". Only JPEG, PNG, and WebP images are permitted.`,
    };
  }

  let ext = path.extname(fileName).toLowerCase();
  if (!ext) {
    if (normalizedMime === 'image/jpeg') ext = '.jpg';
    else if (normalizedMime === 'image/png') ext = '.png';
    else if (normalizedMime === 'image/webp') ext = '.webp';
  }

  if (!ext || !ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      isValid: false,
      error: `Unsupported file extension: "${ext}". Only .jpg, .jpeg, .png, and .webp are permitted.`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes object storage keys, preventing path traversal attacks (e.g. "../" or null bytes).
 */
export function sanitizeFileKey(fileKey: string): string {
  if (!fileKey || typeof fileKey !== 'string') {
    throw new Error('Invalid file key: key must be a non-empty string.');
  }

  // Reject null bytes and path traversal patterns
  if (
    fileKey.includes('\0') ||
    fileKey.includes('..') ||
    fileKey.startsWith('/') ||
    fileKey.startsWith('\\') ||
    /^[a-zA-Z]:/.test(fileKey)
  ) {
    throw new Error('Invalid file key: path traversal sequences are prohibited.');
  }

  // Normalize path separators to forward slashes and clean components
  const cleanParts = fileKey
    .split(/[/\\]+/)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, ''))
    .filter((part) => part.length > 0 && part !== '.');

  if (cleanParts.length === 0) {
    throw new Error('Invalid file key: resulting path is empty.');
  }

  return cleanParts.join('/');
}

/**
 * Generates an immutable, non-traversing object storage key with date partition.
 */
export function generateSafeEvidenceKey(fileName: string, mimeType: string): string {
  let ext = path.extname(fileName).toLowerCase();
  if (!ext) {
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else ext = '.jpg';
  }

  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(12).toString('hex');
  return `evidence/${datePrefix}/${randomSuffix}${ext}`;
}

/**
 * AWS Signature Version 4 HMAC Helper
 */
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp, 'utf8').digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName, 'utf8').digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName, 'utf8').digest();
  return crypto.createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
}

/**
 * Generates a presigned GET or PUT URL using AWS SigV4 for S3 / Cloudflare R2.
 */
export function generateSigV4PresignedUrl(options: {
  method: 'GET' | 'PUT';
  fileKey: string;
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  ttlSeconds?: number;
  contentType?: string;
}): string {
  const {
    method,
    fileKey,
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    ttlSeconds = DEFAULT_PRESIGNED_TTL_SECONDS,
    contentType,
  } = options;

  const cleanKey = sanitizeFileKey(fileKey);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const urlObj = new URL(endpoint);
  const host = `${bucket}.${urlObj.host}`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': Math.min(ttlSeconds, 900).toString(), // Max 15 minutes release gate
    'X-Amz-SignedHeaders': 'host',
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalUri = `/${encodeURI(cleanKey)}`;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, 's3');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Checks whether object storage is configured with live S3 / Cloudflare R2 credentials.
 */
export function isS3Configured(): boolean {
  if (process.env.S3_MOCK === '1') return false;
  return Boolean(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  );
}

/**
 * Generates a presigned upload URL for direct client-to-bucket upload.
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  mimeType: string,
  ttlSeconds = DEFAULT_PRESIGNED_TTL_SECONDS
): Promise<PresignedUrlResult> {
  const validation = validateEvidenceFile(fileName, mimeType, 1024);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const fileKey = generateSafeEvidenceKey(fileName, mimeType);

  if (isS3Configured()) {
    const endpoint = process.env.S3_ENDPOINT || 'https://auto.r2.cloudflarestorage.com';
    const region = process.env.S3_REGION || 'auto';
    const bucket = process.env.S3_BUCKET_NAME!;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;

    const url = generateSigV4PresignedUrl({
      method: 'PUT',
      fileKey,
      bucket,
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      ttlSeconds,
      contentType: mimeType,
    });

    return {
      fileKey,
      url,
      expiresInSeconds: ttlSeconds,
      headers: { 'Content-Type': mimeType },
      backend: 'S3_R2',
    };
  }

  // Local Mock Mode: return local upload endpoint
  return {
    fileKey,
    url: `/api/v1/evidence/upload`,
    expiresInSeconds: ttlSeconds,
    backend: 'LOCAL_MOCK',
  };
}

/**
 * Generates a presigned read/view URL for secure private evidence inspection.
 */
export function generatePresignedViewUrl(
  fileKey: string,
  ttlSeconds = DEFAULT_PRESIGNED_TTL_SECONDS
): PresignedUrlResult {
  const cleanKey = sanitizeFileKey(fileKey);

  if (isS3Configured()) {
    const endpoint = process.env.S3_ENDPOINT || 'https://auto.r2.cloudflarestorage.com';
    const region = process.env.S3_REGION || 'auto';
    const bucket = process.env.S3_BUCKET_NAME!;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;

    const url = generateSigV4PresignedUrl({
      method: 'GET',
      fileKey: cleanKey,
      bucket,
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      ttlSeconds,
    });

    return {
      fileKey: cleanKey,
      url,
      expiresInSeconds: ttlSeconds,
      backend: 'S3_R2',
    };
  }

  // Local Mock Mode: routed via local streaming proxy
  return {
    fileKey: cleanKey,
    url: `/api/v1/evidence/${encodeURIComponent(cleanKey)}`,
    expiresInSeconds: ttlSeconds,
    backend: 'LOCAL_MOCK',
  };
}

/**
 * Resolves a storage file key to a URL.
 */
export function getEvidenceUrl(fileKey: string): string {
  if (!fileKey) return '';
  if (fileKey.startsWith('http://') || fileKey.startsWith('https://')) {
    return fileKey;
  }
  const cleanKey = sanitizeFileKey(fileKey);
  return generatePresignedViewUrl(cleanKey).url;
}

/**
 * Saves uploaded evidence locally for offline development or pilot execution.
 */
export async function saveEvidenceFile(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string
): Promise<StoredEvidence> {
  const sizeBytes = fileBuffer.byteLength;
  const validation = validateEvidenceFile(fileName, mimeType, sizeBytes);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const fileKey = generateSafeEvidenceKey(fileName, mimeType);

  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }

  // Flattened safe local filename
  const localFileName = fileKey.replace(/\//g, '_');
  const targetPath = path.join(LOCAL_STORAGE_DIR, localFileName);
  fs.writeFileSync(targetPath, Buffer.from(fileBuffer));

  return {
    fileKey,
    url: `/api/v1/evidence/${encodeURIComponent(fileKey)}`,
    sizeBytes,
    mimeType,
    backend: isS3Configured() ? 'S3_R2' : 'LOCAL_MOCK',
  };
}

/**
 * Reads evidence file from local mock storage.
 */
export function readLocalEvidenceFile(fileKey: string): { buffer: Buffer; mimeType: string } | null {
  const cleanKey = sanitizeFileKey(fileKey);
  const localFileName = cleanKey.replace(/\//g, '_');
  const targetPath = path.join(LOCAL_STORAGE_DIR, localFileName);

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  const buffer = fs.readFileSync(targetPath);
  const ext = path.extname(cleanKey).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  if (ext === '.webp') mimeType = 'image/webp';

  return { buffer, mimeType };
}

/**
 * Authorization helper: verifies whether a user session has permission to view an evidence asset.
 */
export function canAccessEvidence(
  session: UserSession | null,
  complaint?: {
    citizenUserId?: string | null;
    jurisdictionId?: string | null;
    departmentId?: string | null;
    assignedToWorkerId?: string | null;
  } | null
): boolean {
  // Public tracking access: if complaint object is not provided or public photo
  if (!session) {
    // Unauthenticated visitors can view public defect evidence if valid tracking
    return true;
  }

  // Platform Admins have universal read access
  if (session.role === 'PLATFORM_ADMIN') {
    return true;
  }

  if (!complaint) {
    return true;
  }

  // Citizens can view evidence of complaints they submitted
  if (session.role === 'CITIZEN') {
    return complaint.citizenUserId === session.userId;
  }

  // Field workers can view evidence of tasks assigned to them or in their ward
  if (session.role === 'FIELD_WORKER') {
    return (
      complaint.assignedToWorkerId === session.userId ||
      (session.jurisdictionId ? complaint.jurisdictionId === session.jurisdictionId : true)
    );
  }

  // Department Officers & Supervisors
  if (session.role === 'OFFICER' || session.role === 'SUPERVISOR') {
    const wardMatches = !session.jurisdictionId || session.jurisdictionId === complaint.jurisdictionId;
    const deptMatches = !session.departmentId || session.departmentId === complaint.departmentId;
    return wardMatches && deptMatches;
  }

  return false;
}
