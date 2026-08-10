import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('device camera visibly transitions to live and stops its track when disabled', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => {
    const state: { requests: number; track: MediaStreamTrack | null } = { requests: 0, track: null }
    Object.defineProperty(window, '__cameraTestState', { value: state })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          state.requests += 1
          const canvas = document.createElement('canvas')
          canvas.width = 320
          canvas.height = 180
          const context = canvas.getContext('2d')!
          let frame = 0
          window.setInterval(() => {
            context.fillStyle = frame++ % 2 ? '#111827' : '#1f2937'
            context.fillRect(0, 0, canvas.width, canvas.height)
          }, 100)
          const stream = canvas.captureStream(5)
          state.track = stream.getVideoTracks()[0] ?? null
          return stream
        },
      },
    })
  })

  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await page.getByTestId('use-case-trigger').click()
  await page.getByRole('option', { name: /Intrusión en Zona Restringida/i }).click()
  await page.getByTestId('camera-trigger').click()
  await page.getByRole('option', { name: /Device Camera/i }).click()

  const cameraToggle = page.getByTestId('device-camera-toggle')
  await expect(cameraToggle).toHaveText(/Enable camera/i)
  await cameraToggle.click()
  await expect(cameraToggle).toHaveText(/Disable camera/i)
  await expect(page.getByTestId('device-camera-status')).toHaveText(/Camera: live/i)
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __cameraTestState: { requests: number } }).__cameraTestState.requests)).toBe(1)
  await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).videoWidth)).toBeGreaterThan(0)

  const ownerPanel = page.getByTestId('owner-verification')
  await expect(ownerPanel).toBeVisible()
  const consent = page.getByRole('checkbox', { name: /Consent to local owner face verification/i })
  const capture = page.getByRole('button', { name: /Capture enrollment 1\/3/i })
  await expect(capture).toBeDisabled()
  await consent.check()
  await expect(capture).toBeEnabled()
  await capture.click()
  await expect(page.getByTestId('owner-verification-status')).toContainText(/Expected exactly one high-quality face; found 0/i, { timeout: 180_000 })
  await page.screenshot({ path: testInfo.outputPath('owner-verification-no-face.png'), fullPage: true })
  await consent.evaluate((checkbox: HTMLInputElement) => checkbox.click())
  await expect(page.getByTestId('owner-verification-status')).toContainText(/deleted/i)

  await cameraToggle.click()
  await expect(page.getByTestId('device-camera-status')).toHaveText(/Camera: idle/i)
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __cameraTestState: { track: MediaStreamTrack | null } }
  ).__cameraTestState.track?.readyState)).toBe('ended')
  await page.screenshot({ path: testInfo.outputPath('device-camera-paused.png'), fullPage: true })
})

test('owner can enroll three local face samples and verify one-to-one without persistence', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  const sample = readFileSync(resolve(process.cwd(), 'node_modules/@vladmandic/face-api/demo/sample3.jpg')).toString('base64')
  const alternateSample = readFileSync(resolve(process.cwd(), 'node_modules/@vladmandic/face-api/demo/sample6.jpg')).toString('base64')
  await page.addInitScript(async ({ sampleData, alternateSampleData }) => {
    const crop = { alternate: false }
    Object.defineProperty(window, '__ownerFaceCrop', { value: crop })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const image = new Image()
          image.src = `data:image/jpeg;base64,${sampleData}`
          const alternateImage = new Image()
          alternateImage.src = `data:image/jpeg;base64,${alternateSampleData}`
          await Promise.all([image.decode(), alternateImage.decode()])
          const canvas = document.createElement('canvas')
          canvas.width = 320
          canvas.height = 360
          const context = canvas.getContext('2d')!
          const draw = () => crop.alternate
            ? context.drawImage(alternateImage, 0, 120, 650, 900, 0, 0, canvas.width, canvas.height)
            : context.drawImage(image, 850, 80, 500, 680, 0, 0, canvas.width, canvas.height)
          draw()
          window.setInterval(draw, 100)
          return canvas.captureStream(5)
        },
      },
    })
  }, { sampleData: sample, alternateSampleData: alternateSample })

  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await page.getByTestId('use-case-trigger').click()
  await page.getByRole('option', { name: /Intrusión en Zona Restringida/i }).click()
  await page.getByTestId('camera-trigger').click()
  await page.getByRole('option', { name: /Device Camera/i }).click()
  const cameraToggle = page.getByTestId('device-camera-toggle')
  await cameraToggle.click()
  await expect(page.getByTestId('device-camera-status')).toHaveText(/Camera: live/i)
  await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).videoWidth)).toBeGreaterThan(0)

  await page.getByRole('checkbox', { name: /Consent to local owner face verification/i }).check()
  for (const sampleNumber of [1, 2, 3]) {
    const capture = page.getByRole('button', { name: new RegExp(`Capture enrollment ${sampleNumber}\\/3`, 'i') })
    await capture.click()
    await expect(page.getByTestId('owner-verification-status')).toContainText(
      sampleNumber < 3 ? new RegExp(`sample ${sampleNumber}\\/3 captured`, 'i') : /template enrolled locally/i,
      { timeout: 180_000 },
    )
  }
  await page.getByRole('button', { name: /Verify owner/i }).click()
  await expect(page.getByTestId('owner-verification-status')).toContainText(/Owner match · distance/i, { timeout: 180_000 })
  await page.screenshot({ path: testInfo.outputPath('owner-verification-match.png'), fullPage: true })
  await page.evaluate(() => {
    (window as typeof window & { __ownerFaceCrop: { alternate: boolean } }).__ownerFaceCrop.alternate = true
  })
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: /Verify owner/i }).click()
  await expect(page.getByTestId('owner-verification-status')).toContainText(/Not verified · distance/i, { timeout: 60_000 })
  await page.screenshot({ path: testInfo.outputPath('owner-verification-reject.png'), fullPage: true })
  await page.getByRole('button', { name: /Delete template/i }).click()
  await expect(page.getByTestId('owner-verification-status')).toContainText(/deleted/i)
  await cameraToggle.click()
  await expect(page.getByTestId('device-camera-status')).toHaveText(/Camera: idle/i)
})

test('device camera permission failure is visible and does not claim a live session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError') } },
    })
  })

  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await page.getByTestId('use-case-trigger').click()
  await page.getByRole('option', { name: /Intrusión en Zona Restringida/i }).click()
  await page.getByTestId('camera-trigger').click()
  await page.getByRole('option', { name: /Device Camera/i }).click()
  const cameraToggle = page.getByTestId('device-camera-toggle')
  await cameraToggle.click()

  await expect(page.getByTestId('device-camera-status')).toHaveText(/Camera: denied/i)
  await expect(page.getByTestId('device-camera-status')).not.toHaveText(/live/i)
})
