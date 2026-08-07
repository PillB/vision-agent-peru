import { expect, test } from '@playwright/test'

async function openWorkspace(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.getByRole('tab', { name: /Evidence Workspace|Espacio de evidencia/i }).click()
  await expect(page.getByRole('main', { name: 'Evidence workspace' })).toBeVisible()
}

test('six task destinations are visible and keyboard operable', async ({ page }) => {
  await openWorkspace(page)
  const navigation = page.getByRole('navigation', { name: 'Evidence destinations' })
  for (const label of ['System & Session', 'Analyze Videos', 'Search Evidence', 'Associations & Timeline', 'Incidents & Actions', 'Models & Governance']) {
    await expect(navigation.getByRole('button', { name: label })).toBeVisible()
  }
  await navigation.getByRole('button', { name: 'Analyze Videos' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Upload and capability check' })).toBeVisible()
})

test('labeled simulation supports visible search, near misses, association, and human confirmation', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Analyze Videos' }).click()
  await page.getByRole('button', { name: 'Load labeled simulation evidence' }).click()
  await expect(page.getByText(/Labeled simulation evidence loaded/i)).toBeVisible()

  await page.getByRole('button', { name: 'Search Evidence' }).click()
  const query = page.getByLabel('Describe observable evidence')
  await query.fill('person blue red backpack walking extra')
  await page.getByLabel(/Threshold/).fill('0.9')
  await page.getByRole('button', { name: 'Search local evidence' }).click()
  await expect(page.getByText(/candidate\(s\), .*near miss/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Near misses' })).toBeVisible()

  await page.getByRole('button', { name: 'Associations & Timeline' }).click()
  await page.getByRole('button', { name: 'Propose from embedded crops' }).click()
  await expect(page.getByRole('heading', { name: /Plausible cross-video association/ }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Human confirm' }).first().click()
  await expect(page.getByRole('heading', { name: /Human-confirmed association/ }).first()).toBeVisible()
})

test('visible review supports rejection and safe absence language', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Analyze Videos' }).click()
  await page.getByRole('button', { name: 'Load labeled simulation evidence' }).click()
  await expect(page.getByText(/Labeled simulation evidence loaded/i)).toBeVisible()

  await page.getByRole('button', { name: 'Associations & Timeline' }).click()
  await page.getByRole('button', { name: 'Propose from embedded crops' }).click()
  await page.getByRole('button', { name: 'Reject' }).first().click()
  await expect(page.getByRole('heading', { name: /Rejected association/ }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Search Evidence' }).click()
  await page.getByRole('button', { name: 'Assess analyzed coverage' }).click()
  await expect(page.getByText(/No candidate exceeded the validated threshold within the analyzed coverage\./i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /inconclusive/i })).toBeVisible()
})

test('corrupted video is rejected through the visible upload control', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Analyze Videos' }).click()
  await page.getByLabel('Authorized videos').setInputFiles({
    name: 'corrupted.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('not a video'),
  })
  await expect(page.getByRole('region', { name: 'Upload and capability check' }).getByRole('alert')).toContainText(/failed decoding metadata/i)
  await expect(page.getByRole('button', { name: 'Approve and analyze locally' })).toBeDisabled()
})

test('sensitive and research-only traits are rejected through the visible search', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Search Evidence' }).click()
  await page.getByLabel('Describe observable evidence').fill('find a young woman by race and gait')
  await page.getByRole('button', { name: 'Search local evidence' }).click()
  await expect(page.getByRole('region', { name: 'Natural-language and reference search' }).getByRole('alert')).toContainText(/Query rejected/i)
})

test('false-positive simulation proves no downstream action executes', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Incidents & Actions' }).click()
  await page.getByRole('button', { name: 'Run labeled false-positive simulation' }).click()
  await expect(page.getByText(/false-positive verdict closed the incident before report, email, or escalation execution/i)).toBeVisible()
  await expect(page.getByText(/close · incident · blocked/i)).toBeVisible()
  await expect(page.getByText(/execute · escalate · started/i)).toHaveCount(0)
  await expect(page.getByText(/execute · send_email · started/i)).toHaveCount(0)
})

test('IndexedDB failure is visible and disables analysis approval', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }))
  await openWorkspace(page)
  await expect(page.getByText(/IndexedDB.*unavailable/i)).toBeVisible()
  await page.getByRole('button', { name: 'Analyze Videos' }).click()
  await expect(page.getByRole('button', { name: 'Approve and analyze locally' })).toBeDisabled()
})

test('WebGPU absence reports the expected WASM fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }))
  await openWorkspace(page)
  await expect(page.getByText(/absent — WASM fallback required/i)).toBeVisible()
})
