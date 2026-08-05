/**
 * R3/R4 COMPREHENSIVE PLAYWRIGHT VALIDATION
 * Tests: model selector, temporal lifecycle, dedup, FPS, all use cases
 */
const path = require('path');
const http = require('http');
const H = require('./pw-helpers.js');

function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/', method: 'HEAD', timeout: 3000 }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const results = [];

(async () => {
  for (let i = 0; i < 30; i++) { if (await checkServer()) break; await new Promise(r => setTimeout(r, 2000)); }
  if (!await checkServer()) { console.log('Server down'); process.exit(1); }

  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  log('Setting up...');
  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 90_000);

  // ─── TEST 1: Model selector visible ───
  log('TEST 1: Model selector visible');
  const hasModelSelector = await page.evaluate(() => document.body.textContent?.includes('Model selection') || false);
  results.push({ test: 'Model selector visible', pass: hasModelSelector });
  log(`  ${hasModelSelector ? 'PASS' : 'FAIL'}`);

  // ─── TEST 2: Model selector has multiple options for fire_smoke ───
  log('TEST 2: Model selector options for fire_smoke');
  await H.selectUseCase(page, 'fire_smoke');
  await page.waitForTimeout(1000);
  // Check if model selector shows multiple options
  const modelCount = await page.evaluate(() => {
    const text = document.body.textContent || '';
    // Look for model names in the selector
    const models = ['COCO-SSD', 'YOLOv10', 'YOLOS', 'Fire Detection', 'CLIP', 'Pixel Anomaly', 'SegFormer', 'Pose'];
    return models.filter(m => text.includes(m)).length;
  });
  results.push({ test: 'Multiple model options available', pass: modelCount >= 2, detail: `${modelCount} models found` });
  log(`  ${modelCount >= 2 ? 'PASS' : 'FAIL'} (${modelCount} models)`);

  // ─── TEST 3: Fire detection triggers with temporal lifecycle ───
  log('TEST 3: Fire detection + temporal lifecycle');
  await H.selectCamera(page, 'static-fire');
  await H.startAnalysis(page);
  await page.waitForTimeout(12000);

  const state3 = await H.readPrototypeState(page);
  const trace3 = await H.getTraceText(page);
  const hasFire = /fire.*DETECTED|Fire Needed Action/i.test(trace3);
  const hasLifecycle = /CONFIRMED|ACTIVE|CANDIDATE/i.test(trace3) || 
    await page.evaluate(() => document.body.textContent?.includes('CONFIRMED') || false);
  results.push({ test: 'Fire detection works', pass: hasFire, detail: `fps=${state3.fps}, hits=${state3.hitsCount}` });
  results.push({ test: 'Temporal lifecycle visible', pass: hasLifecycle, detail: `lifecycle in trace/alerts` });
  log(`  Fire: ${hasFire ? 'PASS' : 'PENDING'} (fps=${state3.fps}, hits=${state3.hitsCount})`);
  log(`  Lifecycle: ${hasLifecycle ? 'PASS' : 'PENDING'}`);

  // ─── TEST 4: Duplicate suppression ───
  log('TEST 4: Duplicate suppression');
  const hitsBefore = state3.hitsCount;
  await page.waitForTimeout(10000);
  const state4 = await H.readPrototypeState(page);
  const hitGrowth = state4.hitsCount - hitsBefore;
  const dedupWorks = hitGrowth <= 3;
  results.push({ test: 'Duplicate suppression', pass: dedupWorks, detail: `grew by ${hitGrowth} in 10s` });
  log(`  ${dedupWorks ? 'PASS' : 'FAIL'} (grew by ${hitGrowth})`);

  // ─── TEST 5: FPS non-zero ───
  log('TEST 5: FPS non-zero');
  const fpsOk = state3.fps > 0 || state4.fps > 0;
  results.push({ test: 'FPS > 0', pass: fpsOk, detail: `fps=${state3.fps}/${state4.fps}` });
  log(`  ${fpsOk ? 'PASS' : 'FAIL'} (fps=${state3.fps}/${state4.fps})`);

  // ─── TEST 6: Use case switching doesn't crash ───
  log('TEST 6: Use case switching');
  await H.pauseAnalysis(page);
  let switchOk = true;
  const testCases = ['crowd_surge', 'parking', 'intrusion', 'graffiti'];
  for (const uc of testCases) {
    try {
      await H.selectUseCase(page, uc);
      await page.waitForTimeout(2000);
      const activeUc = await page.evaluate(() => window.__visionStore?.getState()?.activeUseCaseId);
      if (activeUc !== uc) switchOk = false;
    } catch (e) { switchOk = false; }
  }
  results.push({ test: 'Use case switching', pass: switchOk });
  log(`  ${switchOk ? 'PASS' : 'FAIL'}`);

  // ─── TEST 7: Camera switching doesn't crash ───
  log('TEST 7: Camera switching');
  let camOk = true;
  const testCams = ['intersection', 'crosswalk', 'static-fire'];
  for (const cam of testCams) {
    try {
      await H.selectCamera(page, cam);
      await page.waitForTimeout(2000);
      const activeCam = await page.evaluate(() => window.__visionStore?.getState()?.activeCameraId);
      if (activeCam !== cam) camOk = false;
    } catch (e) { camOk = false; }
  }
  results.push({ test: 'Camera switching', pass: camOk });
  log(`  ${camOk ? 'PASS' : 'FAIL'}`);

  // ─── TEST 8: No console errors ───
  log('TEST 8: No critical console errors');
  const criticalErrors = errors.filter(e => !e.includes('ResizeObserver') && !e.includes('webkit-mask'));
  results.push({ test: 'No critical console errors', pass: criticalErrors.length === 0, detail: `${criticalErrors.length} errors` });
  log(`  ${criticalErrors.length === 0 ? 'PASS' : 'FAIL'} (${criticalErrors.length} errors)`);

  // ─── TEST 9: Store has selectedModelIds ───
  log('TEST 9: Store has selectedModelIds');
  const hasModelIds = await page.evaluate(() => {
    const s = window.__visionStore?.getState();
    return Array.isArray(s?.selectedModelIds);
  });
  results.push({ test: 'Store selectedModelIds exists', pass: hasModelIds });
  log(`  ${hasModelIds ? 'PASS' : 'FAIL'}`);

  // ─── TEST 10: Alerts panel has folding ───
  log('TEST 10: Alerts panel folding');
  const hasFolding = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('Tier 2') && text.includes('Anomaly');
  });
  results.push({ test: 'Alerts panel tier folding', pass: hasFolding });
  log(`  ${hasFolding ? 'PASS' : 'FAIL'}`);

  // Screenshot
  try {
    await H.selectUseCase(page, 'fire_smoke');
    await H.selectCamera(page, 'static-fire');
    await H.startAnalysis(page);
    await page.waitForTimeout(8000);
    await page.screenshot({ path: '/tmp/r3r4-final-validation.png', fullPage: false });
    log('Screenshot saved');
  } catch (e) { log('Screenshot failed (non-critical)'); }

  // ─── SUMMARY ───
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  log(`\n════════════════════════════════════════════════════`);
  log(`  R3/R4 VALIDATION SUMMARY`);
  log(`════════════════════════════════════════════════════`);
  log(`  PASS: ${passed} | FAIL: ${failed} | TOTAL: ${results.length}`);
  log(`════════════════════════════════════════════════════`);
  for (const r of results) {
    log(`  ${r.pass ? '✓' : '✗'} ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
  }
  log(`════════════════════════════════════════════════════`);

  await H.pauseAnalysis(page);
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
