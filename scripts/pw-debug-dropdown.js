/**
 * Debug script: verify dropdown selectors work for use case + camera.
 */
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);

  // Click prototype tab
  await page.click('button[id$="trigger-prototype"]');
  await page.waitForTimeout(3000);

  // Wait for model ready
  for (let i = 0; i < 30; i++) {
    const txt = await page.evaluate(() => document.body.textContent || '');
    if (/COCO-SSD ready/i.test(txt)) {
      console.log(`Model ready after ${i}s`);
      break;
    }
    await page.waitForTimeout(1000);
  }

  // Inspect the comboboxes
  const combos = await page.$$eval('[role="combobox"]', els =>
    els.filter(e => e.offsetParent !== null).map(e => ({
      text: (e.textContent || '').trim().slice(0, 100),
      ariaLabel: e.getAttribute('aria-label'),
      id: e.id,
    }))
  );
  console.log('Comboboxes:', JSON.stringify(combos, null, 2));

  // Click the FIRST combobox (use case)
  console.log('\n→ Click use case combobox');
  await page.locator('[role="combobox"]').first().click();
  await page.waitForTimeout(1000);

  // List the options
  const options = await page.$$eval('[role="option"]', els =>
    els.filter(e => e.offsetParent !== null).map(e => ({
      text: (e.textContent || '').trim().slice(0, 80),
      dataValue: e.getAttribute('data-value'),
    }))
  );
  console.log(`Options visible: ${options.length}`);
  console.log(JSON.stringify(options.slice(0, 5), null, 2));
  console.log('...');
  console.log(JSON.stringify(options.slice(-5), null, 2));

  // Try selecting fire_smoke
  console.log('\n→ Try selecting fire_smoke option');
  const fireOpt = page.locator('[role="option"]').filter({ hasText: 'Fuego y Humo' });
  if (await fireOpt.count() > 0) {
    await fireOpt.first().click();
    await page.waitForTimeout(1500);
    console.log('✓ Clicked fire_smoke');
  } else {
    console.log('✗ fire_smoke option not found');
  }

  // Verify the combobox now shows fire_smoke
  const afterSelect = await page.locator('[role="combobox"]').first().textContent();
  console.log(`Use case combobox now shows: "${afterSelect?.trim().slice(0, 100)}"`);

  // Check what camera was auto-selected
  const camCombo = await page.locator('[role="combobox"]').nth(1).textContent();
  console.log(`Camera combobox now shows: "${camCombo?.trim().slice(0, 100)}"`);

  // Close any open dropdown
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/home/z/my-project/scripts/pw-debug-dropdown.png', fullPage: false });
  console.log('Screenshot saved');

  await browser.close();
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
