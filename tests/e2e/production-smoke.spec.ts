import { expect, test } from '@playwright/test'

const isRemovedAppApiRoute = (url: string) =>
  /\/(?:vision-agent-peru\/)?api\/(?:alert|report|judge|set-locale|export-pptx(?:-v[23])?)(?:\/|$)/.test(new URL(url).pathname)

test('deployed surface exposes no production hook and makes no removed API request', async ({ page }, testInfo) => {
  const apiRequests: string[] = []
  page.on('request', request => {
    if (isRemovedAppApiRoute(request.url())) apiRequests.push(request.url())
  })

  const response = await page.goto('./')
  expect(response?.ok()).toBeTruthy()
  await expect(page.getByRole('heading').first()).toBeVisible()
  await page.getByRole('tab', { name: /Evidence Workspace|Espacio de evidencia/i }).click()
  await expect(page.getByText(/local-only|solo local/i).first()).toBeVisible()
  const webGpuRow = page.getByText('WebGPU', { exact: true }).locator('..')
  const webGpuText = await webGpuRow.innerText()
  await expect(webGpuRow).toHaveAttribute('data-status', webGpuText.includes('absent') ? 'unavailable' : 'available')
  const deployed = new URL(page.url()).hostname.endsWith('github.io')
  if (deployed) {
    await page.screenshot({ path: testInfo.outputPath('deployed-evidence-workspace.png'), fullPage: true })
  }

  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await expect(page.getByRole('main', { name: 'Live prototype' })).toBeVisible()
  await expect(page.getByTestId('start-pause-button')).toBeVisible()

  await page.getByRole('tab', { name: /Strategic Brief|Resumen estratégico/i }).click()
  if (deployed) {
    await expect(page.getByText(/Unavailable on this static deployment; no request will be sent\./i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Language switching unavailable on static deployment' })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath('deployed-unavailable-actions.png'), fullPage: true })
  }

  const hooks = await page.evaluate(() => ({
    visionStore: '__visionStore' in window,
    cocoModel: '__cocoModel' in window,
    tf: '__tf' in window,
    judge: '__visionJudgeInFlight' in window,
  }))
  expect(hooks).toEqual({ visionStore: false, cocoModel: false, tf: false, judge: false })
  expect(apiRequests).toEqual([])

  await testInfo.attach('network-api-requests', {
    body: JSON.stringify(apiRequests, null, 2),
    contentType: 'application/json',
  })
})

test('keyboard can reach all primary destinations', async ({ page }) => {
  await page.goto('./')
  const tabs = page.getByRole('tab')
  const count = await tabs.count()
  expect(count).toBe(4)
  await tabs.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
})
