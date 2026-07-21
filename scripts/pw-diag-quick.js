/**
 * Quick diagnostic: iterate first 5 use cases with shorter waits and verbose output.
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = await H.attachErrorCollectors(page);

  H.log('Goto');
  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);
  H.log('Click prototype tab');
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  H.log('Wait for model ready');
  const ready = await H.waitForModelReady(page, 60_000);
  if (!ready) { H.log('Model not ready'); process.exit(1); }
  H.log('Start analysis');
  await H.startAnalysis(page);

  const subset = H.USE_CASES.slice(0, 5);
  for (const uc of subset) {
    const t0 = Date.now();
    H.log(`→ selectUseCase ${uc.id}`);
    await H.selectUseCase(page, uc.id);
    H.log(`  selectUseCase took ${Date.now() - t0}ms`);
    const t1 = Date.now();
    await page.waitForTimeout(2000);
    H.log(`  wait took ${Date.now() - t1}ms, total ${Date.now() - t0}ms`);
    H.log(`  page errors so far: ${errors.page.length}, console: ${errors.console.length}`);
  }
  await H.pauseAnalysis(page);
  await browser.close();
  H.log('Done');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
