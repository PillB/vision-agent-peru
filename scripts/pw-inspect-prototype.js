/**
 * Inspect the Live Prototype tab — discover all selectors we'll
 * drive in the full test harness.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  console.log('→ goto /');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);

  console.log('→ Click Live Prototype tab');
  await page.click('button[id$="trigger-prototype"]');
  await page.waitForTimeout(3000); // prototype has heavy components

  console.log('\n=== H2/H3 in prototype ===');
  const headings = await page.$$eval('h2, h3', els =>
    els
      .filter(e => e.offsetParent !== null)
      .map(e => ({ tag: e.tagName, text: (e.textContent || '').trim().slice(0, 80) }))
  );
  console.log(JSON.stringify(headings.slice(0, 40), null, 2));

  console.log('\n=== Select trigger buttons (radix Select) ===');
  const selectTriggers = await page.$$eval('[role="combobox"]', els =>
    els
      .filter(e => e.offsetParent !== null)
      .map(e => ({ text: (e.textContent || '').trim().slice(0, 100), id: e.id, ariaLabel: e.getAttribute('aria-label') }))
  );
  console.log(JSON.stringify(selectTriggers, null, 2));

  console.log('\n=== Capability level buttons ===');
  const caps = await page.$$eval('button', els =>
    els
      .filter(e => e.offsetParent !== null && /Tradicional|ML|Cognitiv|Autónom|Traditional|Cognitive|Agentic/i.test(e.textContent || ''))
      .map(e => ({ text: (e.textContent || '').trim().slice(0, 50), className: e.className.slice(0, 50) }))
      .slice(0, 12)
  );
  console.log(JSON.stringify(caps, null, 2));

  console.log('\n=== All visible buttons ===');
  const allBtns = await page.$$eval('button', els =>
    els
      .filter(e => e.offsetParent !== null && (e.textContent || '').trim().length > 0 && (e.textContent || '').trim().length < 80)
      .map(e => ({ text: (e.textContent || '').trim().slice(0, 70) }))
      .slice(0, 60)
  );
  console.log(JSON.stringify(allBtns, null, 2));

  console.log('\n=== Video elements ===');
  const videos = await page.$$eval('video', els =>
    els.map(e => ({ src: e.src, currentSrc: e.currentSrc, readyState: e.readyState, paused: e.paused, muted: e.muted, currentTime: e.currentTime }))
  );
  console.log(JSON.stringify(videos, null, 2));

  console.log('\n=== Canvas elements ===');
  const canvases = await page.$$eval('canvas', els =>
    els.map(e => ({ width: e.width, height: e.height, id: e.id, className: e.className?.slice(0, 60) }))
  );
  console.log(JSON.stringify(canvases, null, 2));

  console.log('\n=== Mode toggles / switches ===');
  const switches = await page.$$eval('[role="switch"], button[role="switch"]', els =>
    els
      .filter(e => e.offsetParent !== null)
      .map(e => ({ ariaLabel: e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked'), text: (e.textContent || '').trim().slice(0, 60) }))
  );
  console.log(JSON.stringify(switches, null, 2));

  console.log('\n=== CONSOLE ERRORS ===');
  console.log(JSON.stringify(consoleErrors, null, 2));
  console.log('\n=== PAGE ERRORS ===');
  console.log(JSON.stringify(pageErrors, null, 2));

  await page.screenshot({ path: '/home/z/my-project/scripts/pw-prototype-default.png', fullPage: false });
  console.log('\nScreenshot: scripts/pw-prototype-default.png');

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
