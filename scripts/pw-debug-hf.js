/**
 * Debug: HuggingFace model loading — capture all console output.
 */
const { chromium } = require('playwright');
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const browser = await H.makeBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture ALL console messages (not just errors)
  const allMsgs = [];
  page.on('console', m => allMsgs.push({ type: m.type(), text: m.text().slice(0, 200) }));
  page.on('pageerror', e => allMsgs.push({ type: 'pageerror', text: e.message.slice(0, 200) }));
  page.on('requestfailed', r => allMsgs.push({ type: 'reqfail', text: `${r.url()} - ${r.failure()?.errorText}` }));

  await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await H.clickTab(page, 'prototype');
  await page.waitForTimeout(3000);
  await H.waitForModelReady(page, 60_000);

  H.log('Selecting fire_smoke + starting analysis');
  await H.selectUseCase(page, 'fire_smoke');
  await H.startAnalysis(page);

  // Wait 60s for HF model to load
  H.log('Waiting 60s for HF model...');
  await page.waitForTimeout(60_000);

  // Capture state
  const state = await H.readPrototypeState(page);
  console.log('\n=== STORE STATE ===');
  console.log(JSON.stringify(state, null, 2));

  const trace = await H.getTraceText(page);
  console.log('\n=== AGENT TRACE (last 1000 chars) ===');
  console.log(trace.slice(-1000));

  // Filter to HF-related messages
  const hfMsgs = allMsgs.filter(m => /hf|hugging|transformer|onnx|pipeline|fire|prithivMLmods|violence|onnx-community|specializedmodel/i.test(m.text));
  console.log(`\n=== HF-RELATED CONSOLE MSGS (${hfMsgs.length} of ${allMsgs.length} total) ===`);
  hfMsgs.slice(-30).forEach(m => console.log(`  [${m.type}] ${m.text}`));

  // All errors
  const errMsgs = allMsgs.filter(m => m.type === 'error' || m.type === 'pageerror' || m.type === 'reqfail');
  console.log(`\n=== ALL ERRORS (${errMsgs.length}) ===`);
  errMsgs.slice(-20).forEach(m => console.log(`  [${m.type}] ${m.text}`));

  await page.screenshot({ path: path.join(H.SHOT_DIR, 'debug-hf-fire.png'), fullPage: false });

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
