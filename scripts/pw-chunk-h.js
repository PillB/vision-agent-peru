/**
 * Chunk H: Test 13 — locale switch + final stability check.
 */
const path = require('path');
const H = require('./pw-helpers.js');

(async () => {
  const report = H.loadReport();
  const browser = await H.makeBrowser();

  // ───────── Test 13: Locale switch ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 13: Locale switch ES → EN');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      // The locale switcher is a single toggle button labeled with the current
      // locale (e.g., "Español"). Clicking it POSTs to /api/set-locale and
      // triggers a full page reload.
      const beforeText = await page.evaluate(() => document.body.textContent.slice(0, 200));
      const hasSpanishIndicator = /Solución|Vista General|Prototipo|Estrategia/i.test(beforeText);

      // Click the language button via evaluate
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const lang = btns.find(b => /^(Español|English)$/i.test((b.textContent || '').trim()));
        if (lang) { lang.click(); return true; }
        return false;
      });
      if (!clicked) {
        H.recordTest(report, '13. Locale switch toggle', 'fail', { note: 'Language button not found' });
      } else {
        // Wait for the page reload (the locale switcher calls window.location.reload())
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(2000);
        // After toggle, the button label should have changed.
        // If it was "Español" before (current=en, switch to es-PE), it should
        // now be "English" (current=es-PE, switch to en). And vice versa.
        const afterButtonLabel = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const lang = btns.find(b => /^(Español|English)$/i.test((b.textContent || '').trim()));
          return lang ? (lang.textContent || '').trim() : null;
        });
        const afterText = await page.evaluate(() => document.body.textContent.slice(0, 200));
        const switched = afterButtonLabel && afterButtonLabel !== 'Español'; // was Español, now English
        await page.screenshot({ path: path.join(H.SHOT_DIR, '13-locale-toggled.png'), fullPage: false });
        H.recordTest(report, '13. Locale switch toggle', switched ? 'pass' : 'fail', {
          note: switched ? `OK — button label changed to "${afterButtonLabel}"` : `Button label after toggle: ${afterButtonLabel}`,
          beforeButton: 'Español',
          afterButton: afterButtonLabel,
          afterSnippet: afterText.slice(0, 100),
        });
      }
    } catch (e) {
      H.recordTest(report, '13. Locale switch to English', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  // ───────── Test 14: 30s stability ─────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = await H.attachErrorCollectors(page);
    try {
      H.log('Test 14: 30s stability run');
      await page.goto(H.BASE, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await H.clickTab(page, 'prototype');
      await page.waitForTimeout(3000);
      const ready = await H.waitForModelReady(page, 60_000);
      if (!ready) throw new Error('Model not ready');

      await H.startAnalysis(page);
      // 30s run with periodic checks
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(10_000);
        const state = await H.readPrototypeState(page);
        H.log(`  10s tick #${i + 1}: isRunning=${state.isRunning}, hits=${state.hitsCount}, actions=${state.actionLogCount}`);
      }
      await page.screenshot({ path: path.join(H.SHOT_DIR, '14-stability-30s.png'), fullPage: false });
      const state = await H.readPrototypeState(page);
      const pass = errors.page.length === 0 && state.isRunning === true;
      H.recordTest(report, '14. 30s stability run', pass ? 'pass' : 'fail', {
        note: `page errors=${errors.page.length}, isRunning=${state.isRunning}, hits=${state.hitsCount}, actions=${state.actionLogCount}`,
        state,
      });
      await H.pauseAnalysis(page);
    } catch (e) {
      H.recordTest(report, '14. 30s stability run', 'fail', { note: e.message });
    }
    await ctx.close();
  }

  H.saveReport(report);
  await browser.close();
  H.log('Chunk H done.');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
