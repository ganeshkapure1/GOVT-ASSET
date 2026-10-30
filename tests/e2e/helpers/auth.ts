import { createSessionToken, SESSION_COOKIE_NAME, UserSession } from '@/lib/auth-session';
import { BrowserContext } from '@playwright/test';

// Ensure AUTH_SECRET in test runner matches the Next.js runtime .env
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = 'dev_auth_secret_minimum_32_characters_for_jwt_session_signing_pilot';
}

export interface TestUserOptions {
  userId?: string;
  role: UserSession['role'];
  email?: string;
  phoneNumber?: string;
  fullName?: string;
  departmentId?: string | null;
  jurisdictionId?: string | null;
}

export async function setTestSessionCookie(
  context: BrowserContext,
  options: TestUserOptions
): Promise<string> {
  const token = await createSessionToken({
    userId: options.userId || `user-${options.role.toLowerCase()}-01`,
    role: options.role,
    email: options.email || `${options.role.toLowerCase()}@govasset.in`,
    phoneNumber: options.phoneNumber || '+919822010001',
    fullName: options.fullName || `Test ${options.role}`,
    departmentId: options.departmentId ?? 'dept-roads',
    jurisdictionId: options.jurisdictionId ?? 'ward-kothrud-28',
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url: 'http://localhost:3005/',
      sameSite: 'Lax',
    },
  ]);

  return token;
}
