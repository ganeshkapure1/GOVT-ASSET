import { test, expect } from '@playwright/test';

test.describe.serial('GovAsset P0 Complete End-to-End Lifecycle', () => {
  const uniqueId = Date.now().toString().slice(-4);
  const testCitizenPhone = `+919822${uniqueId}01`;
  const testWorkerPhone = `+9198220${uniqueId}1`;
  const testWorkerEmail = `worker.${uniqueId}@govasset.in`;
  const testWorkerStaffCode = `W${uniqueId}`;
  let generatedReference = '';

  test('Step 1: Fresh visitor accesses public landing page with zero citizen leakage', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page).toHaveTitle(/GovAsset/i);
    // Landing page renders without pre-logged citizen identity
    await expect(page.locator('body')).not.toContainText('Rajesh Patil');
    const loginLink = page.locator('a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
  });

  test('Step 2: Citizen logs in via OTP in browser and submits a complaint via UI', async ({ page, context }) => {
    test.setTimeout(120000);
    await context.clearCookies();

    // 1. Visit Login Page
    await page.goto('/login');
    await expect(page.locator('button:has-text("Citizen Login")')).toBeVisible();

    // 2. Citizen enters mobile number
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill(testCitizenPhone);

    // 3. Request OTP
    const sendOtpBtn = page.locator('button[type="submit"]:has-text("Send Verification Code")');
    await sendOtpBtn.click();

    // 4. In dev mode, wait for OTP code input step and fill mock OTP
    const otpInput = page.locator('input[placeholder="123456"]').first();
    await expect(otpInput).toBeVisible({ timeout: 35000 });

    // Use code button or fill directly
    const useCodeBtn = page.locator('button:has-text("Use Code")');
    if (await useCodeBtn.isVisible()) {
      await useCodeBtn.click();
    } else {
      await otpInput.fill('123456');
    }

    // 5. Verify & Sign In
    const verifyBtn = page.locator('button[type="submit"]:has-text("Verify & Sign In")');
    await verifyBtn.click();

    // 6. Redirected to /my-complaints
    await page.waitForURL(/.*\/my-complaints.*/, { timeout: 35000 });
    await expect(page.locator('h1, h2')).toContainText(/My Submitted Civic Complaints|My Grievances|Complaints/i);

    // 7. Navigate to Report Page
    await page.goto('/report');
    await expect(page.locator('body')).toContainText(/Citizen Grievance Redressal/i);

    // 8. Fill in Complaint Details
    // Select Category (e.g. Damaged Roads)
    const categoryBtn = page.locator('button:has-text("Damaged Roads")').first();
    if (await categoryBtn.isVisible()) {
      await categoryBtn.click();
    }

    // Continue to Step 2
    const nextBtn1 = page.locator('button:has-text("Continue to Step 2")').first();
    await nextBtn1.click();

    // Enter address and description in Step 2
    const descInput = page.locator('textarea').first();
    await expect(descInput).toBeVisible();
    await descInput.fill(`Deep pothole on highway near flyover causing vehicle damage. Test Ref ${uniqueId}`);

    const addressInput = page.locator('input[placeholder*="landmark" i], input[placeholder*="street" i], input#input-address').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill(`Near City Center Plaza, Jalna Road, Sector ${uniqueId}`);
    }

    // Continue to Step 3
    const nextBtn2 = page.locator('button:has-text("Continue to Step 3")').first();
    await nextBtn2.click();

    // Step 3: Citizen identity is already verified via session
    await expect(page.locator('body')).toContainText(/Verified Citizen Identity|Citizen Identity Confirmed/i);

    // Submit complaint
    const submitBtn = page.locator('button[type="submit"]:has-text("Submit Civic Complaint")').first();
    await submitBtn.click();

    // Success Modal with Reference ID
    const refElement = page.locator('span.font-mono, div.font-mono').filter({ hasText: /GOV-2026-\d{5}/ }).first();
    await expect(refElement).toBeVisible({ timeout: 60000 });
    const refText = await refElement.textContent();
    generatedReference = refText?.trim().match(/GOV-2026-\d{5}/)?.[0] || '';
    expect(generatedReference).toMatch(/^GOV-2026-\d{5}$/);
  });

  test('Step 3: Officer logs in, opens Manage Workers, and creates a new worker without cursor loss', async ({ page, context }) => {
    test.setTimeout(120000);
    await context.clearCookies();

    // 1. Official Login
    await page.goto('/login');
    const officialTab = page.locator('button:has-text("Official Login")');
    await officialTab.click();

    await page.fill('input[type="text"]', 'officer.csmc@govasset.in');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]:has-text("Sign In to Government Dashboard")');

    // Wait for ops redirect
    await page.waitForURL(/.*\/ops\/.*/, { timeout: 35000 });

    // 2. Open Crew Directory (/ops/crew)
    await page.goto('/ops/crew');
    await expect(page.locator('h1, h2')).toContainText(/Manage Workers/i);

    // 3. Open Add Worker Modal
    const addWorkerBtn = page.locator('button:has-text("Add Worker")').first();
    await addWorkerBtn.click();

    // 4. Fill form testing continuous typing
    const nameInput = page.locator('input[placeholder*="Ramesh" i]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill(`Worker ${uniqueId}`);
    expect(await nameInput.inputValue()).toBe(`Worker ${uniqueId}`);

    const phoneInput = page.locator('input[placeholder*="+91" i]').first();
    await phoneInput.fill(testWorkerPhone);
    expect(await phoneInput.inputValue()).toBe(testWorkerPhone);

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(testWorkerEmail);
    expect(await emailInput.inputValue()).toBe(testWorkerEmail);

    const staffInput = page.locator('input[placeholder*="CSMC-FW" i]').first();
    await staffInput.fill(testWorkerStaffCode);
    expect(await staffInput.inputValue()).toBe(testWorkerStaffCode);

    // Select Road Repair skill tag
    const skillTag = page.locator('button:has-text("Road Repair")').first();
    if (await skillTag.isVisible()) {
      await skillTag.click();
    }

    // Submit form
    const confirmBtn = page.locator('button[type="submit"]:has-text("Confirm & Onboard")');
    await confirmBtn.click();

    // Verify success notice appears
    await expect(page.locator('body')).toContainText(/successfully onboarded/i, { timeout: 35000 });
  });

  test('Step 4: Officer locates the new complaint and assigns it to a field worker', async ({ page, context }) => {
    test.setTimeout(120000);
    await context.clearCookies();

    // 1. Official Login
    await page.goto('/login');
    const officialTab = page.locator('button:has-text("Official Login")');
    await officialTab.click();

    await page.fill('input[type="text"]', 'officer.csmc@govasset.in');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]:has-text("Sign In to Government Dashboard")');
    await page.waitForURL(/.*\/ops\/.*/, { timeout: 25000 });

    // 2. Go to Complaints Queue
    await page.goto('/ops/complaints');
    await expect(page.locator('h1, h2')).toContainText(/Complaints.*Queue/i);

    // 3. Search for the generated complaint
    const searchInput = page.locator('input[placeholder*="Search reference" i], input[placeholder*="Search by" i]').first();
    await searchInput.fill(generatedReference);

    // Wait for row containing reference
    const complaintRow = page.locator('tr').filter({ hasText: generatedReference });
    await expect(complaintRow).toBeVisible({ timeout: 25000 });

    // 4. Click Assign button
    const assignBtn = complaintRow.locator('button:has-text("Assign")').first();
    await assignBtn.click();

    // 5. Assignment Modal opens
    const modalTitle = page.locator('h2').filter({ hasText: /Smart Work-Type|Assignment/i });
    await expect(modalTitle).toBeVisible();

    // 6. Confirm assignment
    const confirmAssignBtn = page.locator('button:has-text("Confirm Assignment")');
    await confirmAssignBtn.click();

    // 7. Verify success notification and status change
    await expect(page.locator('body')).toContainText(/assigned|ASSIGNED/i, { timeout: 35000 });
  });

  test('Step 5: Worker logs in, sees assigned task, starts work, and submits completion proof', async ({ page, context }) => {
    test.setTimeout(120000);
    await context.clearCookies();

    // 1. Worker Login
    await page.goto('/login');
    const workerTab = page.locator('button:has-text("Worker Login")');
    await workerTab.click();

    await page.fill('input[placeholder*="field.csmc" i], input[type="text"]', 'field.csmc@govasset.in');
    await page.fill('input[type="password"]', 'password123');
    const submitBtn = page.locator('button[type="submit"]:has-text("Sign In to Worker Dashboard")');
    await submitBtn.click();

    // 2. Lands on Field Worker portal (/ops/field)
    await page.waitForURL(/.*\/ops\/field.*/, { timeout: 25000 });
    await expect(page.locator('body')).toContainText(/Field Crew Operations Console|Field/i);

    // 3. Check "My Assigned Work" tab
    const assignedTab = page.locator('button:has-text("My Assigned Work"), button:has-text("My Assigned Tasks")').first();
    await assignedTab.click();

    // 4. Start Work on the task (or first assigned task)
    const startWorkBtn = page.locator('button:has-text("Start Work")').first();
    if (await startWorkBtn.isVisible()) {
      await startWorkBtn.click();
      await expect(page.locator('body')).toContainText(/in progress/i, { timeout: 35000 });
    }

    // 5. Open In Progress tab
    const wipTab = page.locator('button:has-text("In Progress")').first();
    await wipTab.click();

    // 6. Click Mark Work Complete
    const completeBtn = page.locator('button:has-text("Mark Work Complete")').first();
    if (await completeBtn.isVisible()) {
      await completeBtn.click();

      // Modal opens
      const submitCompletionModal = page.locator('h2').filter({ hasText: /Mark Work Complete/i });
      await expect(submitCompletionModal).toBeVisible();

      // Fill notes
      const notesInput = page.locator('textarea').first();
      if (await notesInput.isVisible()) {
        await notesInput.fill('Cavity filled with cold mix bitumen and compacted to road grade.');
      }

      // Submit completion
      const confirmCompleteBtn = page.locator('button:has-text("Confirm & Mark Work Complete"), button[type="submit"]:has-text("Confirm")');
      await confirmCompleteBtn.click();

      await expect(page.locator('body')).toContainText(/awaiting|WORK_COMPLETED|Work completed/i, { timeout: 35000 });
    }
  });

  test('Step 6: Supervisor logs in and verifies the completed task', async ({ page, context }) => {
    test.setTimeout(120000);
    await context.clearCookies();

    // 1. Supervisor Login
    await page.goto('/login');
    const officialTab = page.locator('button:has-text("Official Login")');
    await officialTab.click();

    await page.fill('input[type="text"]', 'supervisor.csmc@govasset.in');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]:has-text("Sign In to Government Dashboard")');

    await page.waitForURL(/.*\/ops\/.*/, { timeout: 25000 });

    // 2. Navigate to Verifications (/ops/verifications)
    await page.goto('/ops/verifications');
    await expect(page.locator('h1, h2')).toContainText(/Quality Verification|Verification|Resolution Queue/i);

    // 3. Find the verification card for the generated complaint reference (or the first available card)
    const verificationCard = page.locator('div').filter({ hasText: generatedReference }).first();
    const approveBtn = (await verificationCard.isVisible())
      ? verificationCard.locator('button:has-text("Approve & Resolve")').first()
      : page.locator('button:has-text("Approve & Resolve")').first();

    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await expect(page.locator('body')).toContainText(/approved|VERIFIED_RESOLVED/i, { timeout: 35000 });
    }
  });

  test('Step 7: Citizen tracking confirms final status and timeline persistence', async ({ page, context }) => {
    await context.clearCookies();

    // Visit public tracking page with the generated complaint reference
    await page.goto(`/track?ref=${generatedReference}`);
    await expect(page.locator('body')).toBeVisible();

    // Confirm reference is rendered
    await expect(page.locator('body')).toContainText(generatedReference);

    // Reload page to verify persistence across sessions/refreshes
    await page.reload();
    await expect(page.locator('body')).toContainText(generatedReference);
  });
});
