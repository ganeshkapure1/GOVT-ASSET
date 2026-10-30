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
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Evidence file not found.' } },
        { status: 404 }
      );
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
