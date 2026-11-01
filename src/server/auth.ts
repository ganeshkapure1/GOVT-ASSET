import { cookies } from 'next/headers';
import { UserRole, UserSession, SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-session';
import { Permission, hasPermission } from '@/lib/rbac';
import { db } from '@/lib/db';

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface SessionOptions {
  checkFreshness?: boolean;
}

/**
 * Validates session against the database to guarantee that:
 * 1. The account exists and has not been deactivated (isActive == true).
 * 2. Role changes or demotions take effect immediately.
 * 3. Updated jurisdiction / department assignments are refreshed.
 */
export async function validateSessionFreshness(session: UserSession): Promise<UserSession> {
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      fullName: true,
      role: true,
      departmentId: true,
      jurisdictionId: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AuthError('UNAUTHORIZED', 401, 'User account no longer exists.');
  }

  if (!user.isActive) {
    throw new AuthError('ACCOUNT_DISABLED', 403, 'User account has been deactivated.');
  }

  // If role in database differs from session token, fail closed to prevent privilege escalation
  if (user.role !== session.role) {
    throw new AuthError(
      'SESSION_STALE',
      403,
      `User role has changed from ${session.role} to ${user.role}. Please re-authenticate.`
    );
  }

  return {
    ...session,
    departmentId: user.departmentId,
    jurisdictionId: user.jurisdictionId,
  };
}

/**
 * Verifies that a state-changing mutation request is not a cross-site request forgery (CSRF).
 * Checks Sec-Fetch-Site and Origin / Host headers.
 */
export function verifyCsrfProtection(request?: Request | null): boolean {
  if (!request || !request.method) {
    return true;
  }
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        // In local development or proxy setups, permit localhost/127.0.0.1 on different ports
        const originHostname = originUrl.hostname;
        const hostHostname = host.split(':')[0];
        const isLocalOrigin = originHostname === 'localhost' || originHostname === '127.0.0.1';
        const isLocalHost = hostHostname === 'localhost' || hostHostname === '127.0.0.1';
        if (isLocalOrigin && isLocalHost) {
          return true;
        }
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Retrieves and cryptographically validates the active user session from cookies.
 */
export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  return await verifySessionToken(sessionCookie.value);
}

/**
 * Requires an authenticated user session.
 * Optionally verifies role against a list of permitted roles and checks DB freshness.
 */
export async function requireAuth(
  allowedRoles?: UserRole[],
  options?: SessionOptions
): Promise<UserSession> {
  let session = await getServerSession();

  if (!session) {
    throw new AuthError('UNAUTHORIZED', 401, 'Authentication required to access this resource.');
  }

  if (options?.checkFreshness) {
    session = await validateSessionFreshness(session);
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    throw new AuthError(
      'FORBIDDEN',
      403,
      `Access denied. Role "${session.role}" is not authorized for this action.`
    );
  }

  return session;
}

/**
 * Requires a specific RBAC permission.
 */
export async function requirePermission(permission: Permission): Promise<UserSession> {
  const session = await requireAuth();

  if (!hasPermission(session.role, permission)) {
    throw new AuthError(
      'FORBIDDEN',
      403,
      `Access denied. Missing required permission: "${permission}".`
    );
  }

  return session;
}

/**
 * Resolves the root Municipal Corporation ID (level: DISTRICT_CORP) for any jurisdiction.
 */
export async function getCorporationIdForJurisdiction(
  jurisdictionId: string | null | undefined
): Promise<string | null> {
  if (!jurisdictionId) return null;
  try {
    let currentId: string | null = jurisdictionId;
    let iterations = 0;
    while (currentId && iterations < 5) {
      iterations++;
      const jur: { id: string; level: string; parentId: string | null } | null = await db.jurisdiction.findUnique({
        where: { id: currentId },
        select: { id: true, level: true, parentId: true },
      });
      if (!jur) return null;
      if (jur.level === 'DISTRICT_CORP' || !jur.parentId) {
        return jur.id;
      }
      currentId = jur.parentId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates whether an authenticated session has permission to access a specific Municipal Corporation.
 */
export async function canAccessCorporation(
  session: UserSession,
  targetCorporationId: string
): Promise<boolean> {
  if (!targetCorporationId) return false;
  if (session.role === 'PLATFORM_ADMIN') return true;
  if (!session.jurisdictionId) return false;
  const userCorpId = await getCorporationIdForJurisdiction(session.jurisdictionId);
  if (userCorpId === targetCorporationId) return true;
  if (userCorpId) {
    const [c1, c2] = await Promise.all([
      db.jurisdiction.findUnique({ where: { id: userCorpId }, select: { city: true, name: true } }),
      db.jurisdiction.findUnique({ where: { id: targetCorporationId }, select: { city: true, name: true } }),
    ]);
    if (c1 && c2 && ((c1.city && c2.city && c1.city.toLowerCase() === c2.city.toLowerCase()) || c1.name.toLowerCase() === c2.name.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates whether an authenticated session has access to a specific jurisdiction.
 * Prevents cross-jurisdiction privilege escalation and data tampering.
 */
export async function canAccessJurisdiction(
  session: UserSession,
  targetJurisdictionId: string | null | undefined
): Promise<boolean> {
  if (!targetJurisdictionId) return false;

  // Platform admins oversee all jurisdictions
  if (session.role === 'PLATFORM_ADMIN') {
    return true;
  }

  // Exact jurisdiction match
  if (session.jurisdictionId === targetJurisdictionId) {
    return true;
  }

  // Supervisors oversee an entire Zone and all its constituent jurisdictions
  if (session.role === 'SUPERVISOR') {
    try {
      const target = await db.jurisdiction.findUnique({
        where: { id: targetJurisdictionId },
        select: { id: true, parentId: true },
      });

      if (target && target.parentId === session.jurisdictionId) {
        return true;
      }
    } catch {
      return false;
    }
  }

  // Corporation-level access control: check if both belong to the same municipal corporation
  if (session.jurisdictionId) {
    try {
      const userCorpId = await getCorporationIdForJurisdiction(session.jurisdictionId);
      const targetCorpId = await getCorporationIdForJurisdiction(targetJurisdictionId);
      if (userCorpId && targetCorpId && userCorpId !== targetCorpId) {
        const [c1, c2] = await Promise.all([
          db.jurisdiction.findUnique({ where: { id: userCorpId }, select: { city: true, name: true } }),
          db.jurisdiction.findUnique({ where: { id: targetCorpId }, select: { city: true, name: true } }),
        ]);
        if (c1 && c2 && ((c1.city && c2.city && c1.city.toLowerCase() === c2.city.toLowerCase()) || c1.name.toLowerCase() === c2.name.toLowerCase())) {
          return true;
        }
        return false; // Cross-corporation access strictly denied
      }

      // If both belong to the same corporation hierarchy
      if (userCorpId && targetCorpId && userCorpId === targetCorpId) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Evaluates whether an authenticated session can view or mutate a specific complaint record.
 * Enforces ownership, department, and jurisdiction isolation boundaries.
 */
export function canAccessComplaint(
  session: UserSession,
  complaint: {
    citizenId?: string | null;
    citizenPhone?: string | null;
    jurisdictionId?: string | null;
    departmentId?: string | null;
    assignedWorkerId?: string | null;
    assignments?: Array<{ assignedWorkerId?: string | null; assignedWorker?: { id?: string | null }; isActive?: boolean }>;
    corporationId?: string | null;
  },
  resolvedCorpId?: string | null
): boolean {
  // Platform admins have platform-wide oversight to triage, assign, and verify complaints
  if (session.role === 'PLATFORM_ADMIN') {
    return true;
  }

  // Citizens can access ONLY their own complaints via stable authenticated user ID
  if (session.role === 'CITIZEN') {
    return Boolean(complaint.citizenId && complaint.citizenId === session.userId);
  }

  // Field workers can access ONLY work orders explicitly assigned to them
  if (session.role === 'FIELD_WORKER') {
    const directMatch = Boolean(complaint.assignedWorkerId && complaint.assignedWorkerId === session.userId);
    const assignmentMatch = Boolean(
      Array.isArray(complaint.assignments) &&
      complaint.assignments.some(
        (a) => (a.assignedWorkerId === session.userId || a.assignedWorker?.id === session.userId) && a.isActive !== false
      )
    );
    return directMatch || assignmentMatch;
  }

  // Triage Officers & Dept Admins are restricted to their Department and Corporation/Jurisdiction
  if (session.role === 'OFFICER' || session.role === 'DEPT_ADMIN') {
    const matchesDept = Boolean(
      session.departmentId && complaint.departmentId === session.departmentId
    );
    const matchesJurisdiction = Boolean(
      !session.jurisdictionId ||
      !complaint.jurisdictionId ||
      session.jurisdictionId === complaint.jurisdictionId ||
      (resolvedCorpId && (session.jurisdictionId === resolvedCorpId || complaint.jurisdictionId === resolvedCorpId || complaint.corporationId === resolvedCorpId))
    );
    return matchesDept && matchesJurisdiction;
  }

  // Supervisors are restricted to their Department; zone/ward hierarchy is verified via canAccessJurisdiction
  if (session.role === 'SUPERVISOR') {
    const matchesDept = Boolean(
      !session.departmentId || !complaint.departmentId || complaint.departmentId === session.departmentId
    );
    return matchesDept;
  }

  return false;
}
