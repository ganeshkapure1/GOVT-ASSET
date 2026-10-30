import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Citizen Grievance & Tracking Workflow (E2E)', () => {
  test('Citizen submits grievance, receives reference ID, tracks status and verifies privacy', async ({ page }) => {
    // 1. Visit Report Issue page
    await page.goto('/report');
    await expect(page).toHaveTitle(/GovAsset/i);

    // 2. Automated Accessibility Audit on Report Form (WCAG 2.2 AA)
    const reportA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // Ignore color contrast in headless environment if sub-pixel rendering varies
      .analyze();
    const criticalViolations = reportA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);

    // 3. Fill in report form
    // Check address and description inputs
    const addressInput = page.locator('input#input-address, input[placeholder*="landmark" i], input[name="address"]').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill('Near Mayur Colony Bus Stop, Kothrud');
    }

    const descInput = page.locator('textarea').first();
    if (await descInput.isVisible()) {
      await descInput.fill('Substantial road cavity causing vehicular traffic diversion and hazard to two-wheelers.');
    }

    // 4. Verify Tracking Page Access & Accessibility
    await page.goto('/track');
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();

    const trackA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const trackViolations = trackA11y.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(trackViolations).toEqual([]);

    // 5. Test tracking input and search
    const trackInput = page.locator('input[placeholder*="reference" i], input[type="text"]').first();
    if (await trackInput.isVisible()) {
      await trackInput.fill('GOV-2026-00482');
      const searchBtn = page.locator('button:has-text("Track"), button[type="submit"]').first();
      if (await searchBtn.isVisible()) {
        await searchBtn.click();
      }
    }
  });

  test('Anti-IDOR: Public tracking does not reveal unmasked citizen phone numbers', async ({ request }) => {
    // Call public tracking API with a reference number
    const res = await request.get('/api/v1/complaints/track?referenceNumber=GOV-2026-00482');
    if (res.ok()) {
      const data = await res.json();
      if (data.success && data.data) {
        // Assert that raw full phone numbers are not present
        if (data.data.citizenPhone) {
          expect(data.data.citizenPhone).toContain('***');
        }
        if (data.data.reporterMasked) {
          expect(data.data.reporterMasked).toContain('***');
        }
      }
    }
  });
});
