/**
 * Chunk B: Test 5 — iterate all 15 use cases (fast mode).
 * Pauses analysis during screenshot capture to avoid the canvas redraw
 * interfering with Playwright's screenshot logic.
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
    H.log('Test 5: Iterate all 15 use cases');
    await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1500);
    await H.clickTab(page, 'prototype');
    await page.waitForTimeout(3000);
    const ready = await H.waitForModelReady(page, 60_000);
    if (!ready) throw new Error('Model not ready');

    // Start analysis once at the beginning
    await H.startAnalysis(page);
    await page.waitForTimeout(2000);

    // Split: skip fire_smoke + graffiti here (they load HuggingFace models
    // and are tested separately in pw-chunk-c.js with longer timeouts).
    const SKIP = ['fire_smoke', 'graffiti'];
    const subset = H.USE_CASES.filter(uc => !SKIP.includes(uc.id));

    for (const uc of subset) {
      const t0 = Date.now();
      const beforePageErrors = errors.page.length;
      const beforeConsoleErrors = errors.console.length;
      try {
        H.log(`  → ${uc.id}`);
        await H.selectUseCase(page, uc.id);
        // Wait 3s for detect cycles + agent decisions
        await page.waitForTimeout(3000);
        // Brief pause for a stable screenshot
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
    H.recordTest(report, '5. Iterate use cases (driver)', 'fail', { note: e.message });
  }
  await ctx.close();

  H.saveReport(report);
  await browser.close();
  H.log(`Chunk B done. ${report.tests.length} tests recorded total.`);
})().catch(e => {
  console.error('FATAL:', e);
  // Still try to save what we have
  try {
    const r = H.loadReport();
    H.recordTest(r, '5. Iterate use cases (FATAL)', 'fail', { note: e.message });
    H.saveReport(r);
  } catch (_) {}
  process.exit(1);
});
