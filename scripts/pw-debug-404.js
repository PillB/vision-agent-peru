/**
 * Debug: find the 404 — log all failed requests.
 */
const { chromium } = require('playwright');
const H = require('./pw-helpers.js');

(async () => {
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const failedReqs = [];
  page.on('response', r => {
    if (r.status() >= 400) {
      failedReqs.push({ status: r.status(), url: r.url().slice(0, 200) });
    }
  });

  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 60_000);
  await H.startAnalysis(page);
  await page.waitForTimeout(8000);
  await H.pauseAnalysis(page);

  console.log('=== 4xx/5xx RESPONSES ===');
  console.log(JSON.stringify(failedReqs, null, 2));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
