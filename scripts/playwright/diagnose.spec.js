/**
 * Diagnostic test — captures the model loading status and any errors
 * that appear when the prototype tab loads.
 *
 * This test was added to diagnose the "Model load failed" error reported
 * on the live site. It captures:
 *   - Console messages (errors + warnings)
 *   - Page errors (uncaught exceptions)
 *   - The model status text shown in the UI over 60 seconds
 *   - Network requests that failed
 */

const { test, expect } = require('playwright/test')

const BASE = process.env.BASE_URL || 'http://localhost:3000'

test('diagnose model load status over 60 seconds', async ({ page }) => {
  test.setTimeout(120_000)

  const consoleMessages = []
  const pageErrors = []
  const failedRequests = []

  page.on('console', (msg) => {
    const text = msg.text()
    consoleMessages.push({ type: msg.type(), text })
    if (msg.type() === 'error' || /model|coco|tfjs|webgl|wasm/i.test(text)) {
      console.log(`  [console.${msg.type()}] ${text.slice(0, 300)}`)
    }
  })
  page.on('pageerror', (e) => {
    pageErrors.push(e.message)
    console.log(`  [pageerror] ${e.message.slice(0, 300)}`)
  })
  page.on('requestfailed', (req) => {
    const url = req.url()
    // Filter out expected failures (favicon, etc.)
    if (!/favicon|\.ico$/.test(url)) {
      failedRequests.push({ url, failure: req.failure()?.errorText })
      console.log(`  [requestfailed] ${url} — ${req.failure()?.errorText}`)
    }
  })

  console.log('Navigating to', BASE)
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // Click prototype tab
  const tab = page.getByRole('tab', { name: /Prototipo|Prototype/i }).first()
  await tab.click()
  console.log('Clicked prototype tab, waiting 5s for mount...')
  await page.waitForTimeout(5000)

  // Read model status from UI every 5 seconds for 60 seconds
  for (let i = 0; i < 12; i++) {
    const statusText = await page.locator('body').textContent() || ''
    // Extract the model status indicator
    const loadingMatch = statusText.match(/loading/i)
    const readyMatch = statusText.match(/ready/i)
    const errorMatch = statusText.match(/Model load failed|failed/i)

    let status = 'unknown'
    if (errorMatch) status = 'ERROR'
    else if (readyMatch) status = 'ready'
    else if (loadingMatch) status = 'loading'

    console.log(`  [${i * 5}s] model status: ${status}`)
    if (status === 'ERROR') {
      console.log('  ERROR DETECTED — capturing full status text:')
      // Find the error context
      const errorIdx = statusText.indexOf('Model load failed')
      if (errorIdx >= 0) {
        console.log('  Context:', statusText.slice(Math.max(0, errorIdx - 100), errorIdx + 300))
      }
      // Also capture any error detail shown
      const errorDetail = await page.locator('.text-rose-700, .text-rose-600').first().textContent().catch(() => null)
      if (errorDetail) console.log('  Error detail element:', errorDetail.slice(0, 300))
      break
    }
    if (status === 'ready') {
      console.log('  MODEL READY — success')
      break
    }
    await page.waitForTimeout(5000)
  }

  // Also check the dev store hook for the error message (dev only)
  if (BASE.includes('localhost')) {
    const storeErr = await page.evaluate(() => {
      const s = (window).__visionStore?.getState?.()
      return s ? { modelStatus: s.modelStatus, modelError: s.modelError } : null
    }).catch(() => null)
    if (storeErr) console.log('  Store model status:', JSON.stringify(storeErr))
  }

  // Summary
  console.log('\n=== DIAGNOSTIC SUMMARY ===')
  console.log(`Console messages: ${consoleMessages.length}`)
  console.log(`Page errors: ${pageErrors.length}`)
  console.log(`Failed requests: ${failedRequests.length}`)

  const errorMessages = consoleMessages.filter(m => m.type === 'error')
  if (errorMessages.length > 0) {
    console.log('\nError messages:')
    errorMessages.slice(0, 10).forEach(m => console.log(`  - ${m.text.slice(0, 200)}`))
  }

  // Don't fail the test — we're collecting diagnostics
  expect(true).toBe(true)
})
