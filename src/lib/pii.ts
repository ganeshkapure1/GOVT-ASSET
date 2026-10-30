/**
 * DPDP Act 2023 Compliant Citizen PII Masking Utilities
 *
 * Enforces cryptographic or pattern-based redaction of personal identifiable
 * information (phone numbers, email addresses, names) on all public-facing
 * pages, audit logs, and non-privileged APIs.
 */

/**
 * Masks a mobile number to hide all but country code and last 3 digits.
 * Example: "+919822010008" -> "+91 98*** **008"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return 'Not available';
  const clean = phone.trim();

  // If number has +91 prefix
  if (clean.startsWith('+91')) {
    const nationalNumber = clean.slice(3).replace(/\D/g, '');
    if (nationalNumber.length === 10) {
      return `+91 ${nationalNumber.slice(0, 2)}*** **${nationalNumber.slice(7)}`;
    }
  }

  // Fallback pattern for arbitrary length
  if (clean.length > 5) {
    const visibleStart = clean.slice(0, 3);
    const visibleEnd = clean.slice(-3);
    const maskedLen = Math.max(clean.length - 6, 4);
    return `${visibleStart}${'*'.repeat(maskedLen)}${visibleEnd}`;
  }

  return '******';
}

/**
 * Masks an email address to hide username characters while preserving domain context.
 * Example: "citizen.aarav@govasset.in" -> "c***v@govasset.in"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return 'Not available';
  const clean = email.trim();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 1) return '***@' + (clean.split('@')[1] || 'domain.in');

  const username = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex);

  if (username.length <= 2) {
    return `${username[0]}*${domain}`;
  }

  return `${username[0]}***${username[username.length - 1]}${domain}`;
}

/**
 * Masks a citizen's full name for public transparency dashboards.
 * Example: "Aarav Mehta" -> "A*** M***"
 */
export function maskFullName(name: string | null | undefined): string {
  if (!name) return 'Anonymous Citizen';
  const clean = name.trim();
  const parts = clean.split(/\s+/);

  return parts
    .map((part) => {
      if (part.length <= 1) return part;
      return `${part[0]}${'*'.repeat(Math.min(part.length - 1, 3))}`;
    })
    .join(' ');
}
