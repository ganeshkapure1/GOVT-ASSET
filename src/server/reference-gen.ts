import { db } from '@/lib/db';

/**
 * Generates a collision-resistant civic complaint reference number.
 * Format: GOV-YYYY-XXXXX (e.g., GOV-2026-00484)
 */
export async function generateReferenceNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Baseline from total complaints count in database
  const count = await db.complaint.count().catch(() => 0);

  for (let attempt = 0; attempt < 5; attempt++) {
    const sequenceNumber = (count + 1 + attempt + Math.floor(Math.random() * 50))
      .toString()
      .padStart(5, '0');
    const candidateRef = `GOV-${year}-${sequenceNumber}`;

    const existing = await db.complaint.findUnique({
      where: { referenceNumber: candidateRef },
      select: { id: true },
    });

    if (!existing) {
      return candidateRef;
    }
  }

  // Fallback with high-entropy random sequence if multiple collisions occur
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `GOV-${year}-${randomSuffix}`;
}
