/**
 * Chunk E: Tests 6, 7, 8 — camera iteration, capability levels, control buttons.
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
    await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1500);
    await H.clickTab(page, 'prototype');
    await page.waitForTimeout(3000);
    const ready = await H.waitForModelReady(page, 60_000);
    if (!ready) throw new Error('Model not ready');

    // ───────── Test 6: Camera iteration ─────────
    H.log('Test 6: Iterate all 14 cameras');
    await H.selectUseCase(page, 'crowd_surge');
    await H.startAnalysis(page);
    await page.waitForTimeout(2000);

    for (const cam of H.CAMERAS) {
      const t0 = Date.now();
      const beforePageErrors = errors.page.length;
      const beforeConsoleErrors = errors.console.length;
      try {
        await H.selectCamera(page, cam);
        await page.waitForTimeout(3000);
        await H.pauseAnalysis(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(H.SHOT_DIR, `06-cam-${cam}.png`), fullPage: false });
        await H.startAnalysis(page);
        const newPageErrors = errors.page.slice(beforePageErrors);
        const newConsoleErrors = errors.console.slice(beforeConsoleErrors);
        const pass = newPageErrors.length === 0 && newConsoleErrors.length === 0;
        H.recordTest(report, `6.${cam}: camera switch`, pass ? 'pass' : 'fail', {
          note: pass ? `OK (${Date.now() - t0}ms)` : `${newPageErrors.length}+${newConsoleErrors.length} errors`,
          pageErrors: newPageErrors.slice(0, 3),
        });
      } catch (e) {
        H.recordTest(report, `6.${cam}: camera switch`, 'fail', { note: e.message });
      }
    }
    await H.pauseAnalysis(page);

    // ───────── Test 7: Capability levels ─────────
    H.log('Test 7: Capability level switching');
    await H.selectUseCase(page, 'crowd_surge');
    await H.startAnalysis(page);
    await page.waitForTimeout(2000);

    for (const level of H.CAPABILITY_LEVELS) {
      const beforePageErrors = errors.page.length;
      try {
        await H.setCapabilityLevel(page, level);
        await page.waitForTimeout(3000);
        await H.pauseAnalysis(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(H.SHOT_DIR, `07-cap-${level.replace(/\W+/g, '-')}.png`), fullPage: false });
        await H.startAnalysis(page);
        const newPageErrors = errors.page.slice(beforePageErrors);
        const pass = newPageErrors.length === 0;
        H.recordTest(report, `7.${level}`, pass ? 'pass' : 'fail', {
          note: pass ? 'OK' : `${newPageErrors.length} errors`,
          pageErrors: newPageErrors.slice(0, 3),
        });
      } catch (e) {
        H.recordTest(report, `7.${level}`, 'fail', { note: e.message });
      }
    }
    await H.pauseAnalysis(page);

    // ───────── Test 8: Control buttons ─────────
    H.log('Test 8: Control buttons');
    await H.selectUseCase(page, 'crowd_surge');
    await H.startAnalysis(page);
    await page.waitForTimeout(4000);

    // Snapshot
    const beforeErr1 = errors.page.length;
    try {
      await H.clickButton(page, 'Snapshot');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '08-snapshot.png'), fullPage: false });
      H.recordTest(report, '8a. Snapshot button', 'pass', { note: 'OK' });
    } catch (e) {
      H.recordTest(report, '8a. Snapshot button', 'fail', { note: e.message });
    }

    // Reset baseline
    try {
      await H.clickButton(page, 'Reset baseline');
      await page.waitForTimeout(1500);
      H.recordTest(report, '8b. Reset baseline button', 'pass', { note: 'OK' });
    } catch (e) {
      H.recordTest(report, '8b. Reset baseline button', 'fail', { note: e.message });
    }

    // Clear
    try {
      await H.clickButton(page, 'Clear');
      await page.waitForTimeout(1500);
      H.recordTest(report, '8c. Clear button', 'pass', { note: 'OK' });
    } catch (e) {
      H.recordTest(report, '8c. Clear button', 'fail', { note: e.message });
    }

    // Silence 5m
    try {
      await H.clickButton(page, 'Silence 5m');
      await page.waitForTimeout(1500);
      H.recordTest(report, '8d. Silence 5m button', 'pass', { note: 'OK' });
    } catch (e) {
      H.recordTest(report, '8d. Silence 5m button', 'fail', { note: e.message });
    }
    await H.pauseAnalysis(page);
  } catch (e) {
    H.recordTest(report, 'Chunk E (driver)', 'fail', { note: e.message });
  }
  await ctx.close();
  H.saveReport(report);
  await browser.close();
  H.log('Chunk E done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
