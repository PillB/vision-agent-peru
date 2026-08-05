/**
 * Comprehensive Playwright + VLM audit of the live dashboard.
 * Captures screenshots of each section, then analyzes with VLM.
 * Focus: alerts occlusion, metrics, trace, identities, reports, actions panels.
 */
const path = require('path');
const http = require('http');
const fs = require('fs');
const H = require('./pw-helpers.js');

const DIR = '/tmp/ui-audit';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/', method: 'HEAD', timeout: 3000 }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

(async () => {
  for (let i = 0; i < 30; i++) { if (await checkServer()) break; await new Promise(r => setTimeout(r, 2000)); }

  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  log('Navigating to prototype...');
  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 90_000);

  // Start analysis on fire_smoke (generates lots of alerts quickly)
  log('Starting fire_smoke analysis to generate alerts...');
  await H.selectUseCase(page, 'fire_smoke');
  await H.selectCamera(page, 'static-fire');
  await H.startAnalysis(page);
  
  // Wait for alerts to accumulate
  log('Waiting 15s for alerts to accumulate...');
  await page.waitForTimeout(15000);

  // Capture state
  const state = await H.readPrototypeState(page);
  log(`State: fps=${state.fps}, hits=${state.hitsCount}, actions=${state.actionLogCount}, tier=${state.currentTier}`);

  // Screenshot 1: Full dashboard with accumulated alerts
  await page.screenshot({ path: path.join(DIR, '01-full-dashboard.png'), fullPage: false });
  log('Captured: 01-full-dashboard.png');

  // Screenshot 2: Alerts panel close-up
  const alertsPanel = page.locator('text=Alerts & incidents').locator('..');
  if (await alertsPanel.count() > 0) {
    try {
      await alertsPanel.screenshot({ path: path.join(DIR, '02-alerts-panel.png') });
      log('Captured: 02-alerts-panel.png');
    } catch (e) {}
  }

  // Screenshot 3: Agent trace panel
  const tracePanel = page.locator('text=Agent reasoning').locator('..');
  if (await tracePanel.count() > 0) {
    try {
      await tracePanel.screenshot({ path: path.join(DIR, '03-trace-panel.png') });
      log('Captured: 03-trace-panel.png');
    } catch (e) {}
  }

  // Screenshot 4: Actions panel
  const actionsPanel = page.locator('text=Action audit trail').locator('..');
  if (await actionsPanel.count() > 0) {
    try {
      await actionsPanel.screenshot({ path: path.join(DIR, '04-actions-panel.png') });
      log('Captured: 04-actions-panel.png');
    } catch (e) {}
  }

  // Screenshot 5: Metrics row
  const metricsPanel = page.locator('text=Detections now').locator('..').locator('..');
  if (await metricsPanel.count() > 0) {
    try {
      await metricsPanel.screenshot({ path: path.join(DIR, '05-metrics.png') });
      log('Captured: 05-metrics.png');
    } catch (e) {}
  }

  // Screenshot 6: Identities panel
  const identitiesPanel = page.locator('text=Identidades Rastreadas').locator('..');
  if (await identitiesPanel.count() > 0) {
    try {
      await identitiesPanel.screenshot({ path: path.join(DIR, '06-identities.png') });
      log('Captured: 06-identities.png');
    } catch (e) {}
  }

  // Screenshot 7: Reports panel
  const reportsPanel = page.locator('text=Incident reports').locator('..');
  if (await reportsPanel.count() > 0) {
    try {
      await reportsPanel.screenshot({ path: path.join(DIR, '07-reports.png') });
      log('Captured: 07-reports.png');
    } catch (e) {}
  }

  // Screenshot 8: Camera view area
  const cameraArea = page.locator('.relative.rounded-xl.overflow-hidden');
  if (await cameraArea.count() > 0) {
    try {
      await cameraArea.screenshot({ path: path.join(DIR, '08-camera.png') });
      log('Captured: 08-camera.png');
    } catch (e) {}
  }

  // Screenshot 9: Tab 1 (Solution Overview)
  await H.pauseAnalysis(page);
  await page.click('button[id$="trigger-overview"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '09-tab1-overview.png'), fullPage: false });
  log('Captured: 09-tab1-overview.png');

  // Screenshot 10: Tab 3 (Strategic Brief)
  await page.click('button[id$="trigger-brief"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '10-tab3-brief.png'), fullPage: false });
  log('Captured: 10-tab3-brief.png');

  await browser.close();
  log(`\nAudit complete. ${fs.readdirSync(DIR).length} screenshots saved to ${DIR}`);
  if (errors.length > 0) {
    log(`Console errors: ${errors.length}`);
    errors.slice(0, 5).forEach(e => log(`  - ${e.slice(0, 100)}`));
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
