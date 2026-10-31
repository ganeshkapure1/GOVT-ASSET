const { chromium } = require('playwright');
const path = require('path');

async function snap() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  await page.locator('button:has-text("Worker Login")').click();

  // Fill Ramesh's email and password
  const emailInput = page.locator('input[placeholder*="field.csmc"], input[type="text"]').last();
  await emailInput.fill('ramesh12@gmail.com');
  const passInput = page.locator('input[type="password"]').last();
  await passInput.fill('password123');

  await page.locator('button:has-text("Sign In to Worker Dashboard")').click();

  await page.waitForURL('**/ops/field', { timeout: 15000 });
  await page.waitForSelector('text=ramesh kale', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const screenshotPath = path.resolve(__dirname, '../public/ramesh-dashboard.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Saved screenshot of Ramesh dashboard to:', screenshotPath);

  await browser.close();
}

snap().catch(console.error);

