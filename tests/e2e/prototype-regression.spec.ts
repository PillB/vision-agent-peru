import { expect, test } from '@playwright/test'

test('restores the complete live prototype without replacing the evidence workspace', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url())
  })

  await page.goto('./')
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveCount(4)

  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await expect(page.getByRole('main', { name: 'Live prototype' })).toBeVisible()
  await expect(page.getByTestId('camera-trigger')).toBeVisible()
  await expect(page.getByTestId('start-pause-button')).toBeVisible()
  for (const heading of [
    'Agent reasoning',
    'Alerts & incidents',
    'Appearance Tracks',
    'Action audit trail',
    'Incident reports',
    'Evidence Search',
    'Natural-Language Search',
    'Incident State Machine',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }

  await page.getByRole('tab', { name: /Evidence Workspace|Espacio de evidencia/i }).click()
  await expect(page.getByRole('main', { name: 'Evidence workspace' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Authorized video evidence workspace' })).toBeVisible()

  expect(apiRequests).toEqual([])
  expect(await page.evaluate(() => ({
    visionStore: '__visionStore' in window,
    cocoModel: '__cocoModel' in window,
    tf: '__tf' in window,
    judge: '__visionJudgeInFlight' in window,
  }))).toEqual({ visionStore: false, cocoModel: false, tf: false, judge: false })
})

test('keyboard navigation reaches all four primary destinations', async ({ page }) => {
  await page.goto('./')
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveCount(4)
  await tabs.first().focus()
  for (let index = 1; index < 4; index++) {
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(index)).toBeFocused()
  }
})
