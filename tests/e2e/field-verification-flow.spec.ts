import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setTestSessionCookie } from './helpers/auth';

test.describe('Field Worker Execution & Supervisor Verification (E2E)', () => {
  test('Field worker accesses task views and verifies accessibility', async ({ page, context }) => {
    // 1. Authenticate as Field Worker
    await setTestSessionCookie(context, {
      role: 'FIELD_WORKER',
      fullName: 'Vikram Singh (Crew Lead)',
      departmentId: 'dept-roads',
      jurisdictionId: 'ward-kothrud-28',
    });

    // 2. Navigate to Field Worker tasks
    await page.goto('/ops/field');
    await expect(page).toHaveURL(/.*\/ops\/field/);

    // 3. Accessibility audit on Field Worker portal
    const fieldA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const criticalViolations = fieldA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);
  });

  test('Supervisor accesses verifications dashboard and audits before/after evidence UI', async ({ page, context }) => {
    // 1. Authenticate as Supervisor
    await setTestSessionCookie(context, {
      role: 'SUPERVISOR',
      fullName: 'Kavita Joshi (Supervisor)',
      departmentId: 'dept-roads',
      jurisdictionId: 'ward-kothrud-28',
    });

    // 2. Navigate to Verifications view
    await page.goto('/ops/verifications');
    await expect(page).toHaveURL(/.*\/ops\/verifications/);

    // 3. Accessibility audit on Verifications dashboard
    const verifA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const criticalViolations = verifA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);
  });
});
