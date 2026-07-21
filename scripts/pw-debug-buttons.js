/**
 * Debug: find control buttons.
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
  await page.waitForTimeout(3000);

  // Find ALL buttons
  const allBtns = await page.$$eval('button', els =>
    els
      .filter(e => e.offsetParent !== null)
      .map(e => ({
        text: (e.textContent || '').trim().slice(0, 80),
        disabled: e.disabled,
        ariaDisabled: e.getAttribute('aria-disabled'),
        visible: e.offsetParent !== null,
        rect: e.getBoundingClientRect().top,
      }))
  );
  console.log('=== ALL VISIBLE BUTTONS ===');
  console.log(JSON.stringify(allBtns.filter(b => b.text.length > 0 && b.text.length < 50), null, 2));

  // Try clicking Snapshot specifically
  console.log('\n=== Try click Snapshot ===');
  const snap = page.locator('button').filter({ hasText: 'Snapshot' }).first();
  console.log('Count:', await snap.count());
  if (await snap.count() > 0) {
    console.log('Disabled:', await snap.getAttribute('disabled'));
    console.log('Bounding box:', await snap.boundingBox());
    try {
      await snap.click({ timeout: 5000 });
      console.log('Click succeeded');
    } catch (e) {
      console.log('Click failed:', e.message.split('\n')[0]);
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
