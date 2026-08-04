/**
 * Debug: check HF model console output + trace.
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
  const allLogs = [];
  page.on('console', m => allLogs.push({ type: m.type(), text: m.text().slice(0, 300) }));

  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 90_000);

  await H.selectUseCase(page, 'fire_smoke');
  await H.selectCamera(page, 'static-fire');
  await H.startAnalysis(page);

  console.log('Waiting 45s...');
  await page.waitForTimeout(45000);

  // Get ALL console logs related to HF/Specialized
  const hfLogs = allLogs.filter(l => /Specialized|HF Model|Fire Detection|pipeline|ensemble/i.test(l.text));
  console.log('\n=== HF-RELATED CONSOLE LOGS ===');
  hfLogs.slice(-20).forEach(l => console.log(`  [${l.type}] ${l.text}`));

  // Get trace
  const trace = await H.getTraceText(page);
  console.log('\n=== AGENT TRACE (full, last 2000 chars) ===');
  console.log(trace.slice(-2000));

  // Check state
  const state = await H.readPrototypeState(page);
  console.log('\n=== STATE ===');
  console.log(`  FPS: ${state.fps}`);
  console.log(`  hits: ${state.hitsCount}`);
  console.log(`  actions: ${state.actionLogCount}`);
  console.log(`  agentTraceCount: ${state.agentTraceCount}`);

  await H.pauseAnalysis(page);
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
