import { expect, test } from '@playwright/test'

const runRemoteModels = process.env.RUN_REMOTE_MODELS === 'true'

async function openPrototype(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await expect(page.getByTestId('start-pause-button')).toBeEnabled({ timeout: 240_000 })
}

async function selectUseCase(page: import('@playwright/test').Page, name: RegExp) {
  await page.getByTestId('use-case-trigger').click()
  await page.getByRole('option', { name }).click()
}

async function selectCamera(page: import('@playwright/test').Page, name: RegExp) {
  await page.getByTestId('camera-trigger').click()
  await page.getByRole('option', { name }).click()
}

async function selectOnlyModel(page: import('@playwright/test').Page, label: RegExp) {
  await page.getByRole('button', { name: /Model selection/i }).click()
  const target = page.getByRole('checkbox', { name: label })
  if (!(await target.isChecked())) await target.check()
  const checked = page.locator('input[type="checkbox"]:checked')
  for (let index = (await checked.count()) - 1; index >= 0; index -= 1) {
    const checkbox = checked.nth(index)
    if (!(await checkbox.getAttribute('aria-label'))?.match(label)) await checkbox.uncheck()
  }
  await expect(target).toBeChecked()
}

test('selected COCO-SSD adapter performs browser inference', async ({ page }, testInfo) => {
  test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for remote model runtime validation')
  test.setTimeout(360_000)
  await openPrototype(page)
  await selectUseCase(page, /Intrusión en Zona Restringida/i)
  await selectCamera(page, /\[Static\] Intersección/i)
  await selectOnlyModel(page, /COCO-SSD/i)
  await page.getByTestId('start-pause-button').click()
  await expect(page.getByText(/Object detector \[coco-ssd\]: \d+ detections/i).first()).toBeVisible({ timeout: 180_000 })
  await page.screenshot({ path: testInfo.outputPath('coco-ssd-runtime.png'), fullPage: true })
})

test('selected YOLOv8 pose adapter performs browser inference', async ({ page }, testInfo) => {
  test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for remote model runtime validation')
  test.setTimeout(480_000)
  await openPrototype(page)
  await selectUseCase(page, /Resbalón y Superficie Mojada/i)
  await selectCamera(page, /\[Static\] Noche Niebla/i)
  await selectOnlyModel(page, /YOLOv8n-Pose/i)
  await page.getByTestId('start-pause-button').click()
  const trace = page.getByText(/HF Model \[YOLOv8n-Pose fall geometry\]:/i).first()
  await expect(trace).toBeVisible({ timeout: 300_000 })
  await expect(trace).not.toContainText(/unavailable|inference error|timed out/i)
  await page.screenshot({ path: testInfo.outputPath('yolov8-pose-runtime.png'), fullPage: true })
})
