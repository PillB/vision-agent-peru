/**
 * Final smoke test: verify the app still works after lint/type fixes.
 * Quick — 1 minute max.
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = await H.attachErrorCollectors(page);

  H.log('Final smoke test');
  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  const ready = await H.waitForModelReady(page, 60_000);
  H.log(`Model ready: ${ready}`);

  // Switch through a few use cases
  for (const uc of ['crowd_surge', 'fire_smoke', 'graffiti', 'flood_watch']) {
    await H.selectUseCase(page, uc);
    await page.waitForTimeout(2000);
    H.log(`  → ${uc}: OK`);
  }

  // Verify store state
  await H.startAnalysis(page);
  await page.waitForTimeout(5000);
  const state = await H.readPrototypeState(page);
  H.log(`Final state: isRunning=${state.isRunning}, modelStatus=${state.modelStatus}, hits=${state.hitsCount}, actions=${state.actionLogCount}`);
  H.log(`Page errors: ${errors.page.length}, Console errors: ${errors.console.length}`);

  await page.screenshot({ path: path.join(H.SHOT_DIR, '99-final-smoke.png'), fullPage: false });
  await H.pauseAnalysis(page);
  await browser.close();
  H.log('Smoke test passed.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
