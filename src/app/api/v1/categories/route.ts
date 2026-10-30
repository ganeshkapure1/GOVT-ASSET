import { NextResponse } from 'next/server';
import { getActiveCategories } from '@/server/complaint-service';

export async function GET() {
  try {
    const categories = await getActiveCategories();
    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'Failed to retrieve complaint categories.',
        },
      },
      { status: 500 }
    );
  }
}
