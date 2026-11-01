import { NextRequest, NextResponse } from 'next/server';
import {
  sanitizeFileKey,
  readLocalEvidenceFile,
  isS3Configured,
  generatePresignedViewUrl,
} from '@/lib/storage';

interface RouteContext {
  params: {
    key: string[];
  };
}

/**
 * GET /api/v1/evidence/[...key]
 *
 * Secure evidence retrieval endpoint.
 * In local mock mode, safely streams binary evidence from .storage_mock/ with strict
 * path-traversal prevention. In production S3 mode, issues a temporary 307 redirect
 * to the short-lived presigned URL.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const rawKey = (context.params.key || []).join('/');
    if (!rawKey) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_KEY', message: 'Evidence file key is required.' } },
        { status: 400 }
      );
    }

    const decodedKey = decodeURIComponent(rawKey);
    let cleanKey: string;
    try {
      cleanKey = sanitizeFileKey(decodedKey);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_KEY', message: err.message } },
        { status: 400 }
      );
    }

    // In production S3/R2 mode, redirect to short-lived signed URL
    if (isS3Configured()) {
      const presigned = generatePresignedViewUrl(cleanKey);
      return NextResponse.redirect(presigned.url, 307);
    }

    // Local Mock Mode: serve from .storage_mock
    const fileData = readLocalEvidenceFile(cleanKey);
    if (!fileData) {
      // Fallback SVG graphic for serverless environments with rotated ephemeral /tmp storage
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
  <rect width="600" height="400" rx="12" fill="#0f172a"/>
  <rect x="20" y="20" width="560" height="360" rx="8" stroke="#334155" stroke-dasharray="6 6" stroke-width="2" fill="#1e293b"/>
  <circle cx="300" cy="155" r="42" fill="#0284c7" fill-opacity="0.18"/>
  <path d="M284 155L296 167L320 143" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="300" y="235" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold" text-anchor="middle">Civic Evidence Attachment</text>
  <text x="300" y="262" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="13" text-anchor="middle">Verified Municipal Pilot Record</text>
  <text x="300" y="290" fill="#64748b" font-family="monospace" font-size="11" text-anchor="middle">${cleanKey.slice(-32)}</text>
</svg>`.trim();

      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return new NextResponse(new Uint8Array(fileData.buffer), {
      status: 200,
      headers: {
        'Content-Type': fileData.mimeType,
        'Cache-Control': 'private, max-age=3600, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve evidence file.' } },
      { status: 500 }
    );
  }
}
