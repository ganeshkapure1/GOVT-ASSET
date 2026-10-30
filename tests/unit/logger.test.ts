import { describe, it, expect, vi } from 'vitest';
import { redactSensitiveData, logger } from '@/lib/logger';

describe('Phase 11: Structured Logging & Automated PII/Secret Redaction', () => {
  it('masks Indian phone numbers embedded in log messages', () => {
    const raw = 'Officer dispatched SMS notification to +919822010008 regarding defect GOV-2026-00482';
    const redacted = redactSensitiveData(raw);
    expect(redacted).not.toContain('9822010008');
    expect(redacted).toContain('+91 98*** **008');
  });

  it('masks email addresses embedded in log messages', () => {
    const raw = 'Citizen email alert queued for citizen.aarav@govasset.in successfully';
    const redacted = redactSensitiveData(raw);
    expect(redacted).not.toContain('citizen.aarav@govasset.in');
    expect(redacted).toContain('c***v@govasset.in');
  });

  it('redacts sensitive object fields (tokens, passwords, secrets, cookies, api keys)', () => {
    const payload = {
      action: 'LOGIN_ATTEMPT',
      user: 'admin@govasset.in',
      password: 'SuperSecretPassword123!',
      sessionToken: 'jwt_mock_token_abc_xyz',
      cookie: 'govasset_session=secret_token_value',
      apiKey: 'msg91_live_key_998877',
      authorization: 'Bearer secret_cron_key',
      metadata: {
        safeField: 'Pune Municipal Corporation',
        nestedSecret: 'nested_secret_123',
      },
    };

    const redacted = redactSensitiveData(payload);
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.sessionToken).toBe('[REDACTED]');
    expect(redacted.cookie).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.metadata.nestedSecret).toBe('[REDACTED]');
    expect(redacted.metadata.safeField).toBe('Pune Municipal Corporation');
  });

  it('handles circular object references without crashing', () => {
    const circularObj: any = { name: 'Root' };
    circularObj.self = circularObj;

    expect(() => redactSensitiveData(circularObj)).not.toThrow();
    const redacted = redactSensitiveData(circularObj);
    expect(redacted.self).toBe('[Circular]');
  });

  it('handles Error objects and redacts messages and stack traces', () => {
    const error = new Error('Database connection failed with key: secret_password_xyz for +919822010008');
    const redacted = redactSensitiveData(error);

    expect(redacted.name).toBe('Error');
    expect(redacted.message).not.toContain('9822010008');
    expect(redacted.message).toContain('+91 98*** **008');
  });

  it('formats structured JSON output correctly for logger methods', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('System startup initiated', {
      service: 'govasset-core',
      port: 3000,
      adminPhone: '+919822010001',
    });

    expect(spy).toHaveBeenCalled();
    const loggedJson = JSON.parse(spy.mock.calls[0][0]);
    expect(loggedJson.level).toBe('info');
    expect(loggedJson.message).toBe('System startup initiated');
    expect(loggedJson.context.service).toBe('govasset-core');
    expect(loggedJson.context.adminPhone).not.toContain('9822010001');

    spy.mockRestore();
  });
});
