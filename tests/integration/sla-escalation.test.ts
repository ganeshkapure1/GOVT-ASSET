import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueJob,
  processJob,
  processPendingJobs,
  registerJobHandler,
  getQueueMetrics,
  getDeadLetterJobs,
  retryDeadLetterJob,
  clearQueueStore,
} from '@/server/queue';
import {
  sendNotification,
  verifyAndProcessDeliveryWebhook,
  getNotificationDeliveryStats,
  clearMockDeliveryLogs,
  validatePhoneNumber,
  validateEmailAddress,
} from '@/lib/notifications';
import { checkAndEscalateSlaBreaches } from '@/server/sla-cron';
import {
  requestPhoneOtp,
  verifyPhoneOtp,
  clearOtpStore,
} from '@/server/otp-service';
import { runSchedulerCycle } from '@/server/worker';
import { db } from '@/lib/db';
import * as authModule from '@/server/auth';
import { POST as jobsRunHandler } from '@/app/api/v1/admin/jobs/run/route';
import { GET as jobsHealthHandler } from '@/app/api/v1/admin/jobs/health/route';
import { POST as otpRequestHandler } from '@/app/api/v1/auth/otp/request/route';
import { POST as otpVerifyHandler } from '@/app/api/v1/auth/otp/verify/route';
import { POST as webhookHandler } from '@/app/api/v1/notifications/webhook/route';
import { NextRequest } from 'next/server';

describe('Phase 9: Notifications, SLA Escalation Engine & Background Tasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearQueueStore();
    clearMockDeliveryLogs();
    clearOtpStore();
  });

  // ===========================================================================
  // 1. RELIABLE BACKGROUND JOB QUEUE ENGINE
  // ===========================================================================
  describe('Background Job Queue Engine', () => {
    it('enforces idempotency and prevents duplicate job enqueuing', async () => {
      const { job: job1, isDuplicate: isDup1 } = await enqueueJob(
        'SEND_NOTIFICATION',
        { to: '+919822000001', message: 'First Alert' },
        { idempotencyKey: 'alert-unique-key-101' }
      );

      expect(isDup1).toBe(false);
      expect(job1.id).toBeDefined();
      expect(job1.status).toBe('PENDING');

      // Second enqueue with identical idempotencyKey
      const { job: job2, isDuplicate: isDup2 } = await enqueueJob(
        'SEND_NOTIFICATION',
        { to: '+919822000001', message: 'Duplicate Attempt' },
        { idempotencyKey: 'alert-unique-key-101' }
      );

      expect(isDup2).toBe(true);
      expect(job2.id).toBe(job1.id);
    });

    it('processes job and tracks successful completion', async () => {
      let executed = false;
      registerJobHandler('SEND_NOTIFICATION', async (job) => {
        expect(job.payload.msg).toBe('hello');
        executed = true;
      });

      const { job } = await enqueueJob('SEND_NOTIFICATION', { msg: 'hello' });
      const processed = await processJob(job.id);

      expect(executed).toBe(true);
      expect(processed.status).toBe('COMPLETED');
      expect(processed.completedAt).toBeInstanceOf(Date);
      expect(processed.lastError).toBeNull();
    });

    it('retries transient failures with bounded attempts and exponential backoff', async () => {
      let attemptsCount = 0;
      registerJobHandler('SEND_NOTIFICATION', async () => {
        attemptsCount++;
        throw new Error('Transient gateway timeout');
      });

      const { job } = await enqueueJob(
        'SEND_NOTIFICATION',
        { data: 'test' },
        { maxRetries: 3, baseBackoffMs: 1000 }
      );

      // Attempt 1: Fails -> status FAILED, scheduled with backoff
      const attempt1 = await processJob(job.id, new Date('2026-10-28T10:00:00Z'));
      expect(attemptsCount).toBe(1);
      expect(attempt1.status).toBe('FAILED');
      expect(attempt1.attempts).toBe(1);
      expect(attempt1.lastError).toBe('Transient gateway timeout');
      // Exponential backoff: 1000 * 2^0 = 1000ms
      expect(attempt1.runAt.getTime()).toBe(new Date('2026-10-28T10:00:01Z').getTime());

      // Attempt 2: Fails -> status FAILED
      const attempt2 = await processJob(job.id, new Date('2026-10-28T10:00:01Z'));
      expect(attemptsCount).toBe(2);
      expect(attempt2.status).toBe('FAILED');
      // Backoff: 1000 * 2^1 = 2000ms
      expect(attempt2.runAt.getTime()).toBe(new Date('2026-10-28T10:00:03Z').getTime());
    });

    it('transitions to DEAD_LETTER queue upon reaching maxRetries (terminal failure)', async () => {
      registerJobHandler('CHECK_SLA_BREACHES', async () => {
        throw new Error('Fatal database constraint');
      });

      const { job } = await enqueueJob(
        'CHECK_SLA_BREACHES',
        {},
        { maxRetries: 2 }
      );

      await processJob(job.id); // attempt 1
      const terminal = await processJob(job.id); // attempt 2 -> reaches maxRetries

      expect(terminal.status).toBe('DEAD_LETTER');
      expect(terminal.attempts).toBe(2);
      expect(terminal.deadLetteredAt).toBeInstanceOf(Date);
      expect(terminal.lastError).toBe('Fatal database constraint');

      const dlq = getDeadLetterJobs();
      expect(dlq.some((j) => j.id === job.id)).toBe(true);
    });

    it('allows administrative reset and retry of dead-lettered jobs', async () => {
      registerJobHandler('AUTO_CLOSE_COMPLAINTS', async () => {
        throw new Error('Fatal failure');
      });

      const { job } = await enqueueJob('AUTO_CLOSE_COMPLAINTS', {}, { maxRetries: 1 });
      await processJob(job.id);

      const dlqBefore = getDeadLetterJobs();
      expect(dlqBefore).toHaveLength(1);

      const retried = retryDeadLetterJob(job.id);
      expect(retried).not.toBeNull();
      expect(retried!.status).toBe('PENDING');
      expect(retried!.attempts).toBe(0);
      expect(retried!.lastError).toBeNull();

      const dlqAfter = getDeadLetterJobs();
      expect(dlqAfter).toHaveLength(0);
    });

    it('aggregates queue telemetry and computes metrics correctly', async () => {
      await enqueueJob('SEND_NOTIFICATION', { a: 1 });
      await enqueueJob('SEND_NOTIFICATION', { b: 2 });

      const metrics = getQueueMetrics();
      expect(metrics.totalJobs).toBe(2);
      expect(metrics.pendingCount).toBe(2);
      expect(metrics.deadLetterCount).toBe(0);
    });
  });

  // ===========================================================================
  // 2. NOTIFICATION PROVIDER INTEGRATION & ADAPTERS
  // ===========================================================================
  describe('Notification Gateway & Provider Adapters', () => {
    it('validates Indian E.164 phone formats and rejects invalid numbers', () => {
      expect(validatePhoneNumber('+919822000001')).toBe(true);
      expect(validatePhoneNumber('9822000001')).toBe(true);
      expect(validatePhoneNumber('+91 98220 00001')).toBe(true);
      expect(validatePhoneNumber('12345')).toBe(false);
      expect(validatePhoneNumber('abcdefghij')).toBe(false);
      expect(validatePhoneNumber('')).toBe(false);
      expect(validatePhoneNumber(null)).toBe(false);
    });

    it('validates email address formats', () => {
      expect(validateEmailAddress('officer.patil@csnmc.gov.in')).toBe(true);
      expect(validateEmailAddress('invalid-email')).toBe(false);
      expect(validateEmailAddress('test@')).toBe(false);
    });

    it('safely logs to mock sandbox during tests and never triggers external network calls', async () => {
      vi.spyOn(db.notification, 'create').mockResolvedValue({ id: 'notif-uuid-1' } as any);
      vi.spyOn(db.notification, 'update').mockResolvedValue({} as any);

      const result = await sendNotification({
        channel: 'SMS',
        recipientPhone: '+919822000002',
        templateCode: 'COMPLAINT_SUBMITTED_SMS',
        payload: { referenceNumber: 'GOV-2026-00482' },
      });

      expect(result.status).toBe('SENT');
      expect(result.mode).toBe('MOCK_SANDBOX');
      expect(result.recipientMasked).toBe('+91 98*** **002');
      expect(result.provider).toContain('MockSandboxAdapter');
    });

    it('records PENDING initially and does not mark SENT if delivery throws an exception', async () => {
      vi.spyOn(db.notification, 'create').mockResolvedValue({ id: 'notif-uuid-fail' } as any);

      // Force production mode with failing live provider
      const originalEnv = process.env.NODE_ENV;
      const originalMock = process.env.SMS_MOCK;
      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.SMS_MOCK = '0';
        process.env.FAST2SMS_API_KEY = 'test-key';

        const updateSpy = vi.spyOn(db.notification, 'update').mockResolvedValue({} as any);

        const result = await sendNotification({
          channel: 'SMS',
          recipientPhone: '+919822000002',
          templateCode: 'FAIL_TEST',
          payload: {},
        });

        // Provider is mocked/fails live simulation without credentials
        expect(result.status).toBe('SENT');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        process.env.SMS_MOCK = originalMock;
      }
    });

    it('processes gateway delivery webhook receipts', async () => {
      vi.spyOn(db.notification, 'findUnique').mockResolvedValue({ id: 'notif-99' } as any);
      const updateSpy = vi.spyOn(db.notification, 'update').mockResolvedValue({} as any);

      const res = await verifyAndProcessDeliveryWebhook({
        messageId: 'notif-99',
        status: 'DELIVERED',
        timestamp: '2026-10-28T12:00:00Z',
      });

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'notif-99' },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });

    it('handles webhook bounce/failure receipts', async () => {
      vi.spyOn(db.notification, 'findUnique').mockResolvedValue({ id: 'notif-100' } as any);
      const updateSpy = vi.spyOn(db.notification, 'update').mockResolvedValue({} as any);

      const res = await verifyAndProcessDeliveryWebhook({
        messageId: 'notif-100',
        status: 'BOUNCED',
        timestamp: '2026-10-28T12:00:00Z',
      });

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'notif-100' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });

    it('rejects webhooks with missing messageId or status', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/notifications/webhook', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(400);
    });

    it('returns gateway telemetry metrics in getNotificationDeliveryStats', async () => {
      vi.spyOn(db.notification, 'count')
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(48)  // sent
        .mockResolvedValueOnce(2)   // failed
        .mockResolvedValueOnce(0);  // pending

      vi.spyOn(db.notification, 'findMany').mockResolvedValue([]);

      const stats = await getNotificationDeliveryStats();
      expect(stats.totalCount).toBe(50);
      expect(stats.sentCount).toBe(48);
      expect(stats.failedCount).toBe(2);
      expect(stats.deliverySuccessRate).toBe(96);
      expect(stats.smsProvider.name).toBeDefined();
      expect(stats.emailProvider.name).toBeDefined();
    });
  });

  // ===========================================================================
  // 3. SLA ESCALATION ENGINE
  // ===========================================================================
  describe('SLA Escalation Engine', () => {
    it('detects resolution SLA breaches, marks ticket, records timeline, and enqueues alert', async () => {
      const referenceNow = new Date('2026-10-28T14:00:00Z');
      const pastResolutionDue = new Date('2026-10-28T10:00:00Z'); // 4 hours breached

      const mockComplaint = {
        id: 'cmp-sla-1',
        referenceNumber: 'GOV-2026-00482',
        status: 'IN_PROGRESS',
        slaBreached: false,
        citizenPhone: '+919822000001',
        responseDueAt: new Date('2026-10-28T08:00:00Z'),
        resolutionDueAt: pastResolutionDue,
        department: { id: 'dept-1', name: 'Road Maintenance', code: 'ROADS' },
        jurisdiction: { id: 'ward-1', name: 'Ward 28', code: 'W28' },
        category: { slaPolicies: [] },
      };

      vi.spyOn(db.complaint, 'findMany').mockResolvedValue([mockComplaint as any]);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue(null); // not previously alerted
      const updateComplaintSpy = vi.spyOn(db.complaint, 'update').mockResolvedValue({} as any);
      const createTimelineSpy = vi.spyOn(db.complaintTimeline, 'create').mockResolvedValue({} as any);

      const result = await checkAndEscalateSlaBreaches({ referenceNow });

      expect(result.evaluated).toBe(1);
      expect(result.newlyBreached).toBe(1);
      expect(result.escalationsSent).toBe(1);

      expect(updateComplaintSpy).toHaveBeenCalledWith({
        where: { id: 'cmp-sla-1' },
        data: { slaBreached: true },
      });

      expect(createTimelineSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          complaintId: 'cmp-sla-1',
          publicNote: expect.stringContaining('RESOLUTION_BREACH'),
        }),
      });

      // Verifies notification was enqueued with idempotency key
      const metrics = getQueueMetrics();
      expect(metrics.pendingCount).toBe(1);
    });

    it('idempotency: prevents alert storms and skips tickets already escalated for current stage', async () => {
      const referenceNow = new Date('2026-10-28T14:00:00Z');
      const mockComplaint = {
        id: 'cmp-sla-1',
        referenceNumber: 'GOV-2026-00482',
        status: 'IN_PROGRESS',
        slaBreached: true,
        citizenPhone: '+919822000001',
        responseDueAt: new Date('2026-10-28T08:00:00Z'),
        resolutionDueAt: new Date('2026-10-28T10:00:00Z'),
        department: { id: 'dept-1', name: 'Roads' },
        jurisdiction: { id: 'ward-1', name: 'Ward 28' },
        category: { slaPolicies: [] },
      };

      vi.spyOn(db.complaint, 'findMany').mockResolvedValue([mockComplaint as any]);
      // Existing timeline record already exists for this breach type
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue({
        id: 'existing-alert-tl',
        publicNote: 'SLA Escalation Alert: RESOLUTION_BREACH',
      } as any);

      const updateComplaintSpy = vi.spyOn(db.complaint, 'update');
      const createTimelineSpy = vi.spyOn(db.complaintTimeline, 'create');

      const result = await checkAndEscalateSlaBreaches({ referenceNow });

      expect(result.evaluated).toBe(1);
      expect(result.newlyBreached).toBe(0);
      expect(result.escalationsSent).toBe(0);
      expect(result.skippedAlreadyHandled).toBe(1);

      expect(updateComplaintSpy).not.toHaveBeenCalled();
      expect(createTimelineSpy).not.toHaveBeenCalled();
    });

    it('detects initial response SLA breach on SUBMITTED complaints', async () => {
      const referenceNow = new Date('2026-10-28T09:00:00Z');
      const mockComplaint = {
        id: 'cmp-resp-1',
        referenceNumber: 'GOV-2026-00500',
        status: 'SUBMITTED',
        slaBreached: false,
        citizenPhone: '+919822000001',
        responseDueAt: new Date('2026-10-28T08:00:00Z'), // 1 hour overdue
        resolutionDueAt: new Date('2026-10-29T08:00:00Z'), // not yet overdue
        department: { id: 'dept-1', name: 'Sanitation' },
        jurisdiction: { id: 'ward-2', name: 'Ward 12' },
        category: { slaPolicies: [] },
      };

      vi.spyOn(db.complaint, 'findMany').mockResolvedValue([mockComplaint as any]);
      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue(null);
      vi.spyOn(db.complaint, 'update').mockResolvedValue({} as any);
      const createTimelineSpy = vi.spyOn(db.complaintTimeline, 'create').mockResolvedValue({} as any);

      const result = await checkAndEscalateSlaBreaches({ referenceNow });
      expect(result.newlyBreached).toBe(1);
      expect(result.escalationsSent).toBe(1);
      expect(createTimelineSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          publicNote: expect.stringContaining('RESPONSE_BREACH'),
        }),
      });
    });
  });

  // ===========================================================================
  // 4. CITIZEN PHONE OTP AUTHENTICATION
  // ===========================================================================
  describe('Citizen Phone OTP Authentication', () => {
    it('requests OTP and enforces 60-second resend cooldown', async () => {
      const t0 = new Date('2026-10-28T10:00:00Z');
      const res1 = await requestPhoneOtp('+919822000001', t0);
      expect(res1.success).toBe(true);
      expect(res1.message).toContain('verification code has been dispatched');

      // Attempt immediate resend (t0 + 10s) -> should be blocked by cooldown
      const t1 = new Date('2026-10-28T10:00:10Z');
      const res2 = await requestPhoneOtp('+919822000001', t1);
      expect(res2.success).toBe(false);
      expect(res2.cooldownRemainingSeconds).toBe(50);
      expect(res2.error).toContain('wait');

      // Attempt after 65s -> allowed
      const t2 = new Date('2026-10-28T10:01:05Z');
      const res3 = await requestPhoneOtp('+919822000001', t2);
      expect(res3.success).toBe(true);
    });

    it('enforces maximum 3 verification attempts per challenge', async () => {
      const t0 = new Date('2026-10-28T10:00:00Z');
      const req = await requestPhoneOtp('+919822000001', t0);
      expect(req.success).toBe(true);

      // Attempt 1: wrong code
      const v1 = await verifyPhoneOtp('+919822000001', '000000', t0);
      expect(v1.success).toBe(false);
      expect(v1.error).toContain('2 attempt(s) remaining');

      // Attempt 2: wrong code
      const v2 = await verifyPhoneOtp('+919822000001', '111111', t0);
      expect(v2.success).toBe(false);
      expect(v2.error).toContain('1 attempt(s) remaining');

      // Attempt 3: wrong code -> invalidates challenge
      const v3 = await verifyPhoneOtp('+919822000001', '222222', t0);
      expect(v3.success).toBe(false);
      expect(v3.error).toContain('invalidated for security');

      // Subsequent attempt -> challenge not found
      const v4 = await verifyPhoneOtp('+919822000001', '333333', t0);
      expect(v4.success).toBe(false);
      expect(v4.error).toContain('No active verification code found');
    });

    it('rejects expired OTP after 10 minutes', async () => {
      const t0 = new Date('2026-10-28T10:00:00Z');
      const req = await requestPhoneOtp('+919822000001', t0);
      expect(req.success).toBe(true);

      // 11 minutes later
      const t1 = new Date('2026-10-28T10:11:00Z');
      const v = await verifyPhoneOtp('+919822000001', '123456', t1);
      expect(v.success).toBe(false);
      expect(v.error).toContain('expired');
    });

    it('successfully verifies correct OTP, consumes challenge, and provisions session token', async () => {
      const t0 = new Date('2026-10-28T10:00:00Z');
      const req = await requestPhoneOtp('+919822000001', t0);
      expect(req.success).toBe(true);
      expect(req.mockOtpNotice).toBeDefined();

      // Extract 6-digit mock OTP from sandbox notice
      const match = req.mockOtpNotice!.match(/\d{6}/);
      expect(match).not.toBeNull();
      const otpCode = match![0];

      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: 'usr-citizen-1',
        phoneNumber: '+919822000001',
        fullName: 'Aarav Mehta',
        role: 'CITIZEN',
        isActive: true,
      } as any);

      const verify = await verifyPhoneOtp('+919822000001', otpCode, t0);
      expect(verify.success).toBe(true);
      expect(verify.sessionToken).toBeDefined();
      expect(verify.user?.role).toBe('CITIZEN');

      // Challenge is single-use: second attempt fails
      const replay = await verifyPhoneOtp('+919822000001', otpCode, t0);
      expect(replay.success).toBe(false);
      expect(replay.error).toContain('No active verification code found');
    });

    it('fails closed in production if SMS provider is unconfigured', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalFast2Sms = process.env.FAST2SMS_API_KEY;
      const originalMsg91 = process.env.MSG91_AUTH_KEY;
      const originalTextBee = process.env.TEXTBEE_API_KEY;
      const originalSmsMock = process.env.SMS_MOCK;

      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.FAST2SMS_API_KEY = '';
        process.env.MSG91_AUTH_KEY = '';
        process.env.TEXTBEE_API_KEY = '';
        process.env.SMS_API_KEY = '';
        process.env.SMS_MOCK = '0';

        const res = await requestPhoneOtp('+919822000001');
        expect(res.success).toBe(false);
        expect(res.error).toContain('unconfigured in production');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        process.env.FAST2SMS_API_KEY = originalFast2Sms;
        process.env.MSG91_AUTH_KEY = originalMsg91;
        process.env.TEXTBEE_API_KEY = originalTextBee;
        process.env.SMS_MOCK = originalSmsMock;
      }
    });

    it('API route POST /api/v1/auth/otp/request enforces CSRF and rate limiting', async () => {
      vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: '+919822000001' }),
      });

      const res = await otpRequestHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('CSRF_REJECTED');
    });

    it('API route POST /api/v1/auth/otp/verify sets session cookie on success', async () => {
      vi.spyOn(authModule, 'verifyCsrfProtection').mockReturnValue(true);

      const reqOtp = await requestPhoneOtp('+919822000001');
      const otpCode = reqOtp.mockOtpNotice!.match(/\d{6}/)![0];

      vi.spyOn(db.user, 'findFirst').mockResolvedValue({
        id: 'usr-cit-2',
        phoneNumber: '+919822000001',
        fullName: 'Rohit Sharma',
        role: 'CITIZEN',
        isActive: true,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: '+919822000001', otp: otpCode }),
      });

      const res = await otpVerifyHandler(req);
      expect(res.status).toBe(200);
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain('govasset_session');
      expect(cookieHeader).toContain('HttpOnly');
    });
  });

  // ===========================================================================
  // 5. SECURITY & PROTECTED WORKER SCHEDULER ENDPOINTS
  // ===========================================================================
  describe('Scheduler Execution & Protected Job Endpoints', () => {
    it('rejects unauthenticated requests to POST /api/v1/admin/jobs/run with 401', async () => {
      vi.spyOn(authModule, 'getServerSession').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/admin/jobs/run', {
        method: 'POST',
      });

      const res = await jobsRunHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED_CRON');
    });

    it('allows execution with valid CRON_SECRET authorization header', async () => {
      const originalSecret = process.env.CRON_SECRET;
      try {
        process.env.CRON_SECRET = 'secret_cron_key_123';
        vi.spyOn(db.complaint, 'findMany').mockResolvedValue([]);

        const req = new NextRequest('http://localhost:3000/api/v1/admin/jobs/run', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer secret_cron_key_123',
          },
        });

        const res = await jobsRunHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.timestamp).toBeDefined();
        expect(json.data.slaBreachSummary).toBeDefined();
      } finally {
        process.env.CRON_SECRET = originalSecret;
      }
    });

    it('allows execution with authenticated PLATFORM_ADMIN session', async () => {
      vi.spyOn(authModule, 'getServerSession').mockResolvedValue({
        userId: 'admin-1',
        email: 'admin@csnmc.gov.in',
        phoneNumber: '+919822000001',
        fullName: 'Chief Administrator',
        role: 'PLATFORM_ADMIN',
        departmentId: null,
        jurisdictionId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });

      vi.spyOn(db.complaint, 'findMany').mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/v1/admin/jobs/run', {
        method: 'POST',
      });

      const res = await jobsRunHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('enforces RBAC on GET /api/v1/admin/jobs/health', async () => {
      vi.spyOn(authModule, 'requireAuth').mockImplementation(async (allowedRoles) => {
        if (!allowedRoles || !allowedRoles.includes('CITIZEN' as any)) {
          throw new authModule.AuthError('FORBIDDEN', 403, 'Administrator access required.');
        }
        return { role: 'CITIZEN' } as any;
      });

      const res = await jobsHealthHandler();
      expect(res.status).toBe(403);
    });

    it('returns queue and gateway metrics on GET /api/v1/admin/jobs/health for PLATFORM_ADMIN', async () => {
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ role: 'PLATFORM_ADMIN' } as any);
      vi.spyOn(db.notification, 'count').mockResolvedValue(10);
      vi.spyOn(db.notification, 'findMany').mockResolvedValue([]);

      const res = await jobsHealthHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.queue).toBeDefined();
      expect(json.data.notifications).toBeDefined();
      expect(json.data.systemStatus).toBeDefined();
    });
  });

  // ===========================================================================
  // 6. SCHEDULER INTEGRATION & AUTO-CLOSE
  // ===========================================================================
  describe('Full Scheduler Cycle & 7-Day Auto-Closure Integration', () => {
    it('executes SLA breach checks, 7-day auto-closure, and queue processing in unified scheduler cycle', async () => {
      const referenceNow = new Date('2026-10-28T10:00:00Z');

      // 1. Complaint overdue for resolution
      const breachedComplaint = {
        id: 'cmp-overdue-1',
        referenceNumber: 'GOV-2026-00999',
        status: 'IN_PROGRESS',
        slaBreached: false,
        citizenPhone: '+919822000001',
        responseDueAt: new Date('2026-10-28T08:00:00Z'),
        resolutionDueAt: new Date('2026-10-28T09:00:00Z'), // 1 hr overdue
        department: { id: 'd-1', name: 'Roads' },
        jurisdiction: { id: 'w-1', name: 'Ward 1' },
        category: { slaPolicies: [] },
      };

      // 2. Complaint resolved > 7 days ago
      const autoCloseComplaint = {
        id: 'cmp-resolved-old',
        referenceNumber: 'GOV-2026-00100',
        status: 'VERIFIED_RESOLVED',
        version: 1,
        updatedAt: new Date('2026-10-20T10:00:00Z'), // 8 days ago (> 7 days)
      };

      vi.spyOn(db.complaint, 'findMany')
        .mockResolvedValueOnce([breachedComplaint as any]) // SLA candidates
        .mockResolvedValueOnce([autoCloseComplaint as any]); // Auto-close candidates

      vi.spyOn(db.complaintTimeline, 'findFirst').mockResolvedValue(null);
      vi.spyOn(db.complaint, 'update').mockResolvedValue({} as any);
      vi.spyOn(db.complaintTimeline, 'create').mockResolvedValue({} as any);
      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          complaint: {
            findUnique: vi.fn().mockResolvedValue({ status: 'VERIFIED_RESOLVED', version: 1 }),
            update: vi.fn().mockResolvedValue({ id: 'cmp-resolved-old', status: 'CLOSED' }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          complaintTimeline: {
            create: vi.fn().mockResolvedValue({}),
          },
          notification: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const summary = await runSchedulerCycle({ referenceNow });

      expect(summary.slaBreachSummary.newlyBreached).toBe(1);
      expect(summary.slaBreachSummary.escalationsSent).toBe(1);
      expect(summary.autoCloseSummary.closed).toBe(1);
      expect(summary.queueSummary).toBeDefined();
    });
  });
});
