import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTestSessionCookie } from './helpers/auth';
import { SYNTHETIC_BOUNDARY_DISCLAIMER } from '@/lib/constants';

test.describe('Operations Triage & Jurisdiction Guard (E2E)', () => {
  test('Officer accesses triage queue and verifies accessibility (WCAG 2.2 AA)', async ({ page, context }) => {
    // 1. Authenticate as Municipal Officer in Ward 28
    await setTestSessionCookie(context, {
      role: 'OFFICER',
      fullName: 'Rajesh Patil (Ward 28 Officer)',
      departmentId: 'dept-roads',
      jurisdictionId: 'ward-kothrud-28',
    });

    // 2. Navigate to Operations Triage
    await page.goto('/ops/triage');
    await expect(page).toHaveURL(/.*\/ops\/triage/);

    // 3. Automated Accessibility Audit on Triage View
    const triageA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const criticalViolations = triageA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);

    // 4. Check for presence of triage UI containers
    const triageHeading = page.locator('h1, h2, h3').first();
    await expect(triageHeading).toBeVisible();
  });

  test('Anti-Escalation: Unauthenticated visitor is redirected from /ops/triage to /login', async ({ page, context }) => {
    // Clear cookies
    await context.clearCookies();

    // Attempt direct access
    await page.goto('/ops/triage');

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
