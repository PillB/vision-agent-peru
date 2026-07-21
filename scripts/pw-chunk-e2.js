/**
 * Chunk E2: Remaining cameras + capability levels + control buttons.
 * (Chunk E timed out after 10 cameras — this picks up where it left off.)
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

    // ───────── Test 6 (remaining cameras) ─────────
    H.log('Test 6 (remaining): uc-flood, uc-foggy-night, uc-demolished, uc-crack');
    await H.selectUseCase(page, 'crowd_surge');
    await H.startAnalysis(page);
    await page.waitForTimeout(2000);

    const remainingCams = ['uc-flood', 'uc-foggy-night', 'uc-demolished', 'uc-crack'];
    for (const cam of remainingCams) {
      const t0 = Date.now();
      const beforePageErrors = errors.page.length;
      try {
        await H.selectCamera(page, cam);
        await page.waitForTimeout(3000);
        await H.pauseAnalysis(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(H.SHOT_DIR, `06-cam-${cam}.png`), fullPage: false });
        await H.startAnalysis(page);
        const newPageErrors = errors.page.slice(beforePageErrors);
        const pass = newPageErrors.length === 0;
        H.recordTest(report, `6.${cam}: camera switch`, pass ? 'pass' : 'fail', {
          note: pass ? `OK (${Date.now() - t0}ms)` : `${newPageErrors.length} errors`,
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
        await page.waitForTimeout(2500);
        await H.pauseAnalysis(page);
        await page.waitForTimeout(200);
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
    await page.waitForTimeout(3000);

    const buttons = ['Snapshot', 'Reset baseline', 'Clear', 'Silence 5m'];
    const ids = ['8a. Snapshot', '8b. Reset baseline', '8c. Clear', '8d. Silence 5m'];
    for (let i = 0; i < buttons.length; i++) {
      const beforeErr = errors.page.length;
      try {
        await H.clickButton(page, buttons[i]);
        await page.waitForTimeout(1200);
        const newErrs = errors.page.slice(beforeErr);
        H.recordTest(report, ids[i], newErrs.length === 0 ? 'pass' : 'fail', {
          note: newErrs.length === 0 ? 'OK' : `${newErrs.length} errors`,
        });
      } catch (e) {
        H.recordTest(report, ids[i], 'fail', { note: e.message });
      }
    }
    await H.pauseAnalysis(page);
  } catch (e) {
    H.recordTest(report, 'Chunk E2 (driver)', 'fail', { note: e.message });
  }
  await ctx.close();
  H.saveReport(report);
  await browser.close();
  H.log('Chunk E2 done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
