/**
 * Debug: try multiple strategies to click the Snapshot button.
 */
const { chromium } = require('playwright');
const H = require('./pw-helpers.js');

(async () => {
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 60_000);
  await H.selectUseCase(page, 'crowd_surge');
  await H.startAnalysis(page);
  await page.waitForTimeout(4000);

  // Strategy 1: getByRole
  console.log('Strategy 1: getByRole(button, name=Snapshot)');
  try {
    const btn = page.getByRole('button', { name: 'Snapshot' });
    console.log('  count:', await btn.count());
    if (await btn.count() > 0) {
      await btn.click({ timeout: 3000 });
      console.log('  ✓ clicked');
    }
  } catch (e) {
    console.log('  ✗ failed:', e.message.split('\n')[0]);
  }

  // Strategy 2: text locator
  console.log('Strategy 2: locator with hasText');
  try {
    const btn = page.locator('button').filter({ hasText: 'Snapshot' }).first();
    console.log('  count:', await btn.count());
    if (await btn.count() > 0) {
      const isEnabled = await btn.isEnabled();
      console.log('  enabled:', isEnabled);
      await btn.click({ force: true, timeout: 3000 });
      console.log('  ✓ clicked');
    }
  } catch (e) {
    console.log('  ✗ failed:', e.message.split('\n')[0]);
  }

  // Strategy 3: dispatchEvent
  console.log('Strategy 3: dispatchEvent');
  try {
    const result = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const snap = btns.find(b => (b.textContent || '').trim() === 'Snapshot');
      if (!snap) return { ok: false, reason: 'not found' };
      snap.click();
      return { ok: true, disabled: snap.disabled };
    });
    console.log('  result:', result);
  } catch (e) {
    console.log('  ✗ failed:', e.message);
  }

  // Strategy 4: check if the button is in the DOM at all
  console.log('Strategy 4: DOM check');
  const domCheck = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.filter(b => /Snapshot|Reset baseline|Clear|Silence/.test(b.textContent || ''))
      .map(b => ({
        text: (b.textContent || '').trim(),
        disabled: b.disabled,
        visible: b.offsetParent !== null,
        rect: b.getBoundingClientRect().top,
      }));
  });
  console.log('  buttons:', JSON.stringify(domCheck, null, 2));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
