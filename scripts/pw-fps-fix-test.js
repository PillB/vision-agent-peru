/**
 * Quick test: verify FPS > 0 and fire detection works with decoupled HF loop.
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

(async () => {
  for (let i = 0; i < 30; i++) {
    if (await checkServer()) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));

  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 90_000);

  // Switch to fire use case + static camera
  await H.selectUseCase(page, 'fire_smoke');
  await H.selectCamera(page, 'static-fire');
  await H.startAnalysis(page);

  // Check FPS after 5s (should be > 0 now that HF is decoupled)
  await page.waitForTimeout(5000);
  const state5s = await H.readPrototypeState(page);
  console.log('After 5s:');
  console.log(`  FPS: ${state5s.fps}`);
  console.log(`  isRunning: ${state5s.isRunning}`);
  console.log(`  agentCycleCount: ${state5s.agentCycleCount}`);
  console.log(`  actionLogCount: ${state5s.actionLogCount}`);

  // Wait 40s more for HF model to load + detect
  console.log('Waiting 40s for HF fire model...');
  await page.waitForTimeout(40000);

  const state45s = await H.readPrototypeState(page);
  const trace = await H.getTraceText(page);
  console.log('\nAfter 45s:');
  console.log(`  FPS: ${state45s.fps}`);
  console.log(`  agentCycleCount: ${state45s.agentCycleCount}`);
  console.log(`  actionLogCount: ${state45s.actionLogCount}`);
  console.log(`  hitsCount: ${state45s.hitsCount}`);
  console.log(`  reportsCount: ${state45s.reportsCount}`);

  console.log('\n=== TRACE (last 800 chars) ===');
  console.log(trace.slice(-800));

  // Check for fire detection
  const hasFire = /Fire Needed Action.*DETECTED|class=fire/i.test(trace);
  const hasHfModel = /HF Model \[Fire Detection Engine\]/i.test(trace);
  const fpsNonZero = state45s.fps > 0 || state5s.fps > 0;

  console.log('\n=== RESULTS ===');
  console.log(`FPS > 0 (5s): ${state5s.fps > 0 ? '✓' : '✗'} (${state5s.fps})`);
  console.log(`FPS > 0 (45s): ${state45s.fps > 0 ? '✓' : '✗'} (${state45s.fps})`);
  console.log(`Fire detected: ${hasFire ? '✓' : '✗'}`);
  console.log(`HF model loaded: ${hasHfModel ? '✓' : '✗'}`);
  console.log(`Agent cycles: ${state45s.agentCycleCount}`);
  console.log(`Hits: ${state45s.hitsCount}`);

  await H.pauseAnalysis(page);
  await page.screenshot({ path: path.join(H.SHOT_DIR, 'fps-fix-fire.png'), fullPage: false });
  await browser.close();

  if (fpsNonZero && hasFire) {
    console.log('\n✅ FIX VERIFIED — FPS > 0 and fire detected');
  } else {
    console.log('\n⚠️  Partial — FPS:' + (fpsNonZero ? 'OK' : 'FAIL') + ' Fire:' + (hasFire ? 'OK' : 'PENDING'));
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
