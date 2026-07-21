/**
 * Chunk G: Final tests — HF graffiti + pixel flood + LLM judge + stability + locale.
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const report = H.loadReport();
  const browser = await H.makeBrowser();

  // ───────── Test 10: HF violence detection (graffiti) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 10: HF violence detection (graffiti)');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 60_000);
      if (!ready) throw new Error('COCO-SSD not ready');

      await H.selectUseCase(page, 'graffiti');
      await H.startAnalysis(page);
      H.log('Waiting 45s for HF violence model to load...');
      await page.waitForTimeout(45_000);
      await H.pauseAnalysis(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '10-hf-graffiti.png'), fullPage: false });

      const state = await H.readPrototypeState(page);
      const traceText = await H.getTraceText(page);
      const hfMentioned = /HF Model|Violence Detection|onnx-community/i.test(traceText);
      H.recordTest(report, '10. HuggingFace violence detection model loads', hfMentioned ? 'pass' : 'fail', {
        note: hfMentioned ? 'HF model trace visible' : 'No HF trace',
        traceSnippet: traceText.slice(-500),
        state,
      });
    } catch (e) {
      H.recordTest(report, '10. HuggingFace violence detection model loads', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 11: Pixel anomaly fallback (flood) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 11: Pixel anomaly (flood)');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 60_000);
      if (!ready) throw new Error('Model not ready');

      await H.selectUseCase(page, 'flood_watch');
      await H.startAnalysis(page);
      await page.waitForTimeout(15_000);
      await H.pauseAnalysis(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '11-pixel-flood.png'), fullPage: false });
      const traceText = await H.getTraceText(page);
      const pxMentioned = /Pixel anomaly/i.test(traceText);
      H.recordTest(report, '11. Pixel anomaly fallback (flood)', pxMentioned ? 'pass' : 'fail', {
        note: pxMentioned ? 'Pixel anomaly trace visible' : 'No pixel anomaly trace',
        traceSnippet: traceText.slice(-500),
      });
    } catch (e) {
      H.recordTest(report, '11. Pixel anomaly fallback (flood)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 12: LLM Judge toggle ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 12: LLM Judge toggle');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 60_000);
      if (!ready) throw new Error('Model not ready');

      await H.selectUseCase(page, 'crowd_surge');
      await H.setCapabilityLevel(page, 'Cognitiva / GenAI');
      await H.startAnalysis(page);
      await page.waitForTimeout(3000);

      const toggledOff = await H.toggleLLMJudge(page, 'off');
      await page.waitForTimeout(1500);
      H.recordTest(report, '12a. Toggle LLM judge OFF', toggledOff ? 'pass' : 'fail', {
        note: toggledOff ? 'OK' : 'Switch not found',
      });

      const toggledOn = await H.toggleLLMJudge(page, 'on');
      await page.waitForTimeout(1500);
      H.recordTest(report, '12b. Toggle LLM judge ON', toggledOn ? 'pass' : 'fail', {
        note: toggledOn ? 'OK' : 'Switch not found',
      });

      await page.screenshot({ path: path.join(H.SHOT_DIR, '12-judge-toggle.png'), fullPage: false });
      await H.pauseAnalysis(page);
    } catch (e) {
      H.recordTest(report, '12. LLM Judge toggle (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 13: Locale switch ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 13: Locale switch');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      const langBtn = page.locator('button', { hasText: /Español|English/i }).first();
      if (await langBtn.count() > 0) {
        await langBtn.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(1000);
        const enOpt = page.locator('[role="menuitem"], [role="option"], button', { hasText: /^English$/ }).first();
        if (await enOpt.count() > 0) {
          await enOpt.click({ force: true, timeout: 5000 });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(H.SHOT_DIR, '13-locale-en.png'), fullPage: false });
          H.recordTest(report, '13. Locale switch to English', 'pass', { note: 'OK' });
        } else {
          H.recordTest(report, '13. Locale switch to English', 'fail', { note: 'English option not found' });
        }
      } else {
        H.recordTest(report, '13. Locale switch to English', 'fail', { note: 'Language button not found' });
      }
    } catch (e) {
      H.recordTest(report, '13. Locale switch to English', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  H.saveReport(report);
  await browser.close();
  H.log('Chunk G done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
