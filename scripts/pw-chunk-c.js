/**
 * Chunk C: Tests for disaster use cases (flood, landslide, post-quake).
 * These use pixel-anomaly fallback detection (no HF model).
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const report = H.loadReport();
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = await H.attachErrorCollectors(page);

  try {
    H.log('Test 5 (disaster subset): flood, landslide, post_quake');
    await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1500);
    await H.clickTab(page, 'prototype');
    await page.waitForTimeout(3000);
    const ready = await H.waitForModelReady(page, 60_000);
    if (!ready) throw new Error('Model not ready');

    await H.startAnalysis(page);
    await page.waitForTimeout(2000);

    const subset = ['flood_watch', 'landslide_watch', 'post_quake'];
    for (const ucId of subset) {
      const uc = H.USE_CASES.find(u => u.id === ucId);
      const t0 = Date.now();
      const beforePageErrors = errors.page.length;
      const beforeConsoleErrors = errors.console.length;
      try {
        H.log(`  → ${uc.id}`);
        await H.selectUseCase(page, uc.id);
        await page.waitForTimeout(4000); // allow 2-3 detect cycles for pixel anomaly to run
        await H.pauseAnalysis(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(H.SHOT_DIR, `05-uc-${uc.id}.png`), fullPage: false });
        await H.startAnalysis(page);
        const newPageErrors = errors.page.slice(beforePageErrors);
        const newConsoleErrors = errors.console.slice(beforeConsoleErrors);
        const pass = newPageErrors.length === 0 && newConsoleErrors.length === 0;
        H.recordTest(report, `5.${uc.id}: ${uc.name}`, pass ? 'pass' : 'fail', {
          note: pass ? `OK (${Date.now() - t0}ms)` : `${newPageErrors.length} page + ${newConsoleErrors.length} console (${Date.now() - t0}ms)`,
          pageErrors: newPageErrors.slice(0, 3),
          consoleErrors: newConsoleErrors.slice(0, 3),
        });
      } catch (e) {
        H.recordTest(report, `5.${uc.id}: ${uc.name}`, 'fail', { note: e.message });
      }
    }
    await H.pauseAnalysis(page);
  } catch (e) {
    H.recordTest(report, '5. Disaster use cases (driver)', 'fail', { note: e.message });
  }
  await ctx.close();
  H.saveReport(report);
  await browser.close();
  H.log('Chunk C done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
