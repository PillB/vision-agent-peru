/**
 * Common helpers for Playwright tests — shared across all chunked scripts.
 * Loaded via require('./pw-helpers.js').
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
// IMPORTANT: screenshots and reports go to /tmp/ during the test run to avoid
// triggering Next.js dev server's Fast Refresh full-page reloads (which lose
// all in-page state and break long-running tests).
const SHOT_DIR = '/tmp/pw-vision-agent/screenshots';
const REPORT_PATH = '/tmp/pw-vision-agent/pw-report.json';
const fs = require('fs');

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const USE_CASES = [
  { id: 'intrusion',                name: 'Intrusión en Zona Restringida' },
  { id: 'after_hours',              name: 'Intrusión Vehicular Fuera de Horario' },
  { id: 'crowd_surge',              name: 'Avalancha de Multitud' },
  { id: 'parking',                  name: 'Estacionamiento — Espacios Disponibles' },
  { id: 'queue_anomaly',            name: 'Anomalía de Cola en Cajeros' },
  { id: 'abandoned_object',         name: 'Objeto Abandonado' },
  { id: 'graffiti',                 name: 'Grafiti y Vandalismo' },
  { id: 'fire_smoke',               name: 'Fuego y Humo' },
  { id: 'slip_hazard',              name: 'Resbalón y Superficie Mojada' },
  { id: 'incident_description',     name: 'Descripción Automática de Incidentes' },
  { id: 'auto_report',              name: 'Reporte Auto-Generado' },
  { id: 'visual_memory',            name: 'Memoria Visual — Incidentes Similares' },
  { id: 'flood_watch',              name: 'Vigilancia de Inundación' },
  { id: 'landslide_watch',          name: 'Vigilancia de Deslizamiento' },
  { id: 'post_quake',               name: 'Escanéo Post-Sismo' },
];

const CAMERAS = [
  'intersection', 'crosswalk', 'street', 'pedestrians',
  'uc-graffiti', 'uc-fire', 'uc-parking', 'uc-night-parking',
  'uc-queue', 'uc-backpack', 'uc-flood', 'uc-foggy-night',
  'uc-demolished', 'uc-crack',
];

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

const CAPABILITY_LEVELS = ['Reglas Tradicionales', 'ML / Deep Learning', 'Cognitiva / GenAI', 'IA Autónoma'];

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function loadReport() {
  if (fs.existsSync(REPORT_PATH)) {
    try { return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')); } catch (e) {}
  }
  return { startedAt: new Date().toISOString(), base: BASE, tests: [], summary: { total: 0, passed: 0, failed: 0 } };
}

function saveReport(r) {
  r.summary.total = r.tests.length;
  r.summary.passed = r.tests.filter(t => t.status === 'pass').length;
  r.summary.failed = r.tests.filter(t => t.status === 'fail').length;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(r, null, 2));
}

function recordTest(report, name, status, details = {}) {
  report.tests.push({ name, status, ...details });
  // Save incrementally so progress isn't lost on Bash tool timeout
  saveReport(report);
  const icon = status === 'pass' ? '✓' : '✗';
  log(`${icon} ${name}${details.note ? ' — ' + details.note : ''}`);
}

async function makeBrowser() {
  return await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist',
    ],
  });
}

async function attachErrorCollectors(page) {
  const errors = { console: [], page: [] };
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  page.on('pageerror', e => errors.page.push(e.message));
  return errors;
}

async function clickTab(page, tabName) {
  const map = { 'overview': 'trigger-overview', 'brief': 'trigger-brief', 'prototype': 'trigger-prototype' };
  await page.click(`button[id$="${map[tabName]}"]`);
  await page.waitForTimeout(1500);
}

async function waitForModelReady(page, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const txt = await page.evaluate(() => document.body.textContent || '');
    if (/COCO-SSD ready/i.test(txt)) return true;
    if (/Model load failed/i.test(txt)) return false;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function selectUseCase(page, useCaseId) {
  // FAST PATH: drive the Zustand store directly via window.__visionStore
  // (added in src/lib/store.ts). Skips slow radix-Select UI interactions.
  const result = await page.evaluate((id) => {
    const store = window.__visionStore;
    if (!store) return { ok: false, reason: 'store not exposed' };
    try {
      store.setActiveUseCase(id);
      return { ok: true, state: { activeUseCaseId: store.getState().activeUseCaseId, activeCameraId: store.getState().activeCameraId } };
    } catch (e) { return { ok: false, reason: String(e) }; }
  }, useCaseId);
  if (!result.ok) throw new Error(`selectUseCase(${useCaseId}) failed: ${result.reason}`);
  await page.waitForTimeout(800); // allow UI to reflect the change
  return result.state;
}

async function selectCamera(page, cameraId) {
  const result = await page.evaluate((id) => {
    const store = window.__visionStore;
    if (!store) return { ok: false, reason: 'store not exposed' };
    try {
      store.setActiveCamera(id);
      return { ok: true, state: { activeCameraId: store.getState().activeCameraId } };
    } catch (e) { return { ok: false, reason: String(e) }; }
  }, cameraId);
  if (!result.ok) throw new Error(`selectCamera(${cameraId}) failed: ${result.reason}`);
  await page.waitForTimeout(800);
  return result.state;
}

async function startAnalysis(page) {
  // FAST PATH: use store hook
  const ok = await page.evaluate(() => {
    const s = window.__visionStore;
    if (!s) return false;
    s.setRunning(true);
    return true;
  });
  if (ok) {
    await page.waitForTimeout(1000);
    return true;
  }
  // Fallback: click the button
  const btn = page.locator('button', { hasText: 'Start analysis' }).first();
  if (await btn.count() > 0) {
    await btn.click({ force: true });
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function pauseAnalysis(page) {
  const ok = await page.evaluate(() => {
    const s = window.__visionStore;
    if (!s) return false;
    s.setRunning(false);
    return true;
  });
  if (ok) {
    await page.waitForTimeout(500);
    return true;
  }
  const btn = page.locator('button', { hasText: 'Pause' }).first();
  if (await btn.count() > 0) {
    await btn.click({ force: true });
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function clickButton(page, text) {
  // IMPORTANT: Playwright's .click() does actionability checks that wait for
  // the element to be "stable". The canvas overlay above the controls bar
  // repaints every 1.5s (detection loop), which makes Playwright think the
  // page is unstable and the click never settles — even with force:true.
  //
  // Solution: bypass Playwright's click entirely and dispatch a native
  // DOM click via page.evaluate. This is instant and reliable.
  const result = await page.evaluate((btnText) => {
    const btns = Array.from(document.querySelectorAll('button'));
    // Exact text match first (avoid picking up the wrong "Clear" button)
    let btn = btns.find(b => (b.textContent || '').trim() === btnText);
    if (!btn) {
      // Contains match
      btn = btns.find(b => (b.textContent || '').includes(btnText));
    }
    if (!btn) return { ok: false, reason: 'not found' };
    if (btn.disabled) return { ok: false, reason: 'disabled' };
    btn.click();
    return { ok: true };
  }, text);
  if (!result.ok) throw new Error(`clickButton(${text}) failed: ${result.reason}`);
  await page.waitForTimeout(800);
}

const CAP_MAP = {
  'Reglas Tradicionales': 'traditional',
  'ML / Deep Learning': 'mldl',
  'Cognitiva / GenAI': 'cognitive',
  'IA Autónoma': 'agentic',
};

async function setCapabilityLevel(page, label) {
  const ok = await page.evaluate((lvl) => {
    const s = window.__visionStore;
    if (!s) return false;
    s.setCapabilityLevel(lvl);
    return true;
  }, CAP_MAP[label] || label);
  if (ok) {
    await page.waitForTimeout(300);
    return;
  }
  // Fallback
  const btn = page.locator('button', { hasText: label }).first();
  await btn.click({ force: true });
  await page.waitForTimeout(300);
}

async function toggleLLMJudge(page, targetState) {
  const ok = await page.evaluate((state) => {
    const s = window.__visionStore;
    if (!s) return false;
    const current = s.getState().llmJudgeEnabled;
    const want = state === 'on';
    if (current !== want) s.setLlmJudgeEnabled(want);
    return true;
  }, targetState);
  if (ok) {
    await page.waitForTimeout(300);
    return true;
  }
  // Fallback: click the switch
  const sw = page.locator('[role="switch"]').first();
  if (await sw.count() === 0) return false;
  const current = await sw.getAttribute('aria-checked');
  if ((targetState === 'on' && current !== 'true') || (targetState === 'off' && current === 'true')) {
    await sw.click({ force: true });
    await page.waitForTimeout(300);
  }
  return true;
}

async function readPrototypeState(page) {
  return await page.evaluate(() => {
    const s = window.__visionStore ? window.__visionStore.getState() : null;
    return {
      url: location.href,
      videoSrc: document.querySelector('video')?.currentSrc || '',
      videoPaused: document.querySelector('video')?.paused,
      videoTime: document.querySelector('video')?.currentTime,
      canvasCount: document.querySelectorAll('canvas').length,
      // Store-derived state
      activeUseCaseId: s?.activeUseCaseId,
      activeCameraId: s?.activeCameraId,
      capabilityLevel: s?.capabilityLevel,
      isRunning: s?.isRunning,
      modelStatus: s?.modelStatus,
      fps: s?.fps,
      personCount: s?.personCount,
      lastDetectionLatencyMs: s?.lastDetectionLatencyMs,
      currentTier: s?.currentTier,
      samplesCount: s?.samples?.length,
      hitsCount: s?.hits?.length,
      actionLogCount: s?.actionLog?.length,
      reportsCount: s?.reports?.length,
      agentTraceCount: s?.agentTrace?.length,
      trackedIdentitiesCount: s?.trackedIdentities?.length,
      llmJudgeEnabled: s?.llmJudgeEnabled,
    };
  });
}

async function getTraceText(page) {
  // Read directly from the Zustand store for reliability.
  return await page.evaluate(() => {
    const s = window.__visionStore ? window.__visionStore.getState() : null;
    if (s && Array.isArray(s.agentTrace) && s.agentTrace.length > 0) {
      return s.agentTrace.join('\n');
    }
    // Fallback: scrape from DOM
    const all = document.querySelectorAll('div.font-mono');
    let best = '';
    all.forEach(el => {
      const txt = (el.textContent || '').trim();
      if (txt.length > best.length && txt.length < 10000) best = txt;
    });
    return best.slice(0, 3000);
  });
}

module.exports = {
  BASE, SHOT_DIR, REPORT_PATH,
  USE_CASES, CAMERAS, CAMERAS_LOOKUP, CAPABILITY_LEVELS,
  log, loadReport, saveReport, recordTest,
  makeBrowser, attachErrorCollectors, clickTab, waitForModelReady,
  selectUseCase, selectCamera, startAnalysis, pauseAnalysis,
  clickButton, setCapabilityLevel, toggleLLMJudge, readPrototypeState, getTraceText,
};
