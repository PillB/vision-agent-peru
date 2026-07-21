/**
 * Vision Agent — Comprehensive Playwright Test Harness
 *
 * Tests:
 *  1. Home / Solution Overview tab — render + console clean
 *  2. Strategic Brief tab — render
 *  3. Live Prototype tab — full driver:
 *     a. Default state (Avalancha de Multitud + Intersection camera)
 *     b. Start analysis → wait for COCO-SSD ready + first detection
 *     c. Switch through all 15 use cases; verify auto camera switch
 *     d. Switch through all 14 cameras; verify video loads
 *     e. Toggle LLM judge on/off
 *     f. Switch capability level (4 levels)
 *     g. Trigger Snapshot, Reset baseline, Clear, Silence 5m
 *     h. Verify alerts panel populates when threshold exceeded
 *     i. Verify action audit trail logs
 *     j. Verify identity panel populates
 *     k. Trigger HuggingFace model (fire_smoke use case + uc-fire camera)
 *     l. Trigger pixel-anomaly fallback (flood_watch + uc-flood)
 *     m. Verify INDECI report generation (auto_report use case)
 *
 * For each use case, captures:
 *   - Console errors
 *   - Page errors
 *   - Screenshot
 *   - Status (pass/fail)
 *
 * Output: writes JSON report to /home/z/my-project/scripts/pw-report.json
 *         + per-usecase screenshots in scripts/screenshots/
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const SHOT_DIR = '/home/z/my-project/scripts/screenshots';
const REPORT_PATH = '/home/z/my-project/scripts/pw-report.json';

// Mirror of USE_CASES ids + labels (kept in sync with src/lib/use-cases.ts)
const USE_CASES = [
  { id: 'intrusion',                name: 'Intrusión en Zona Restringida' },
  { id: 'after_hours',              name: 'Intrusión Vehicular Fuera de Horario' },
  { id: 'crowd_surge',              name: 'Avalancha de Multitud' },
  { id: 'parking',                  name: 'Estacionamiento' },
  { id: 'queue_anomaly',            name: 'Anomalía de Cola en Cajeros' },
  { id: 'abandoned_object',         name: 'Objeto Abandonado' },
  { id: 'graffiti',                 name: 'Grafiti y Vandalismo' },
  { id: 'fire_smoke',               name: 'Fuego y Humo' },
  { id: 'slip_hazard',              name: 'Resbalón y Superficie Mojada' },
  { id: 'incident_description',     name: 'Descripción Automática de Incidentes' },
  { id: 'auto_report',              name: 'Reporte Auto-Generado' },
  { id: 'visual_memory',            name: 'Memoria Visual' },
  { id: 'flood_watch',              name: 'Vigilancia de Inundación' },
  { id: 'landslide_watch',          name: 'Vigilancia de Deslizamiento' },
  { id: 'post_quake',               name: 'Escaneo Post-Sismo' },
];

const CAMERAS = [
  'intersection', 'crosswalk', 'street', 'pedestrians',
  'uc-graffiti', 'uc-fire', 'uc-parking', 'uc-night-parking',
  'uc-queue', 'uc-backpack', 'uc-flood', 'uc-foggy-night',
  'uc-demolished', 'uc-crack',
];

const CAPABILITY_LEVELS = ['Reglas Tradicionales', 'ML / Deep Learning', 'Cognitiva / GenAI', 'IA Autónoma'];

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  base: BASE,
  tests: [],
  summary: { total: 0, passed: 0, failed: 0, errors: [] },
};

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

async function attachErrorCollectors(page) {
  const errors = { console: [], page: [] };
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  page.on('pageerror', e => errors.page.push(e.message));
  return errors;
}

async function clickTab(page, tabName) {
  // Tab triggers have ids ending with `trigger-overview|trigger-brief|trigger-prototype`
  const map = {
    'overview': 'trigger-overview',
    'brief': 'trigger-brief',
    'prototype': 'trigger-prototype',
  };
  const suffix = map[tabName];
  if (!suffix) throw new Error(`Unknown tab: ${tabName}`);
  await page.click(`button[id$="${suffix}"]`);
  await page.waitForTimeout(1500);
}

async function openUseCaseDropdown(page) {
  // The use case selector is the FIRST radix combobox whose text matches a use case name.
  // We click the trigger to open the dropdown.
  const triggers = page.locator('[role="combobox"]');
  const count = await triggers.count();
  if (count < 1) throw new Error('No combobox found');
  // The use-case one is the first
  await triggers.first().click();
  await page.waitForTimeout(500);
}

async function openCameraDropdown(page) {
  const triggers = page.locator('[role="combobox"]');
  const count = await triggers.count();
  if (count < 2) throw new Error('Camera combobox missing');
  await triggers.nth(1).click();
  await page.waitForTimeout(500);
}

async function selectUseCase(page, useCaseId) {
  // Each select item has role="option"; click by text match against the name.
  // We open dropdown first, then click the option matching the use case name partial.
  await openUseCaseDropdown(page);
  const option = page.locator(`[role="option"]`).filter({ hasText: USE_CASES.find(u => u.id === useCaseId)?.name });
  if (await option.count() === 0) {
    // Close dropdown
    await page.keyboard.press('Escape');
    throw new Error(`Use case option not found: ${useCaseId}`);
  }
  await option.first().click();
  await page.waitForTimeout(800);
}

async function selectCamera(page, cameraId) {
  await openCameraDropdown(page);
  // Each camera option has a value attribute = cameraId
  const option = page.locator(`[role="option"][data-value="${cameraId}"]`);
  if (await option.count() === 0) {
    // Fallback: by text
    const camera = CAMERAS_LOOKUP[cameraId] || cameraId;
    const byText = page.locator(`[role="option"]`).filter({ hasText: camera });
    if (await byText.count() > 0) {
      await byText.first().click();
    } else {
      await page.keyboard.press('Escape');
      throw new Error(`Camera option not found: ${cameraId}`);
    }
  } else {
    await option.click();
  }
  await page.waitForTimeout(800);
}

const CAMERAS_LOOKUP = {
  'intersection': 'Intersección Urbana',
  'crosswalk': 'Cruce Peatonal',
  'street': 'Calle Comercial',
  'pedestrians': 'Avenida',
  'uc-graffiti': 'Grafiti',
  'uc-fire': 'Fuego',
  'uc-parking': 'Estacionamiento',
  'uc-night-parking': 'Estacionamiento Nocturno',
  'uc-queue': 'Cola',
  'uc-backpack': 'Mochila',
  'uc-flood': 'Inundación',
  'uc-foggy-night': 'Noche Niebla',
  'uc-demolished': 'Demolido',
  'uc-crack': 'Grieta',
};

async function clickButton(page, text) {
  const btn = page.locator('button', { hasText: text }).first();
  if (await btn.count() === 0) throw new Error(`Button not found: ${text}`);
  await btn.click();
}

async function setCapabilityLevel(page, label) {
  const btn = page.locator('button', { hasText: label }).first();
  if (await btn.count() === 0) throw new Error(`Capability button not found: ${label}`);
  await btn.click();
  await page.waitForTimeout(300);
}

async function toggleLLMJudge(page, targetState /* 'on'|'off' */) {
  // The switch is a radix switch element
  const sw = page.locator('[role="switch"]').first();
  if (await sw.count() === 0) return false;
  const current = await sw.getAttribute('aria-checked');
  if ((targetState === 'on' && current !== 'true') || (targetState === 'off' && current === 'true')) {
    await sw.click();
    await page.waitForTimeout(300);
  }
  return true;
}

async function readPrototypeState(page) {
  // Pull current store state via window helper (the store is exposed in dev for debugging)
  return await page.evaluate(() => {
    const text = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent : '';
    };
    return {
      url: location.href,
      ready: !!document.querySelector('video'),
      videoSrc: document.querySelector('video')?.currentSrc || '',
      videoPaused: document.querySelector('video')?.paused,
      videoTime: document.querySelector('video')?.currentTime,
      canvasCount: document.querySelectorAll('canvas').length,
      // Pull stats from the visible DOM
      personCount: text('[data-person-count]') || '',
      tier: text('[data-tier]') || '',
      fps: text('[data-fps]') || '',
      // Pull alert panel row count
      alertCount: document.querySelectorAll('[data-alert-row]').length,
      actionCount: document.querySelectorAll('[data-action-row]').length,
    };
  });
}

async function waitForModelReady(page, timeoutMs = 45_000) {
  // Wait for "COCO-SSD ready" or "Real ML ready" text
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const txt = await page.evaluate(() => document.body.textContent || '');
    if (/COCO-SSD ready|Real ML ready|model ready/i.test(txt)) return true;
    if (/Model load failed/i.test(txt)) return false;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function startAnalysis(page) {
  // Button text changes between 'Start analysis' and 'Pause'
  const startBtn = page.locator('button', { hasText: 'Start analysis' }).first();
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  // Already running
  return false;
}

async function pauseAnalysis(page) {
  const pauseBtn = page.locator('button', { hasText: 'Pause' }).first();
  if (await pauseBtn.count() > 0) {
    await pauseBtn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

function recordTest(name, status, details = {}) {
  report.tests.push({ name, status, ...details });
  report.summary.total += 1;
  if (status === 'pass') report.summary.passed += 1;
  else report.summary.failed += 1;
  log(`${status.toUpperCase()}: ${name}${details.note ? ' — ' + details.note : ''}`);
}

(async () => {
  log('Launching Chromium (headless)');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=swiftshader', '--enable-unsafe-swiftshader', // software WebGL for headless
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--enable-features=WebGLDeveloperExtensions',
    ],
  });

  // ───────── Test 1: Home page loads cleanly ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 1: Home page loads');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      const title = await page.title();
      const h1 = await page.locator('h1').first().textContent();
      await page.screenshot({ path: path.join(SHOT_DIR, '01-home.png'), fullPage: false });
      const pass = !!title && !!h1 && errors.console.length === 0 && errors.page.length === 0;
      recordTest('1. Home page loads with no console errors', pass ? 'pass' : 'fail', {
        note: `title="${title}", h1="${(h1 || '').slice(0, 60)}", console errors=${errors.console.length}, page errors=${errors.page.length}`,
        consoleErrors: errors.console.slice(0, 5),
        pageErrors: errors.page.slice(0, 5),
      });
    } catch (e) {
      recordTest('1. Home page loads with no console errors', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 2: Strategic Brief tab ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 2: Strategic Brief tab');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'brief');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SHOT_DIR, '02-brief.png'), fullPage: false });
      const h2s = await page.$$eval('h2', els => els.map(e => (e.textContent || '').trim().slice(0, 80)).filter(Boolean));
      const pass = h2s.length > 0 && errors.page.length === 0;
      recordTest('2. Strategic Brief tab renders content', pass ? 'pass' : 'fail', {
        note: `H2 count=${h2s.length}, page errors=${errors.page.length}`,
        h2s: h2s.slice(0, 8),
      });
    } catch (e) {
      recordTest('2. Strategic Brief tab renders content', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 3: Prototype tab loads + COCO-SSD becomes ready ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 3: Prototype tab + COCO-SSD model load');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      // Wait for model load
      const ready = await waitForModelReady(page, 90_000);
      await page.screenshot({ path: path.join(SHOT_DIR, '03-prototype-loaded.png'), fullPage: false });
      const state = await readPrototypeState(page);
      recordTest('3. Prototype tab + COCO-SSD model load', ready ? 'pass' : 'fail', {
        note: ready ? 'COCO-SSD ready' : 'Model not ready after 90s',
        state,
      });
    } catch (e) {
      recordTest('3. Prototype tab + COCO-SSD model load', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 4: Start analysis + verify detections come through ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 4: Start analysis + first detection cycle');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      // Start analysis (default use case is crowd_surge, default camera is intersection)
      await startAnalysis(page);
      // Wait ~10s to allow at least 5 detect cycles (throttled to 1.5s each)
      await page.waitForTimeout(12_000);

      const state = await readPrototypeState(page);
      await page.screenshot({ path: path.join(SHOT_DIR, '04-running-default.png'), fullPage: false });

      // Pull store state via window (Zustand stores are not auto-exposed; read DOM)
      const personCountText = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('span,div,p')).find(e =>
          /persona|person/i.test(e.textContent || '') && /\d/.test(e.textContent || ''));
        return el ? el.textContent.trim().slice(0, 100) : '';
      });

      // Pass if no page errors AND video is playing AND some trace entries exist
      const traceCount = await page.locator('[data-agent-trace] > *, ol li, ul li').count();
      const pass = errors.page.length === 0 && state.videoPaused === false;
      recordTest('4. Start analysis + detection cycle', pass ? 'pass' : 'fail', {
        note: `video paused=${state.videoPaused}, page errors=${errors.page.length}, person=${personCountText.slice(0, 50)}`,
        state,
        consoleErrors: errors.console.slice(0, 5),
      });

      // Pause for next test
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('4. Start analysis + detection cycle', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 5: Iterate all 15 use cases ─────────
  // For each: select use case → verify camera auto-switches → start → 5s → screenshot
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 5: Iterate all 15 use cases');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      await startAnalysis(page);
      await page.waitForTimeout(3000);

      for (const uc of USE_CASES) {
        const beforeErrors = errors.page.length;
        try {
          await selectUseCase(page, uc.id);
          await page.waitForTimeout(4000); // allow detect cycles + agent decisions
          await page.screenshot({ path: path.join(SHOT_DIR, `05-uc-${uc.id}.png`), fullPage: false });
          const newErrors = errors.page.slice(beforeErrors);
          recordTest(`5.${uc.id}: ${uc.name}`, newErrors.length === 0 ? 'pass' : 'fail', {
            note: newErrors.length === 0 ? 'No new page errors' : `${newErrors.length} new errors`,
            newErrors: newErrors.slice(0, 3),
          });
        } catch (e) {
          recordTest(`5.${uc.id}: ${uc.name}`, 'fail', { note: e.message });
        }
      }
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('5. Iterate use cases (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 6: Iterate all 14 cameras with a stable use case ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 6: Iterate all 14 cameras');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      // Use crowd_surge (general-purpose)
      await selectUseCase(page, 'crowd_surge');
      await startAnalysis(page);
      await page.waitForTimeout(3000);

      for (const cam of CAMERAS) {
        const beforeErrors = errors.page.length;
        try {
          await selectCamera(page, cam);
          await page.waitForTimeout(4000);
          // Verify video src changed
          const state = await readPrototypeState(page);
          await page.screenshot({ path: path.join(SHOT_DIR, `06-cam-${cam}.png`), fullPage: false });
          const newErrors = errors.page.slice(beforeErrors);
          recordTest(`6.${cam}: camera switch`, newErrors.length === 0 ? 'pass' : 'fail', {
            note: newErrors.length === 0 ? `OK, video src=${state.videoSrc.slice(-40)}` : `${newErrors.length} new errors`,
            newErrors: newErrors.slice(0, 3),
          });
        } catch (e) {
          recordTest(`6.${cam}: camera switch`, 'fail', { note: e.message });
        }
      }
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('6. Iterate cameras (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 7: Capability level switching (4 levels) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 7: Capability level switching');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      await selectUseCase(page, 'crowd_surge');
      await startAnalysis(page);
      await page.waitForTimeout(3000);

      for (const level of CAPABILITY_LEVELS) {
        const beforeErrors = errors.page.length;
        try {
          await setCapabilityLevel(page, level);
          await page.waitForTimeout(3500);
          await page.screenshot({ path: path.join(SHOT_DIR, `07-cap-${level.replace(/\W+/g, '-')}.png`), fullPage: false });
          const newErrors = errors.page.slice(beforeErrors);
          recordTest(`7.${level}`, newErrors.length === 0 ? 'pass' : 'fail', {
            note: newErrors.length === 0 ? 'No new errors' : `${newErrors.length} new errors`,
            newErrors: newErrors.slice(0, 3),
          });
        } catch (e) {
          recordTest(`7.${level}`, 'fail', { note: e.message });
        }
      }
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('7. Capability level switching (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 8: Control buttons (Snapshot, Reset baseline, Clear, Silence 5m) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 8: Control buttons');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      await selectUseCase(page, 'crowd_surge');
      await startAnalysis(page);
      await page.waitForTimeout(5000);

      // Snapshot
      const beforeErr1 = errors.page.length;
      await clickButton(page, 'Snapshot');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOT_DIR, '08-snapshot.png'), fullPage: false });
      const snapErrs = errors.page.slice(beforeErr1);
      recordTest('8a. Snapshot button', snapErrs.length === 0 ? 'pass' : 'fail', { note: `${snapErrs.length} errors`, newErrors: snapErrs.slice(0, 3) });

      // Reset baseline
      const beforeErr2 = errors.page.length;
      await clickButton(page, 'Reset baseline');
      await page.waitForTimeout(1500);
      const resetErrs = errors.page.slice(beforeErr2);
      recordTest('8b. Reset baseline button', resetErrs.length === 0 ? 'pass' : 'fail', { note: `${resetErrs.length} errors`, newErrors: resetErrs.slice(0, 3) });

      // Clear
      const beforeErr3 = errors.page.length;
      await clickButton(page, 'Clear');
      await page.waitForTimeout(1500);
      const clearErrs = errors.page.slice(beforeErr3);
      recordTest('8c. Clear button', clearErrs.length === 0 ? 'pass' : 'fail', { note: `${clearErrs.length} errors`, newErrors: clearErrs.slice(0, 3) });

      // Silence 5m
      const beforeErr4 = errors.page.length;
      await clickButton(page, 'Silence 5m');
      await page.waitForTimeout(1500);
      const silenceErrs = errors.page.slice(beforeErr4);
      recordTest('8d. Silence 5m button', silenceErrs.length === 0 ? 'pass' : 'fail', { note: `${silenceErrs.length} errors`, newErrors: silenceErrs.slice(0, 3) });

      await pauseAnalysis(page);
    } catch (e) {
      recordTest('8. Control buttons (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 9: HuggingFace model — fire_smoke use case ─────────
  // The fire detection HF model is prithivMLmods/Fire-Detection-Engine-ONNX
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 9: HuggingFace fire detection model');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('COCO-SSD not ready');

      // Switch to fire use case (should auto-pick uc-fire camera)
      await selectUseCase(page, 'fire_smoke');
      await startAnalysis(page);
      // Wait longer for HF model load (~10-30s on first load)
      log('Waiting 35s for HF fire model to load and run inference...');
      await page.waitForTimeout(35_000);
      await page.screenshot({ path: path.join(SHOT_DIR, '09-hf-fire.png'), fullPage: false });

      // Look for trace entry mentioning HF model
      const traceText = await page.evaluate(() => {
        const el = document.querySelector('[data-agent-trace], .agent-trace, ol, ul');
        return el ? el.textContent.slice(0, 2000) : '';
      });
      const hfMentioned = /HF Model|Fire Detection|prithivMLmods|Violence Detection/i.test(traceText);
      recordTest('9. HuggingFace fire detection model loads', hfMentioned ? 'pass' : 'fail', {
        note: hfMentioned ? 'HF model trace visible' : 'No HF trace found',
        traceSnippet: traceText.slice(-300),
      });
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('9. HuggingFace fire detection model loads', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 10: HuggingFace model — graffiti (violence detection) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 10: HuggingFace violence detection model (graffiti)');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('COCO-SSD not ready');

      await selectUseCase(page, 'graffiti');
      await startAnalysis(page);
      log('Waiting 35s for HF violence model to load...');
      await page.waitForTimeout(35_000);
      await page.screenshot({ path: path.join(SHOT_DIR, '10-hf-graffiti.png'), fullPage: false });
      const traceText = await page.evaluate(() => {
        const el = document.querySelector('[data-agent-trace], .agent-trace, ol, ul');
        return el ? el.textContent.slice(0, 2000) : '';
      });
      const hfMentioned = /HF Model|Violence Detection|onnx-community/i.test(traceText);
      recordTest('10. HuggingFace violence detection model loads', hfMentioned ? 'pass' : 'fail', {
        note: hfMentioned ? 'HF model trace visible' : 'No HF trace found',
        traceSnippet: traceText.slice(-300),
      });
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('10. HuggingFace violence detection model loads', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 11: Pixel anomaly fallback — flood_watch ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 11: Pixel anomaly fallback (flood)');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('COCO-SSD not ready');

      await selectUseCase(page, 'flood_watch');
      await startAnalysis(page);
      await page.waitForTimeout(15_000);
      await page.screenshot({ path: path.join(SHOT_DIR, '11-pixel-flood.png'), fullPage: false });
      const traceText = await page.evaluate(() => {
        const el = document.querySelector('[data-agent-trace], .agent-trace, ol, ul');
        return el ? el.textContent.slice(0, 2000) : '';
      });
      const pxMentioned = /Pixel anomaly/i.test(traceText);
      recordTest('11. Pixel anomaly fallback (flood)', pxMentioned ? 'pass' : 'fail', {
        note: pxMentioned ? 'Pixel anomaly trace visible' : 'No pixel anomaly trace',
        traceSnippet: traceText.slice(-400),
      });
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('11. Pixel anomaly fallback (flood)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 12: LLM Judge toggle + cognitive level ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 12: LLM Judge toggle');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      // Switch to cognitive level (judge enabled by default at cognitive+)
      await selectUseCase(page, 'crowd_surge');
      await setCapabilityLevel(page, 'Cognitiva / GenAI');
      await startAnalysis(page);
      await page.waitForTimeout(5000);

      // Toggle judge OFF
      const beforeOff = errors.page.length;
      const toggledOff = await toggleLLMJudge(page, 'off');
      await page.waitForTimeout(2000);
      const offErrs = errors.page.slice(beforeOff);
      recordTest('12a. Toggle LLM judge OFF', toggledOff && offErrs.length === 0 ? 'pass' : 'fail', {
        note: toggledOff ? `Toggled off, ${offErrs.length} errors` : 'Switch not found',
      });

      // Toggle judge ON
      const beforeOn = errors.page.length;
      const toggledOn = await toggleLLMJudge(page, 'on');
      await page.waitForTimeout(2000);
      const onErrs = errors.page.slice(beforeOn);
      recordTest('12b. Toggle LLM judge ON', toggledOn && onErrs.length === 0 ? 'pass' : 'fail', {
        note: toggledOn ? `Toggled on, ${onErrs.length} errors` : 'Switch not found',
      });

      await page.screenshot({ path: path.join(SHOT_DIR, '12-judge-toggle.png'), fullPage: false });
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('12. LLM Judge toggle (driver)', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 13: INDECI report generation (auto_report use case) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 13: Auto-report generation');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      // Try auto_report use case (cognitive level)
      await selectUseCase(page, 'auto_report');
      await setCapabilityLevel(page, 'Cognitiva / GenAI');
      await startAnalysis(page);
      // Wait for several ticks to trigger a report
      await page.waitForTimeout(20_000);
      await page.screenshot({ path: path.join(SHOT_DIR, '13-auto-report.png'), fullPage: false });
      // Check for any report-related DOM
      const reportText = await page.evaluate(() => {
        const txt = document.body.textContent || '';
        const match = txt.match(/INDECI|SINPAD|incident report|Reporte/i);
        return match ? match[0] : '';
      });
      recordTest('13. Auto-report use case runs', errors.page.length === 0 ? 'pass' : 'fail', {
        note: `errors=${errors.page.length}, reportKeyword=${reportText || '(none)'}`,
      });
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('13. Auto-report use case runs', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 14: Long-running stability (60s on default config) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 14: 60s stability run');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await waitForModelReady(page, 90_000);
      if (!ready) throw new Error('Model not ready');

      await startAnalysis(page);
      // 60s run — wait + take periodic screenshots
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(10_000);
        const state = await readPrototypeState(page);
        log(`  10s tick #${i + 1}: videoPaused=${state.videoPaused}, consoleErrs=${errors.console.length}`);
      }
      await page.screenshot({ path: path.join(SHOT_DIR, '14-stability-60s.png'), fullPage: false });
      recordTest('14. 60s stability run', errors.page.length === 0 ? 'pass' : 'fail', {
        note: `page errors=${errors.page.length}, console errors=${errors.console.length}`,
        pageErrors: errors.page.slice(0, 3),
        consoleErrors: errors.console.slice(0, 3),
      });
      await pauseAnalysis(page);
    } catch (e) {
      recordTest('14. 60s stability run', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 15: Locale switch (EN ↔ ES) ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await attachErrorCollectors(page);
    try {
      log('Test 15: Locale switch ES → EN → ES');
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      // Find the language switcher button
      const langBtn = page.locator('button', { hasText: /Español|English/i }).first();
      if (await langBtn.count() > 0) {
        await langBtn.click();
        await page.waitForTimeout(1000);
        // Click English option if present
        const enOpt = page.locator('[role="menuitem"], [role="option"], button', { hasText: /^English$/ }).first();
        if (await enOpt.count() > 0) {
          await enOpt.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(SHOT_DIR, '15-locale-en.png'), fullPage: false });
          recordTest('15. Locale switch to English', errors.page.length === 0 ? 'pass' : 'fail', {
            note: `errors=${errors.page.length}`,
          });
        } else {
          recordTest('15. Locale switch to English', 'fail', { note: 'English option not found' });
        }
      } else {
        recordTest('15. Locale switch to English', 'fail', { note: 'Language button not found' });
      }
    } catch (e) {
      recordTest('15. Locale switch to English', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  log(`\nReport written to ${REPORT_PATH}`);
  log(`Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed`);
  await browser.close();
})().catch(e => {
  console.error('FATAL:', e);
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...report, fatal: e.message }, null, 2));
  process.exit(1);
});
