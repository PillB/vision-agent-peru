const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1500);
  await page.click('button[id$="trigger-prototype"]');
  await page.waitForTimeout(3000);
  for (let i = 0; i < 30; i++) {
    if (/COCO-SSD ready/.test(await page.evaluate(() => document.body.textContent))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => window.__visionStore.setActiveUseCase('fire_smoke'));
  await page.evaluate(() => window.__visionStore.setActiveCamera('uc-fire'));
  await page.evaluate(() => window.__visionStore.setRunning(true));
  await page.waitForTimeout(15000);

  // Screenshot the video element
  const video = page.locator('video');
  await video.screenshot({ path: '/tmp/video-frame.png' });
  console.log('Video screenshot saved');
  await page.screenshot({ path: '/tmp/page-frame.png' });
  console.log('Page screenshot saved');

  await browser.close();
})();
