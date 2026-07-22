/**
 * Quick smoke test: verify fire detection shows "fire" label (not "person")
 * and the UI badge shows the correct model name.
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

  console.log('→ Navigate to prototype');
  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  const ready = await H.waitForModelReady(page, 90_000);
  if (!ready) { console.log('✗ Model not ready'); process.exit(1); }

  // Switch to fire use case + static camera
  await H.selectUseCase(page, 'fire_smoke');
  await H.selectCamera(page, 'static-fire');
  await H.startAnalysis(page);
  console.log('→ Waiting 40s for HF model load + inference...');
  await page.waitForTimeout(40000);

  // Check the agent trace for "fire" class (not "person")
  const trace = await H.getTraceText(page);
  const hasFireDetection = /class=fire|Fire Needed Action.*DETECTED/i.test(trace);
  const hasPersonMislabel = /class=person.*Fire Needed Action/i.test(trace);

  // Check the UI badge text
  const badgeText = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('span'));
    const modelBadge = badges.find(b => /Fire Detection|COCO-SSD|CLIP|HF/i.test(b.textContent || ''));
    return modelBadge ? modelBadge.textContent.trim() : '(not found)';
  });

  // Check the status line
  const statusText = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span.font-mono'));
    const status = spans.find(s => /ready/i.test(s.textContent || ''));
    return status ? status.textContent.trim() : '(not found)';
  });

  console.log('\n=== SMOKE TEST RESULTS ===');
  console.log(`Fire detection in trace: ${hasFireDetection ? '✓ YES' : '✗ NO'}`);
  console.log(`Person mislabel (bug): ${hasPersonMislabel ? '✗ STILL PRESENT' : '✓ FIXED'}`);
  console.log(`UI badge: "${badgeText}"`);
  console.log(`Status line: "${statusText}"`);
  console.log(`\nTrace snippet (last 300 chars):`);
  console.log(trace.slice(-300));

  // Check for HF model in trace
  const hfInTrace = /HF Model \[Fire Detection Engine\]/i.test(trace);
  console.log(`\nHF Fire Detection Engine in trace: ${hfInTrace ? '✓ YES' : '✗ NO'}`);

  await H.pauseAnalysis(page);
  await page.screenshot({ path: path.join(H.SHOT_DIR, 'smoke-fire-label.png'), fullPage: false });
  await browser.close();

  if (hasFireDetection && !hasPersonMislabel) {
    console.log('\n✓ SMOKE TEST PASSED — fire is labeled "fire" not "person"');
  } else {
    console.log('\n✗ SMOKE TEST FAILED — fire still mislabeled');
    process.exit(1);
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
