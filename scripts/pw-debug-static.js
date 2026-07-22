/**
 * Debug: check if detect loop runs on static image camera.
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
  await page.waitForTimeout(20000);

  // Check what's happening
  const state = await page.evaluate(() => {
    const s = window.__visionStore?.getState();
    return {
      activeCameraId: s?.activeCameraId,
      isRunning: s?.isRunning,
      agentCycleCount: s?.agentCycleCount,
      agentTraceCount: s?.agentTrace?.length,
      // Check if the img element exists and is loaded
      imgExists: !!document.querySelector('img'),
      imgComplete: document.querySelector('img')?.complete,
      imgNaturalWidth: document.querySelector('img')?.naturalWidth,
      imgSrc: document.querySelector('img')?.src,
      // Check video element
      videoExists: !!document.querySelector('video'),
      videoSrc: document.querySelector('video')?.src,
      // Check canvas
      canvasW: document.querySelector('canvas')?.width,
      canvasH: document.querySelector('canvas')?.height,
    };
  });
  console.log('=== STATE ===');
  console.log(JSON.stringify(state, null, 2));

  // Print all RealMlLoader logs
  console.log('\n=== RealMlLoader LOGS (last 20) ===');
  allLogs.filter(l => /RealMlLoader|SpecializedModels|HF Model/i.test(l.text)).slice(-20).forEach(l => console.log(`  [${l.type}] ${l.text}`));

  await H.pauseAnalysis(page);
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
