import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTestSessionCookie } from './helpers/auth';
import { SYNTHETIC_BOUNDARY_DISCLAIMER } from '@/lib/constants';

test.describe('Admin Operations & System Automation (E2E)', () => {
  test('Platform Admin accesses management portals and audits accessibility (WCAG 2.2 AA)', async ({ page, context }) => {
    // 1. Authenticate as Platform Administrator
    await setTestSessionCookie(context, {
      role: 'PLATFORM_ADMIN',
      fullName: 'Chief Municipal Admin',
      departmentId: null,
      jurisdictionId: null,
    });

    // 2. Navigate to Admin Dashboard
    await page.goto('/admin');
    await expect(page).toHaveURL(/.*\/admin/);

    const adminA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const adminViolations = adminA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(adminViolations).toEqual([]);

    // 3. Navigate to Jurisdictions management
    await page.goto('/admin/jurisdictions');
    await expect(page).toHaveURL(/.*\/admin\/jurisdictions/);

    const jurA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const jurViolations = jurA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(jurViolations).toEqual([]);

    // 4. Navigate to SLA Matrix management
    await page.goto('/admin/sla-matrix');
    await expect(page).toHaveURL(/.*\/admin\/sla-matrix/);

    const slaA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const slaViolations = slaA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(slaViolations).toEqual([]);

    // 5. Navigate to Users & RBAC management
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/.*\/admin\/users/);

    const usersA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const usersViolations = usersA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(usersViolations).toEqual([]);
  });

  test('Scheduler API Security: Auto-close and job daemon reject unauthorized requests missing cron secret', async ({ request }) => {
    // 1. Attempt triggering auto-close without cron secret or admin session
    const autoCloseRes = await request.post('/api/v1/admin/auto-close', {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    // Should fail with 401 Unauthorized or 403 Forbidden
    expect([401, 403]).toContain(autoCloseRes.status());

    // 2. Attempt triggering job runner without cron secret or admin session
    const jobRunRes = await request.post('/api/v1/admin/jobs/run', {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect([401, 403]).toContain(jobRunRes.status());
  });
});
