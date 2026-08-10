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

async function startAndCapture(
  page: import('@playwright/test').Page,
  testInfo: import('@playwright/test').TestInfo,
  tracePattern: RegExp,
  screenshotName: string,
  timeout = 300_000,
) {
  await page.getByTestId('start-pause-button').click()
  const trace = page.getByText(tracePattern).first()
  await expect(trace).toBeVisible({ timeout })
  await expect(trace).not.toContainText(/unavailable|inference error|timed out|load_failed/i)
  const pause = page.getByTestId('start-pause-button')
  await pause.click({ force: true, noWaitAfter: true, timeout: 60_000 })
  await expect(pause).toHaveText(/Start analysis/i, { timeout: 60_000 })
  await page.screenshot({ path: testInfo.outputPath(screenshotName), fullPage: true, timeout: 60_000 })
}

for (const detector of [
  { label: /YOLOS-tiny/i, id: 'yolos-tiny', screenshot: 'yolos-tiny-runtime.png' },
  { label: /YOLOv10-nano/i, id: 'yolov10n', screenshot: 'yolov10n-runtime.png' },
]) {
  test(`selected ${detector.id} adapter performs browser inference`, async ({ page }, testInfo) => {
    test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for remote model runtime validation')
    test.setTimeout(360_000)
    await openPrototype(page)
    await selectUseCase(page, /Intrusión en Zona Restringida/i)
    await selectCamera(page, /\[Static\] Intersección/i)
    await selectOnlyModel(page, detector.label)
    await startAndCapture(page, testInfo, new RegExp(`Object detector \\[${detector.id}\\]: \\d+ detections`, 'i'), detector.screenshot, 180_000)
  })
}

test('selected COCO-SSD adapter performs browser inference', async ({ page }, testInfo) => {
  test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for remote model runtime validation')
  test.setTimeout(360_000)
  await openPrototype(page)
  await selectUseCase(page, /Intrusión en Zona Restringida/i)
  await selectCamera(page, /\[Static\] Intersección/i)
  await selectOnlyModel(page, /COCO-SSD/i)
  await startAndCapture(page, testInfo, /Object detector \[coco-ssd\]: \d+ detections/i, 'coco-ssd-runtime.png', 180_000)
})

for (const specialized of [
  {
    name: 'Fire Detection ViT', useCase: /Fuego y Humo/i, camera: /\[Static\] Fuego y Humo/i,
    selector: /Fire Detection ViT/i, trace: /HF Model \[Fire Detection Engine\]:/i, screenshot: 'fire-vit-runtime.png',
  },
  {
    name: 'CLIP fire', useCase: /Fuego y Humo/i, camera: /\[Static\] Fuego y Humo/i,
    selector: /CLIP zero-shot \(Fire\)/i, trace: /HF Model \[Fire \(CLIP zero-shot\)\]:/i, screenshot: 'clip-fire-runtime.png',
  },
  {
    name: 'SegFormer-B0', useCase: /Vigilancia de Inundación/i, camera: /\[Static\] Inundación/i,
    selector: /SegFormer-B0/i, trace: /HF Model \[SegFormer-B0 water segmentation\]:/i, screenshot: 'segformer-runtime.png',
  },
  {
    name: 'CLIP zero-shot', useCase: /Grafiti y Vandalismo/i, camera: /\[Static\] Grafiti/i,
    selector: /CLIP Zero-Shot \(Multi-use\)/i, trace: /HF Model \[Graffiti\/Vandalism \(CLIP zero-shot\)\]:/i, screenshot: 'clip-zero-shot-runtime.png',
  },
]) {
  test(`selected ${specialized.name} adapter performs browser inference`, async ({ page }, testInfo) => {
    test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for remote model runtime validation')
    test.setTimeout(480_000)
    await openPrototype(page)
    await selectUseCase(page, specialized.useCase)
    await selectCamera(page, specialized.camera)
    await selectOnlyModel(page, specialized.selector)
    await startAndCapture(page, testInfo, specialized.trace, specialized.screenshot)
  })
}

test('selected pixel-anomaly adapter executes its use-case-specific detector', async ({ page }, testInfo) => {
  test.skip(!runRemoteModels, 'Run alongside the complete runtime matrix')
  test.setTimeout(180_000)
  await openPrototype(page)
  await selectUseCase(page, /Fuego y Humo/i)
  await selectCamera(page, /\[Static\] Fuego y Humo/i)
  await selectOnlyModel(page, /Pixel Anomaly/i)
  await startAndCapture(page, testInfo, /Pixel anomaly \[fire\]: score=/i, 'pixel-anomaly-runtime.png', 60_000)
})

test('selected YOLOv8 pose adapter performs browser inference', async ({ page }, testInfo) => {
  test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for remote model runtime validation')
  test.setTimeout(480_000)
  await openPrototype(page)
  await selectUseCase(page, /Resbalón y Superficie Mojada/i)
  await selectCamera(page, /\[Static\] Noche Niebla/i)
  await selectOnlyModel(page, /YOLOv8n-Pose/i)
  await startAndCapture(page, testInfo, /HF Model \[YOLOv8n-Pose fall geometry\]:/i, 'yolov8-pose-runtime.png')
})
