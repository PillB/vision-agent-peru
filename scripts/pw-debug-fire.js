/**
 * Debug: capture the canvas as base64 + check what the fire model sees.
 */
const path = require('path');
const H = require('./pw-helpers.js');
const fs = require('fs');

(async () => {
  // Wait for server
  for (let i = 0; i < 30; i++) {
    const ok = await new Promise(resolve => {
      const http = require('http');
      const req = http.request({ hostname: 'localhost', port: 3000, path: '/', method: 'HEAD', timeout: 3000 }, (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
    if (ok) break;
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
  await page.waitForTimeout(45000); // wait for HF model to load + run inference (CLIP/fire takes ~30s on WASM)

  // Capture canvas content as base64
  const canvasData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const video = document.querySelector('video');
    return {
      canvasW: canvas?.width,
      canvasH: canvas?.height,
      hasCanvas: !!canvas,
      videoW: video?.videoWidth,
      videoH: video?.videoHeight,
      videoCurrentTime: video?.currentTime,
      videoPaused: video?.paused,
      videoSrc: video?.currentSrc,
      videoReadyState: video?.readyState,
      // Sample center pixel of canvas
      centerPixel: canvas ? (() => {
        try {
          const ctx = canvas.getContext('2d');
          const data = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
          return { r: data[0], g: data[1], b: data[2] };
        } catch (e) { return { err: String(e) }; }
      })() : null,
      // Save full canvas as data URL
      dataUrl: canvas?.toDataURL('image/jpeg', 0.5).slice(0, 200) + '...',
    };
  });

  console.log('=== CANVAS STATE ===');
  console.log(JSON.stringify(canvasData, null, 2));

  // Save full canvas to file
  const dataUrl = await page.evaluate(() => document.querySelector('canvas')?.toDataURL('image/png'));
  if (dataUrl) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('/tmp/pw-vision-agent/fire-canvas-frame.png', Buffer.from(base64, 'base64'));
    console.log('Saved canvas frame to /tmp/pw-vision-agent/fire-canvas-frame.png');
  }

  // Print all HF-related logs
  console.log('\n=== HF-RELATED LOGS ===');
  const hfLogs = allLogs.filter(l => /specialized|HF|hugging|fire|prithiv/i.test(l.text));
  hfLogs.slice(-20).forEach(l => console.log(`  [${l.type}] ${l.text}`));

  // Print all logs (last 30)
  console.log('\n=== LAST 30 LOGS ===');
  allLogs.slice(-30).forEach(l => console.log(`  [${l.type}] ${l.text}`));

  await H.pauseAnalysis(page);
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
