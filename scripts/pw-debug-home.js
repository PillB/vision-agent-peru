/**
 * Investigate the home page error reported in test 1.
 */
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const allConsole = [];
  const allPage = [];
  page.on('console', m => allConsole.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => allPage.push(e.message + '\n' + (e.stack || '')));
  page.on('requestfailed', r => allPage.push(`REQ FAIL: ${r.url()} - ${r.failure()?.errorText}`));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(3000);

  console.log('=== ALL CONSOLE ===');
  console.log(JSON.stringify(allConsole, null, 2));
  console.log('\n=== ALL PAGE ERRORS ===');
  console.log(JSON.stringify(allPage, null, 2));

  await browser.close();
})();
