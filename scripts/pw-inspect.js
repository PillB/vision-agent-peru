/**
 * Playwright DOM inspection script.
 * Connects to the live dev server at http://localhost:3000,
 * snapshots the homepage structure so we can plan the full
 * test harness.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Playwright/1.61',
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log('→ Navigating to', BASE);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2000);

  console.log('\n=== PAGE TITLE ===');
  console.log(await page.title());

  console.log('\n=== TAB STRUCTURE ===');
  const tabs = await page.$$eval('[role="tab"], [data-tab], button', els =>
    els
      .filter(e => /tab|overview|prototype|brief|estrateg/i.test(e.textContent || ''))
      .map(e => ({ tag: e.tagName, text: (e.textContent || '').trim().slice(0, 80), id: e.id, className: e.className?.slice(0, 60) }))
      .slice(0, 30)
  );
  console.log(JSON.stringify(tabs, null, 2));

  console.log('\n=== HEADINGS ===');
  const headings = await page.$$eval('h1, h2, h3', els =>
    els.map(e => ({ tag: e.tagName, text: (e.textContent || '').trim().slice(0, 100) }))
  );
  console.log(JSON.stringify(headings.slice(0, 30), null, 2));

  console.log('\n=== SELECT DROPDOWNS ===');
  const selects = await page.$$eval('select, [role="combobox"], [role="listbox"]', els =>
    els.map(e => ({ tag: e.tagName, text: (e.textContent || '').trim().slice(0, 100), className: e.className?.slice(0, 60) }))
  );
  console.log(JSON.stringify(selects, null, 2));

  console.log('\n=== BUTTONS (visible) ===');
  const buttons = await page.$$eval('button', els =>
    els
      .filter(e => e.offsetParent !== null)
      .map(e => ({ text: (e.textContent || '').trim().slice(0, 60), id: e.id, className: e.className?.slice(0, 60) }))
      .slice(0, 40)
  );
  console.log(JSON.stringify(buttons, null, 2));

  console.log('\n=== CONSOLE ERRORS ===');
  console.log(consoleErrors.slice(0, 20));

  console.log('\n=== PAGE ERRORS ===');
  console.log(pageErrors.slice(0, 20));

  await page.screenshot({ path: '/home/z/my-project/scripts/pw-inspect-home.png', fullPage: false });
  console.log('\nScreenshot saved: scripts/pw-inspect-home.png');

  await browser.close();
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
