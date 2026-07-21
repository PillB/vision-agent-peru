/**
 * Chunk F: Control buttons (fresh page) + HF model tests (post-fix).
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const report = H.loadReport();
  const browser = await H.makeBrowser();

  // ───────── Test 8: Control buttons (fresh page) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 8: Control buttons (fresh page)');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 60_000);
      if (!ready) throw new Error('Model not ready');

      await H.selectUseCase(page, 'crowd_surge');
      await H.startAnalysis(page);
      await page.waitForTimeout(4000);

      const tests = [
        { name: '8a. Snapshot button', text: 'Snapshot' },
        { name: '8b. Reset baseline button', text: 'Reset baseline' },
        { name: '8c. Clear button (controls)', text: 'Clear' },
        { name: '8d. Silence 5m button', text: 'Silence 5m' },
      ];
      for (const t of tests) {
        const beforeErr = errors.page.length;
        try {
          await H.clickButton(page, t.text);
          await page.waitForTimeout(1200);
          const newErrs = errors.page.slice(beforeErr);
          H.recordTest(report, t.name, newErrs.length === 0 ? 'pass' : 'fail', {
            note: newErrs.length === 0 ? 'OK' : `${newErrs.length} errors: ${newErrs[0]?.slice(0, 80)}`,
          });
        } catch (e) {
          H.recordTest(report, t.name, 'fail', { note: e.message.split('\n')[0].slice(0, 100) });
        }
      }
      await H.pauseAnalysis(page);
    } catch (e) {
      H.recordTest(report, '8. Control buttons (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 9: HF fire detection (post-fix) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 9: HuggingFace fire detection model (post-fix)');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 60_000);
      if (!ready) throw new Error('COCO-SSD not ready');

      await H.selectUseCase(page, 'fire_smoke');
      await H.startAnalysis(page);
      H.log('Waiting 45s for HF fire model to load + run inference...');
      await page.waitForTimeout(45_000);
      await H.pauseAnalysis(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(H.SHOT_DIR, '09-hf-fire.png'), fullPage: false });

      const state = await H.readPrototypeState(page);
      const traceText = await H.getTraceText(page);
      const hfMentioned = /HF Model|Fire Detection Engine|prithivMLmods/i.test(traceText);
      const hfLoaded = !/load_failed/i.test(traceText) && hfMentioned;
      H.recordTest(report, '9. HuggingFace fire detection model loads', hfLoaded ? 'pass' : 'fail', {
        note: hfLoaded ? 'HF model trace visible' : `HF trace: ${hfMentioned}, state: ${state.activeUseCaseId}/${state.activeCameraId}`,
        traceSnippet: traceText.slice(-500),
        state,
      });
    } catch (e) {
      H.recordTest(report, '9. HuggingFace fire detection model loads', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 10: HF violence detection (graffiti, post-fix) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 10: HuggingFace violence detection model (graffiti, post-fix)');
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
      const hfLoaded = !/load_failed/i.test(traceText) && hfMentioned;
      H.recordTest(report, '10. HuggingFace violence detection model loads', hfLoaded ? 'pass' : 'fail', {
        note: hfLoaded ? 'HF model trace visible' : `HF trace: ${hfMentioned}`,
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
      H.log('Test 11: Pixel anomaly fallback (flood)');
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

      const beforeOff = errors.page.length;
      const toggledOff = await H.toggleLLMJudge(page, 'off');
      await page.waitForTimeout(2000);
      H.recordTest(report, '12a. Toggle LLM judge OFF', toggledOff ? 'pass' : 'fail', {
        note: toggledOff ? 'OK' : 'Switch not found',
      });

      const beforeOn = errors.page.length;
      const toggledOn = await H.toggleLLMJudge(page, 'on');
      await page.waitForTimeout(2000);
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

  H.saveReport(report);
  await browser.close();
  H.log('Chunk F done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
