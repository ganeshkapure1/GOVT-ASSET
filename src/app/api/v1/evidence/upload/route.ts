import { NextRequest, NextResponse } from 'next/server';
import { saveEvidenceFile } from '@/lib/storage';
import { verifyCsrfProtection } from '@/server/auth';

/**
 * POST /api/v1/evidence/upload
 *
 * Uploads evidence images (citizen defect photos or field worker completion proof).
 */
export async function POST(request: NextRequest) {
  if (!verifyCsrfProtection(request)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked by CSRF security policy.' },
      },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FILE', message: 'No image file was uploaded.' } },
        { status: 400 }
      );
    }

    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FILE_TYPE', message: 'Only image files are permitted.' } },
        { status: 400 }
      );
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File size must not exceed 5MB.' } },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const stored = await saveEvidenceFile(buffer, file.name || 'evidence.jpg', mimeType);

    return NextResponse.json({
      success: true,
      data: stored,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to process evidence upload.' } },
      { status: 500 }
    );
  }
}
