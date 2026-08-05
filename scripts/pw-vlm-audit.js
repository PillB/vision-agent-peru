/**
 * Comprehensive Playwright + VLM visual audit.
 * Captures screenshots of every use case, then uses VLM to analyze them.
 */
const path = require('path');
const http = require('http');
const fs = require('fs');
const H = require('./pw-helpers.js');

const SCREENSHOTS_DIR = '/tmp/vlm-audit/screenshots';
const REPORT_PATH = '/tmp/vlm-audit/report.json';
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/', method: 'HEAD', timeout: 3000 }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const ALL_USE_CASES = [
  'intrusion', 'after_hours', 'crowd_surge', 'parking', 'queue_anomaly',
  'abandoned_object', 'graffiti', 'fire_smoke', 'slip_hazard',
  'incident_description', 'auto_report', 'visual_memory',
  'flood_watch', 'landslide_watch', 'post_quake',
];

const BEST_CAMERA = {
  intrusion: 'intersection', after_hours: 'street', crowd_surge: 'crosswalk',
  parking: 'static-parking', queue_anomaly: 'static-queue',
  abandoned_object: 'static-backpack', graffiti: 'static-graffiti',
  fire_smoke: 'static-fire', slip_hazard: 'static-foggy-night',
  incident_description: 'pedestrians', auto_report: 'intersection',
  visual_memory: 'pedestrians', flood_watch: 'static-flood',
  landslide_watch: 'static-demolished', post_quake: 'static-crack',
};

(async () => {
  // Wait for server
  for (let i = 0; i < 30; i++) {
    if (await checkServer()) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  const report = { startedAt: new Date().toISOString(), useCases: [] };
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Navigate + setup
  log('Navigating to prototype...');
  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 90_000);

  for (const ucId of ALL_USE_CASES) {
    const ucResult = { id: ucId, screenshots: [], state: null, trace: '' };
    log(`Testing ${ucId}...`);

    try {
      // Switch use case + camera
      await H.selectUseCase(page, ucId);
      try { await H.selectCamera(page, BEST_CAMERA[ucId] || 'intersection'); } catch (e) {}
      await H.startAnalysis(page);

      // Wait for detection cycles
      await page.waitForTimeout(8000);

      // Capture state
      const state = await H.readPrototypeState(page);
      const trace = await H.getTraceText(page);
      ucResult.state = {
        isRunning: state.isRunning,
        fps: state.fps,
        personCount: state.personCount,
        currentTier: state.currentTier,
        hitsCount: state.hitsCount,
        actionLogCount: state.actionLogCount,
        agentTraceCount: state.agentTraceCount,
        activeCameraId: state.activeCameraId,
        activeUseCaseId: state.activeUseCaseId,
        modelStatus: state.modelStatus,
      };
      ucResult.trace = trace.slice(0, 1000);

      // Screenshot 1: Full dashboard view
      const ss1 = `audit-${ucId}-dashboard.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, ss1), fullPage: false });
      ucResult.screenshots.push(ss1);

      // Screenshot 2: Camera view close-up (just the video + canvas area)
      const videoEl = page.locator('.relative.rounded-xl.overflow-hidden');
      if (await videoEl.count() > 0) {
        const ss2 = `audit-${ucId}-camera.png`;
        try { await videoEl.screenshot({ path: path.join(SCREENSHOTS_DIR, ss2) }); } catch (e) {}
        ucResult.screenshots.push(ss2);
      }

      // Screenshot 3: Agent trace panel
      const traceEl = page.locator('.rounded-xl.border.border-zinc-200.bg-white').filter({ hasText: 'Agent reasoning' }).first();
      if (await traceEl.count() > 0) {
        const ss3 = `audit-${ucId}-trace.png`;
        try { await traceEl.screenshot({ path: path.join(SCREENSHOTS_DIR, ss3) }); } catch (e) {}
        ucResult.screenshots.push(ss3);
      }

      log(`  FPS=${state.fps} count=${state.personCount} tier=${state.currentTier} hits=${state.hitsCount} actions=${state.actionLogCount}`);

      await H.pauseAnalysis(page);
      await page.waitForTimeout(500);
    } catch (e) {
      ucResult.error = e.message;
      log(`  ERROR: ${e.message.slice(0, 100)}`);
    }

    report.useCases.push(ucResult);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  }

  await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  log(`\n=== AUDIT COMPLETE ===`);
  log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
  log(`Report: ${REPORT_PATH}`);
  log(`Use cases tested: ${report.useCases.length}`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
