/**
 * Direct canvas test — manually load the fire image and draw it.
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

  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1000);

  // Test: directly load the fire image and draw it to a canvas
  const result = await page.evaluate(async () => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = (e) => reject(new Error('Image load failed'));
        img.src = '/sim/frames/uc-fire.jpg';
      });
      const loadResult = await loadPromise;

      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Sample many points
      const points = [
        [240, 135], [120, 67], [360, 200], [10, 10], [470, 260],
        [50, 50], [200, 100], [400, 150], [300, 200], [100, 250],
      ];
      const samples = points.map(([x, y]) => {
        const d = ctx.getImageData(x, y, 1, 1).data;
        return { x, y, r: d[0], g: d[1], b: d[2], a: d[3] };
      });
      const nonBlack = samples.filter(s => s.r > 0 || s.g > 0 || s.b > 0).length;

      // Also save as data URL for inspection
      const dataUrl = canvas.toDataURL('image/png').slice(0, 100);

      return {
        loadResult,
        samples,
        nonBlack,
        dataUrl,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('=== DIRECT CANVAS TEST ===');
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
