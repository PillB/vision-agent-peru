/**
 * Simple, robust trigger verification — ONE use case per invocation.
 * Usage: node scripts/pw-trigger-single.js <useCaseId>
 *
 * Writes result to /tmp/pw-vision-agent/trigger-<useCaseId>.json
 */
const path = require('path');
const http = require('http');
const H = require('./pw-helpers.js');
const fs = require('fs');

const USE_CASE_ID = process.argv[2] || 'fire_smoke';

const CONFIG = {
  fire_smoke:       { camera: 'static-fire',       expectDetected: true,  waitMs: 45000 },
  graffiti:         { camera: 'static-graffiti',   expectDetected: true,  waitMs: 50000 },
  flood_watch:      { camera: 'static-flood',      expectDetected: true,  waitMs: 50000 },
  landslide_watch:  { camera: 'static-demolished', expectDetected: false, waitMs: 50000 },
  post_quake:       { camera: 'static-crack',      expectDetected: true,  waitMs: 50000 },
  slip_hazard:      { camera: 'static-foggy-night',expectDetected: false, waitMs: 50000 },
};

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/', method: 'HEAD', timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkServer()) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

(async () => {
  const tc = CONFIG[USE_CASE_ID];
  if (!tc) {
    console.error(`Unknown use case: ${USE_CASE_ID}`);
    process.exit(1);
  }

  const result = {
    id: USE_CASE_ID,
    timestamp: new Date().toISOString(),
    camera: tc.camera,
    expectDetected: tc.expectDetected,
    status: 'unknown',
    hfLoaded: false,
    hfTrace: '',
    detectedByModel: false,
    hitsTriggered: 0,
    actionsTriggered: 0,
    agentTrace: '',
    error: null,
  };

  const OUT_PATH = `/tmp/pw-vision-agent/trigger-${USE_CASE_ID}.json`;
  const writeResult = () => fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

  // Pre-flight: wait for server to be ready (Node-level, not browser-level)
  log(`Pre-flight: waiting for dev server...`);
  const serverReady = await waitForServer(30);
  if (!serverReady) {
    result.status = 'fail';
    result.error = 'Dev server not ready after 60s';
    writeResult();
    log('FAIL: server not ready');
    process.exit(1);
  }
  log(`Server ready`);

  let browser;
  try {
    browser = await H.makeBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);

    log(`Testing ${USE_CASE_ID} (camera=${tc.camera})`);

    await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(1500);
    await H.clickTab(page, 'prototype');
    await page.waitForTimeout(3000);
    const ready = await H.waitForModelReady(page, 90_000);
    if (!ready) throw new Error('COCO-SSD not ready');

    await H.selectUseCase(page, USE_CASE_ID);
    try { await H.selectCamera(page, tc.camera); }
    catch (e) { log(`  camera hint not found, using auto-selected`); }
    await H.startAnalysis(page);

    log(`  waiting ${tc.waitMs}ms for HF model load + inference...`);
    await page.waitForTimeout(tc.waitMs);

    const state = await H.readPrototypeState(page);
    const traceText = await H.getTraceText(page);

    const hfLoadMatch = traceText.match(/HF Model \[([^\]]+)\]:\s*([^\n]+)/);
    const hfDetectedMatch = traceText.match(/HF Model \[[^\]]+\]:.*⚠ DETECTED/i);
    const hfUnavailableMatch = /HF Model \[[^\]]+\]:\s*(unavailable|inference error)/i.test(traceText);

    result.hfLoaded = !hfUnavailableMatch;
    result.hfTrace = hfLoadMatch ? hfLoadMatch[0].slice(0, 300) : '(no HF trace)';
    result.detectedByModel = !!hfDetectedMatch;
    result.hitsTriggered = state.hitsCount || 0;
    result.actionsTriggered = state.actionLogCount || 0;
    result.agentTrace = traceText.slice(0, 1500);
    result.state = state;

    if (!result.hfLoaded) {
      result.status = 'fail';
      result.error = 'HF model failed to load';
    } else if (tc.expectDetected && !result.detectedByModel) {
      result.status = 'warn';
      result.error = `Expected detection but model did not fire. Top trace: ${result.hfTrace}`;
    } else if (tc.expectDetected && result.detectedByModel && result.hitsTriggered === 0) {
      result.status = 'warn';
      result.error = `Model detected but no Tier 2+ hits triggered`;
    } else {
      result.status = 'pass';
    }

    if (errors.page.length > 0) result.pageErrors = errors.page.slice(0, 5);

    log(`  ${result.status.toUpperCase()}: hfLoaded=${result.hfLoaded}, detected=${result.detectedByModel}, hits=${result.hitsTriggered}, actions=${result.actionsTriggered}`);

    await H.pauseAnalysis(page);
    await page.waitForTimeout(300);
    try {
      await page.screenshot({ path: path.join(H.SHOT_DIR, `trigger-${USE_CASE_ID}.png`), fullPage: false });
    } catch (e) { /* screenshot failure is non-fatal */ }

    writeResult();
    await ctx.close();
  } catch (e) {
    result.status = 'fail';
    result.error = e.message;
    log(`FAIL: ${e.message.split('\n')[0].slice(0, 200)}`);
    writeResult();
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
})().catch(e => {
  console.error('FATAL:', e);
  fs.writeFileSync(`/tmp/pw-vision-agent/trigger-${USE_CASE_ID}.json`, JSON.stringify({ id: USE_CASE_ID, status: 'fail', error: e.message, timestamp: new Date().toISOString() }, null, 2));
  process.exit(1);
});
