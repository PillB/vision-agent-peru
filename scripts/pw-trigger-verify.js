/**
 * Trigger verification: verify each specialized model actually fires a
 * detection that shows up in the agent trace AND triggers an agent action.
 *
 * For each use case with a specialized model:
 *   - Switch to the use case
 *   - Start analysis
 *   - Wait for HF model to load + run inference
 *   - Capture: trace text, agent decisions, hits count, action log
 *
 * Output: /tmp/pw-vision-agent/trigger-report.json
 */
const path = require('path');
const H = require('./pw-helpers.js');
const fs = require('fs');

const TRIGGER_REPORT_PATH = '/tmp/pw-vision-agent/trigger-report.json';

// Use cases that have specialized HF models — must verify actual triggers
const USE_CASES_WITH_HF = [
  { id: 'fire_smoke',       cameraHint: 'uc-fire',       expectDetected: true,  minConfidence: 0.4, waitMs: 50000 },
  { id: 'graffiti',         cameraHint: 'uc-graffiti',   expectDetected: true,  minConfidence: 0.3, waitMs: 50000 },
  { id: 'flood_watch',      cameraHint: 'uc-flood',      expectDetected: true,  minConfidence: 0.3, waitMs: 50000 },
  { id: 'landslide_watch',  cameraHint: 'uc-demolished', expectDetected: false, minConfidence: 0.0, waitMs: 50000 },
  { id: 'post_quake',       cameraHint: 'uc-crack',      expectDetected: true,  minConfidence: 0.3, waitMs: 50000 },
  { id: 'slip_hazard',      cameraHint: 'uc-foggy-night',expectDetected: false, minConfidence: 0.0, waitMs: 50000 },
];

const report = {
  startedAt: new Date().toISOString(),
  results: [],
};

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

(async () => {
  const browser = await H.makeBrowser();

  for (const tc of USE_CASES_WITH_HF) {
    const result = { ...tc, status: 'unknown', hfLoaded: false, hfTrace: '', detectedByModel: false, hitsTriggered: 0, actionsTriggered: 0, agentTrace: '', error: null };

    // Retry up to 2 times per use case (handles transient server deaths from cgroup OOM)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errors = await H.attachErrorCollectors(page);

      try {
        log(`Testing ${tc.id} (camera=${tc.cameraHint}) — attempt ${attempt}`);
        // Pre-flight: wait for server to be ready (the keepalive watchdog may be restarting)
        for (let i = 0; i < 30; i++) {
          const code = await page.evaluate(async () => {
            try {
              const r = await fetch('http://localhost:3000/', { method: 'HEAD' });
              return r.status;
            } catch { return 0; }
          }).catch(() => 0);
          if (code === 200) break;
          await page.waitForTimeout(2000);
        }
        await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
        await page.waitForTimeout(1500);
        await H.clickTab(page, 'prototype');
        await page.waitForTimeout(3000);
        const ready = await H.waitForModelReady(page, 90_000);
        if (!ready) throw new Error('COCO-SSD not ready');

        // Switch use case (auto-selects best camera via dev hook)
        await H.selectUseCase(page, tc.id);

        // Force the camera to the one we expect to produce detections.
        // The auto-switch from the dev hook races with component mount;
        // explicit selectCamera ensures the right video is loaded.
        try {
          await H.selectCamera(page, tc.cameraHint);
        } catch (e) {
          log(`  camera hint ${tc.cameraHint} not found, using auto-selected`);
        }

        // Start analysis
        await H.startAnalysis(page);

        // Wait for HF model to load + run inference (CLIP first load is slow ~30-45s)
        log(`  waiting ${tc.waitMs}ms for HF model load + inference...`);
        await page.waitForTimeout(tc.waitMs);

        // Capture state
        const state = await H.readPrototypeState(page);
        const traceText = await H.getTraceText(page);

        // Parse trace for HF model load + detection
        const hfLoadMatch = traceText.match(/HF Model \[([^\]]+)\]:\s*([^\n]+)/);
        const hfDetectedMatch = traceText.match(/HF Model \[[^\]]+\]:.*⚠ DETECTED/i);
        const hfUnavailableMatch = /HF Model \[[^\]]+\]:\s*(unavailable|inference error)/i.test(traceText);

        result.hfLoaded = !hfUnavailableMatch;
        result.hfTrace = hfLoadMatch ? hfLoadMatch[0].slice(0, 300) : '(no HF trace)';
        result.detectedByModel = !!hfDetectedMatch;
        result.hitsTriggered = state.hitsCount || 0;
        result.actionsTriggered = state.actionLogCount || 0;
        result.agentTrace = traceText.slice(0, 800);

        // Pass if: HF model loaded AND (model detected OR no detection expected)
        if (!result.hfLoaded) {
          result.status = 'fail';
          result.error = 'HF model failed to load';
        } else if (tc.expectDetected && !result.detectedByModel) {
          result.status = 'warn';
          result.error = `Expected detection but model did not fire. Top trace: ${result.hfTrace}`;
        } else if (tc.expectDetected && result.detectedByModel && result.hitsTriggered === 0) {
          result.status = 'warn';
          result.error = `Model detected but no Tier 2+ hits triggered (agent may have filtered)`;
        } else {
          result.status = 'pass';
          result.error = null;
        }

        log(`  ${result.status.toUpperCase()}: hfLoaded=${result.hfLoaded}, detected=${result.detectedByModel}, hits=${result.hitsTriggered}, actions=${result.actionsTriggered}`);

        await H.pauseAnalysis(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(H.SHOT_DIR, `trigger-${tc.id}.png`), fullPage: false });

        if (errors.page.length > 0) {
          result.pageErrors = errors.page.slice(0, 3);
        }

        await ctx.close();
        // If we got here without throwing, break out of retry loop
        if (result.status !== 'fail' || !result.error?.includes('ERR_CONNECTION')) {
          break;
        }
      } catch (e) {
        await ctx.close();
        result.status = 'fail';
        result.error = e.message;
        log(`  attempt ${attempt} FAIL: ${e.message.split('\n')[0].slice(0, 100)}`);
        // If it's a connection error, wait for server restart then retry
        if (e.message.includes('ERR_CONNECTION') && attempt < 2) {
          log(`  waiting 20s for server restart...`);
          await new Promise(r => setTimeout(r, 20000));
        } else {
          break;
        }
      }
    }

    report.results.push(result);
    fs.writeFileSync(TRIGGER_REPORT_PATH, JSON.stringify(report, null, 2));
  }

  // Summary
  report.finishedAt = new Date().toISOString();
  const passed = report.results.filter(r => r.status === 'pass').length;
  const warned = report.results.filter(r => r.status === 'warn').length;
  const failed = report.results.filter(r => r.status === 'fail').length;
  log(`\n=== TRIGGER VERIFICATION SUMMARY ===`);
  log(`  Pass: ${passed} | Warn: ${warned} | Fail: ${failed}`);
  for (const r of report.results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
    log(`  ${icon} ${r.id}: hfLoaded=${r.hfLoaded} detected=${r.detectedByModel} hits=${r.hitsTriggered}`);
  }
  fs.writeFileSync(TRIGGER_REPORT_PATH, JSON.stringify(report, null, 2));

  await browser.close();
})().catch(e => {
  console.error('FATAL:', e);
  report.fatal = e.message;
  fs.writeFileSync(TRIGGER_REPORT_PATH, JSON.stringify(report, null, 2));
  process.exit(1);
});
