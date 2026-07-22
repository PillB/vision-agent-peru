/**
 * Trigger verification — chunk runner.
 * Usage: node scripts/pw-trigger-chunk.js <start> <end>
 * e.g., node scripts/pw-trigger-chunk.js 0 2  (tests use cases at index 0,1)
 */
const path = require('path');
const H = require('./pw-helpers.js');
const fs = require('fs');

const TRIGGER_REPORT_PATH = '/tmp/pw-vision-agent/trigger-report.json';

const USE_CASES_WITH_HF = [
  { id: 'fire_smoke',       cameraHint: 'uc-fire',       expectDetected: true,  waitMs: 45000 },
  { id: 'graffiti',         cameraHint: 'uc-graffiti',   expectDetected: true,  waitMs: 50000 },
  { id: 'flood_watch',      cameraHint: 'uc-flood',      expectDetected: true,  waitMs: 50000 },
  { id: 'landslide_watch',  cameraHint: 'uc-demolished', expectDetected: false, waitMs: 50000 },
  { id: 'post_quake',       cameraHint: 'uc-crack',      expectDetected: true,  waitMs: 50000 },
  { id: 'slip_hazard',      cameraHint: 'uc-foggy-night',expectDetected: false, waitMs: 50000 },
];

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const startIdx = parseInt(process.argv[2] || '0');
const endIdx = parseInt(process.argv[3] || String(USE_CASES_WITH_HF.length));

(async () => {
  // Load or init report
  let report;
  if (fs.existsSync(TRIGGER_REPORT_PATH)) {
    report = JSON.parse(fs.readFileSync(TRIGGER_REPORT_PATH, 'utf-8'));
    if (!report.results) report.results = [];
  } else {
    report = { startedAt: new Date().toISOString(), results: [] };
  }

  const browser = await H.makeBrowser();

  for (let i = startIdx; i < endIdx && i < USE_CASES_WITH_HF.length; i++) {
    const tc = USE_CASES_WITH_HF[i];
    const result = { ...tc, status: 'unknown', hfLoaded: false, hfTrace: '', detectedByModel: false, hitsTriggered: 0, actionsTriggered: 0, agentTrace: '', error: null };

    // Remove any existing entry for this use case (so re-runs replace)
    report.results = report.results.filter(r => r.id !== tc.id);

    // Retry up to 2 times per use case
    for (let attempt = 1; attempt <= 2; attempt++) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errors = await H.attachErrorCollectors(page);

      try {
        log(`Testing ${tc.id} (camera=${tc.cameraHint}) — attempt ${attempt}`);
        // Pre-flight: wait for server
        for (let j = 0; j < 30; j++) {
          const code = await page.evaluate(async () => {
            try { const r = await fetch('http://localhost:3000/', { method: 'HEAD' }); return r.status; }
            catch { return 0; }
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

        await H.selectUseCase(page, tc.id);
        try { await H.selectCamera(page, tc.cameraHint); }
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
        result.agentTrace = traceText.slice(0, 800);

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

        if (errors.page.length > 0) result.pageErrors = errors.page.slice(0, 3);

        await ctx.close();
        if (!result.error || !result.error.includes('ERR_CONNECTION')) break;
      } catch (e) {
        await ctx.close();
        result.status = 'fail';
        result.error = e.message;
        log(`  attempt ${attempt} FAIL: ${e.message.split('\n')[0].slice(0, 100)}`);
        if (e.message.includes('ERR_CONNECTION') && attempt < 2) {
          log(`  waiting 25s for server restart...`);
          await new Promise(r => setTimeout(r, 25000));
        } else {
          break;
        }
      }
    }

    report.results.push(result);
    fs.writeFileSync(TRIGGER_REPORT_PATH, JSON.stringify(report, null, 2));
  }

  await browser.close();
  log(`Chunk ${startIdx}-${endIdx} done.`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
