/**
 * Chunk A: Tests 1-4 (Home, Brief, Prototype load, Start analysis).
 * Expected runtime: ~60s
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const report = H.loadReport();
  const browser = await H.makeBrowser();

  // ───────── Test 1: Home page ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 1: Home page loads');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(2000);
      const title = await page.title();
      const h1 = await page.locator('h1').first().textContent();
      await page.screenshot({ path: path.join(H.SHOT_DIR, '01-home.png'), fullPage: false });
      const pass = !!title && !!h1 && errors.page.length === 0;
      H.recordTest(report, '1. Home page loads with no console errors', pass ? 'pass' : 'fail', {
        note: `title="${title}", page errors=${errors.page.length}, console errors=${errors.console.length}`,
        pageErrors: errors.page.slice(0, 3),
        consoleErrors: errors.console.slice(0, 3),
      });
    } catch (e) {
      H.recordTest(report, '1. Home page loads with no console errors', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 2: Strategic Brief ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 2: Strategic Brief tab');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'brief');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '02-brief.png'), fullPage: false });
      const h2s = await page.$$eval('h2', els => els.map(e => (e.textContent || '').trim().slice(0, 80)).filter(Boolean));
      const pass = h2s.length > 0 && errors.page.length === 0;
      H.recordTest(report, '2. Strategic Brief tab renders content', pass ? 'pass' : 'fail', {
        note: `H2 count=${h2s.length}, page errors=${errors.page.length}`,
        h2s: h2s.slice(0, 8),
      });
    } catch (e) {
      H.recordTest(report, '2. Strategic Brief tab renders content', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 3: Prototype tab + COCO-SSD load ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 3: Prototype tab + COCO-SSD model load');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 90_000);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '03-prototype-loaded.png'), fullPage: false });
      const state = await H.readPrototypeState(page);
      H.recordTest(report, '3. Prototype tab + COCO-SSD model load', ready ? 'pass' : 'fail', {
        note: ready ? 'COCO-SSD ready' : 'Model not ready after 90s',
        state, pageErrors: errors.page.slice(0, 3),
      });
    } catch (e) {
      H.recordTest(report, '3. Prototype tab + COCO-SSD model load', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 4: Start analysis + detection ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 4: Start analysis + first detection cycle');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');
      await H.startAnalysis(page);
      await page.waitForTimeout(10_000);
      const state = await H.readPrototypeState(page);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '04-running-default.png'), fullPage: false });
      const pass = errors.page.length === 0 && state.videoPaused === false;
      H.recordTest(report, '4. Start analysis + detection cycle', pass ? 'pass' : 'fail', {
        note: `video paused=${state.videoPaused}, page errors=${errors.page.length}`,
        state, pageErrors: errors.page.slice(0, 3),
      });
      await H.pauseAnalysis(page);
    } catch (e) {
      H.recordTest(report, '4. Start analysis + detection cycle', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  H.saveReport(report);
  await browser.close();
  H.log(`Chunk A done. ${report.tests.length} tests recorded.`);
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
