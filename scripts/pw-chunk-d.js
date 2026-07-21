/**
 * Chunk D: HuggingFace model tests — fire_smoke + graffiti.
 * These load HF ONNX models on first detection cycle (10-30s each).
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
    H.log('Test 9: HuggingFace fire detection model');
    await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1500);
    await H.clickTab(page, 'prototype');
    await page.waitForTimeout(3000);
    const ready = await H.waitForModelReady(page, 60_000);
    if (!ready) throw new Error('COCO-SSD not ready');

    await H.selectUseCase(page, 'fire_smoke');
    await H.startAnalysis(page);
    H.log('Waiting 35s for HF fire model to load + run inference...');
    await page.waitForTimeout(35_000);
    await H.pauseAnalysis(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(H.SHOT_DIR, '09-hf-fire.png'), fullPage: false });
    const traceText1 = await H.getTraceText(page);
    const hfMentioned1 = /HF Model|Fire Detection|prithivMLmods/i.test(traceText1);
    H.recordTest(report, '9. HuggingFace fire detection model loads', hfMentioned1 ? 'pass' : 'fail', {
      note: hfMentioned1 ? 'HF model trace visible' : 'No HF trace found after 35s',
      traceSnippet: traceText1.slice(-300),
    });

    // Now graffiti — violence detection model
    H.log('Test 10: HuggingFace violence detection model (graffiti)');
    await H.selectUseCase(page, 'graffiti');
    await H.startAnalysis(page);
    H.log('Waiting 35s for HF violence model to load...');
    await page.waitForTimeout(35_000);
    await H.pauseAnalysis(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(H.SHOT_DIR, '10-hf-graffiti.png'), fullPage: false });
    const traceText2 = await H.getTraceText(page);
    const hfMentioned2 = /HF Model|Violence Detection|onnx-community/i.test(traceText2);
    H.recordTest(report, '10. HuggingFace violence detection model loads', hfMentioned2 ? 'pass' : 'fail', {
      note: hfMentioned2 ? 'HF model trace visible' : 'No HF trace found after 35s',
      traceSnippet: traceText2.slice(-300),
    });
  } catch (e) {
    H.recordTest(report, 'Chunk D (HF models)', 'fail', { note: e.message });
  }
  await ctx.close();
  H.saveReport(report);
  await browser.close();
  H.log('Chunk D done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
