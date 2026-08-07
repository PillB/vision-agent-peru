import { expect, test } from '@playwright/test'

test('captures every visible destination of the pre-rebuild live site', async ({ page }, testInfo) => {
  const response = await page.goto('./', { waitUntil: 'domcontentloaded' })
  expect(response?.ok()).toBeTruthy()
  await expect(page.getByRole('heading').first()).toBeVisible()

  const tabs = page.getByRole('tab')
  const count = await tabs.count()
  expect(count).toBeGreaterThanOrEqual(3)

  for (let index = 0; index < count; index += 1) {
    const tab = tabs.nth(index)
    const name = (await tab.innerText()).trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await page.screenshot({ path: testInfo.outputPath(`${index + 1}-${name || 'destination'}.png`), fullPage: true })
  }

  await testInfo.attach('live-page-text', {
    body: await page.locator('body').innerText(),
    contentType: 'text/plain',
  })
})
