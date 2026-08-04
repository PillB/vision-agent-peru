/**
 * Playwright validation against the LIVE GitHub Pages deployment.
 * Tests the production static export at https://pillb.github.io/vision-agent-peru/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://pillb.github.io/vision-agent-peru/';
const SHOT_DIR = '/tmp/pw-gh-pages/screenshots';

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const report = { url: LIVE_URL, startedAt: new Date().toISOString(), tests: [], summary: { total: 0, passed: 0, failed: 0 } };

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function record(name, pass, details = {}) {
  report.tests.push({ name, status: pass ? 'pass' : 'fail', ...details });
  report.summary.total++;
  if (pass) report.summary.passed++; else report.summary.failed++;
  log(`${pass ? '✓' : '✗'} ${name}`);
}

(async () => {
  log('Launching Chromium (headless)');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // ─── Test 1: Home page loads ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      log('Test 1: Home page loads on GitHub Pages');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(2000);
      const title = await page.title();
      const h1 = await page.locator('h1').first().textContent();
      await page.screenshot({ path: path.join(SHOT_DIR, '01-home.png'), fullPage: false });
      record('1. Home page loads', !!title && !!h1 && errors.length === 0, {
        title, errors: errors.slice(0, 3),
      });
    } catch (e) {
      record('1. Home page loads', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 2: Strategic Brief tab ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      log('Test 2: Strategic Brief tab');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1000);
      await page.click('button[id$="trigger-brief"]');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SHOT_DIR, '02-brief.png'), fullPage: false });
      const h2s = await page.$$eval('h2', els => els.map(e => (e.textContent || '').trim().slice(0, 80)).filter(Boolean));
      record('2. Strategic Brief tab renders', h2s.length > 0 && errors.length === 0, { h2Count: h2s.length, errors: errors.slice(0, 3) });
    } catch (e) {
      record('2. Strategic Brief tab renders', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 3: Prototype tab loads + COCO-SSD model ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      log('Test 3: Prototype tab + COCO-SSD model load');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1000);
      await page.click('button[id$="trigger-prototype"]');
      await page.waitForTimeout(3000);

      // Wait for model ready (up to 90s — GH Pages may be slower)
      let ready = false;
      for (let i = 0; i < 90; i++) {
        const txt = await page.evaluate(() => document.body.textContent || '');
        if (/COCO-SSD ready|model ready/i.test(txt)) { ready = true; break; }
        if (/Model load failed/i.test(txt)) break;
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: path.join(SHOT_DIR, '03-prototype.png'), fullPage: false });
      record('3. Prototype tab + COCO-SSD model load', ready, { ready, errors: errors.slice(0, 3) });
    } catch (e) {
      record('3. Prototype tab + COCO-SSD model load', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 4: Start analysis + detection cycle ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      log('Test 4: Start analysis + detection');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1000);
      await page.click('button[id$="trigger-prototype"]');
      await page.waitForTimeout(3000);

      // Wait for model ready
      for (let i = 0; i < 90; i++) {
        const txt = await page.evaluate(() => document.body.textContent || '');
        if (/COCO-SSD ready/i.test(txt)) break;
        await page.waitForTimeout(1000);
      }

      // Start analysis via store hook
      await page.evaluate(() => window.__visionStore?.setRunning(true));
      await page.waitForTimeout(8000);

      const state = await page.evaluate(() => {
        const s = window.__visionStore?.getState();
        return { isRunning: s?.isRunning, agentCycleCount: s?.agentCycleCount, actionLogCount: s?.actionLog?.length };
      });
      await page.screenshot({ path: path.join(SHOT_DIR, '04-analysis.png'), fullPage: false });
      record('4. Start analysis + detection', state.isRunning === true && state.agentCycleCount > 0, { state, errors: errors.slice(0, 3) });
    } catch (e) {
      record('4. Start analysis + detection', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 5: Use case switching ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      log('Test 5: Use case switching');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1000);
      await page.click('button[id$="trigger-prototype"]');
      await page.waitForTimeout(3000);
      for (let i = 0; i < 90; i++) {
        if (/COCO-SSD ready/i.test(await page.evaluate(() => document.body.textContent || ''))) break;
        await page.waitForTimeout(1000);
      }

      const useCases = ['crowd_surge', 'fire_smoke', 'parking', 'intrusion'];
      let allSwitched = true;
      for (const uc of useCases) {
        await page.evaluate((id) => window.__visionStore?.setActiveUseCase(id), uc);
        await page.waitForTimeout(2000);
        const state = await page.evaluate(() => window.__visionStore?.getState()?.activeUseCaseId);
        if (state !== uc) allSwitched = false;
      }
      await page.screenshot({ path: path.join(SHOT_DIR, '05-usecase.png'), fullPage: false });
      record('5. Use case switching', allSwitched && errors.length === 0, { errors: errors.slice(0, 3) });
    } catch (e) {
      record('5. Use case switching', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 6: Camera switching ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      log('Test 6: Camera switching');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1000);
      await page.click('button[id$="trigger-prototype"]');
      await page.waitForTimeout(3000);
      for (let i = 0; i < 90; i++) {
        if (/COCO-SSD ready/i.test(await page.evaluate(() => document.body.textContent || ''))) break;
        await page.waitForTimeout(1000);
      }

      const cameras = ['intersection', 'crosswalk', 'static-fire'];
      let allSwitched = true;
      for (const cam of cameras) {
        await page.evaluate((id) => window.__visionStore?.setActiveCamera(id), cam);
        await page.waitForTimeout(2000);
        const state = await page.evaluate(() => window.__visionStore?.getState()?.activeCameraId);
        if (state !== cam) allSwitched = false;
      }
      await page.screenshot({ path: path.join(SHOT_DIR, '06-camera.png'), fullPage: false });
      record('6. Camera switching', allSwitched && errors.length === 0, { errors: errors.slice(0, 3) });
    } catch (e) {
      record('6. Camera switching', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 7: Fire detection with static image ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      log('Test 7: Fire detection (static image)');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1000);
      await page.click('button[id$="trigger-prototype"]');
      await page.waitForTimeout(3000);
      for (let i = 0; i < 90; i++) {
        if (/COCO-SSD ready/i.test(await page.evaluate(() => document.body.textContent || ''))) break;
        await page.waitForTimeout(1000);
      }

      await page.evaluate(() => {
        window.__visionStore?.setActiveUseCase('fire_smoke');
        window.__visionStore?.setActiveCamera('static-fire');
        window.__visionStore?.setRunning(true);
      });

      // Wait 45s for HF model load + inference
      log('  Waiting 45s for fire model...');
      await page.waitForTimeout(45000);

      const trace = await page.evaluate(() => {
        const s = window.__visionStore?.getState();
        return s?.agentTrace?.join('\n') || '';
      });
      const hasFire = /Fire Needed Action.*DETECTED|class=fire/i.test(trace);
      await page.screenshot({ path: path.join(SHOT_DIR, '07-fire.png'), fullPage: false });
      record('7. Fire detection (static image)', hasFire, { hasFire, traceSnippet: trace.slice(-200), errors: errors.slice(0, 3) });
    } catch (e) {
      record('7. Fire detection (static image)', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Test 8: No broken asset paths ───
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const failedRequests = [];
    page.on('response', r => {
      if (r.status() >= 400) failedRequests.push({ status: r.status(), url: r.url().slice(0, 150) });
    });
    try {
      log('Test 8: No broken asset paths');
      await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(3000);
      await page.click('button[id$="trigger-prototype"]');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SHOT_DIR, '08-assets.png'), fullPage: false });
      // Filter out expected API route 404s (static export doesn't have API routes)
      const realFailures = failedRequests.filter(r => !r.url.includes('/api/'));
      record('8. No broken asset paths', realFailures.length === 0, { failedRequests: realFailures.slice(0, 5) });
    } catch (e) {
      record('8. No broken asset paths', false, { error: e.message });
    }
    await ctx.close();
  }

  // ─── Summary ───
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('/tmp/pw-gh-pages/report.json', JSON.stringify(report, null, 2));

  log(`\n=== GITHUB PAGES VALIDATION SUMMARY ===`);
  log(`  Pass: ${report.summary.passed} | Fail: ${report.summary.failed} | Total: ${report.summary.total}`);
  for (const t of report.tests) {
    log(`  ${t.status === 'pass' ? '✓' : '✗'} ${t.name}`);
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
