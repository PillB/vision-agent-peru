import { expect, test } from '@playwright/test'

const runRemoteModels = process.env.RUN_REMOTE_MODELS === 'true'

const USE_CASE_RUNTIME_MATRIX = [
  { useCase: /Intrusión en Zona Restringida/i, camera: /\[Static\] Intersección/i, slug: 'intrusion' },
  { useCase: /Intrusión Vehicular Fuera de Horario/i, camera: /\[Static\] Estacionamiento/i, slug: 'after-hours' },
  { useCase: /Avalancha de Multitud/i, camera: /\[Static\] Intersección/i, slug: 'crowd-surge' },
  { useCase: /Estacionamiento — Espacios Disponibles/i, camera: /\[Static\] Estacionamiento/i, slug: 'parking' },
  { useCase: /Anomalía de Cola en Cajeros/i, camera: /\[Static\] Cola/i, slug: 'queue-anomaly' },
  { useCase: /Objeto Abandonado/i, camera: /\[Static\] Mochila/i, slug: 'abandoned-object' },
  { useCase: /Grafiti y Vandalismo/i, camera: /\[Static\] Grafiti/i, slug: 'graffiti' },
  { useCase: /Fuego y Humo/i, camera: /\[Static\] Fuego y Humo/i, slug: 'fire-smoke' },
  { useCase: /Resbalón y Superficie Mojada/i, camera: /\[Static\] Inundación/i, slug: 'slip-hazard' },
  { useCase: /Descripción Automática de Incidentes/i, camera: /\[Static\] Intersección/i, slug: 'incident-description' },
  { useCase: /Reporte Auto-Generado/i, camera: /\[Static\] Intersección/i, slug: 'auto-report' },
  { useCase: /Memoria Visual — Incidentes Similares/i, camera: /\[Static\] Intersección/i, slug: 'visual-memory' },
  { useCase: /Vigilancia de Inundación/i, camera: /\[Static\] Inundación/i, slug: 'flood-watch' },
  { useCase: /Vigilancia de Deslizamiento/i, camera: /\[Static\] Escombros/i, slug: 'landslide-watch' },
  { useCase: /Escanéo Post-Sismo/i, camera: /\[Static\] Grieta/i, slug: 'post-quake' },
] as const

test('every advertised use case executes a real inference cycle on a representative fixture', async ({ page }, testInfo) => {
  test.skip(!runRemoteModels, 'Set RUN_REMOTE_MODELS=true for real use-case runtime validation')
  test.setTimeout(900_000)
  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await expect(page.getByTestId('start-pause-button')).toBeEnabled({ timeout: 240_000 })

  const runtimeStart = Number(process.env.USE_CASE_RUNTIME_START || 0)
  const runtimeLimit = Number(process.env.USE_CASE_RUNTIME_LIMIT || USE_CASE_RUNTIME_MATRIX.length)
  for (const scenario of USE_CASE_RUNTIME_MATRIX.slice(runtimeStart, runtimeStart + runtimeLimit)) {
    await page.getByTestId('use-case-trigger').click()
    await page.getByRole('option', { name: scenario.useCase }).click()
    await page.getByTestId('camera-trigger').click()
    await page.getByRole('option', { name: scenario.camera }).click()
    await expect(page.getByText(/model ready/i).first()).toBeVisible({ timeout: 300_000 })

    const cycle = page.getByTestId('agent-cycle-count')
    const before = await cycle.textContent()
    const startPause = page.getByTestId('start-pause-button')
    await startPause.evaluate((button: HTMLButtonElement) => button.click())
    await expect(cycle).not.toHaveText(before ?? '', { timeout: 300_000 })
    await startPause.evaluate((button: HTMLButtonElement) => button.click(), undefined, { timeout: 60_000 })
    await expect(startPause).toHaveText(/Start analysis/i, { timeout: 60_000 })
    await expect(page.getByText(/inference error|timed out|load_failed/i)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`${scenario.slug}.png`), fullPage: true })
  }
})

test('every use case exposes working model and capability controls', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()

  const useCaseTrigger = page.getByTestId('use-case-trigger')
  await useCaseTrigger.click()
  const useCaseCount = await page.getByRole('option').count()
  await page.keyboard.press('Escape')
  expect(useCaseCount).toBeGreaterThan(0)

  for (let index = 0; index < useCaseCount; index += 1) {
    await useCaseTrigger.click()
    const option = page.getByRole('option').nth(index)
    const optionText = (await option.innerText()).trim()
    await option.click()
    await expect(useCaseTrigger).toContainText(optionText.split('\n')[0])

    const modelButton = page.getByRole('button', { name: /Model selection/i })
    if (await modelButton.count()) {
      await modelButton.click()
      const enabledModels = page.locator('input[type="checkbox"]:enabled')
      const enabledCount = await enabledModels.count()
      expect(enabledCount).toBeGreaterThan(0)
      for (let modelIndex = 0; modelIndex < enabledCount; modelIndex += 1) {
        const checkbox = enabledModels.nth(modelIndex)
        const initiallyChecked = await checkbox.isChecked()
        if (!initiallyChecked) {
          await checkbox.check()
          await expect(checkbox).toBeChecked()
          await checkbox.uncheck()
          await expect(checkbox).not.toBeChecked()
        }
      }
      await modelButton.click()
    }
  }

  for (const title of ['Traditional Rules', 'ML / Deep Learning', 'Cognitive / GenAI', 'Agentic AI']) {
    const button = page.getByTitle(title)
    await button.click()
    await expect(button).toHaveClass(/text-white/)
  }

  const judgeSwitch = page.getByRole('switch', { name: /Enable optional LLM judge/i })
  await judgeSwitch.click()
  await expect(judgeSwitch).toHaveAttribute('data-state', 'unchecked')
  await judgeSwitch.click()
  await expect(judgeSwitch).toHaveAttribute('data-state', 'checked')

  await page.screenshot({ path: testInfo.outputPath('prototype-controls.png'), fullPage: true })
})

test('evidence workspace experimental toggle and destinations render', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.getByRole('tab', { name: /Evidence Workspace|Espacio de evidencia/i }).click()
  await page.getByRole('button', { name: 'Analyze Videos' }).click()
  const experimental = page.getByLabel(/Experimental CLIP embeddings/i)
  await experimental.check()
  await expect(experimental).toBeChecked()
  await experimental.uncheck()
  await expect(experimental).not.toBeChecked()

  const navigation = page.getByRole('navigation', { name: 'Evidence destinations' })
  for (const destination of ['System & Session', 'Analyze Videos', 'Search Evidence', 'Associations & Timeline', 'Incidents & Actions', 'Models & Governance']) {
    await navigation.getByRole('button', { name: destination }).click()
  }
  await page.screenshot({ path: testInfo.outputPath('evidence-workspace-controls.png'), fullPage: true })
})

test('prototype capability, judge, and three-model selection combinations remain operable', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await page.getByTestId('use-case-trigger').click()
  await page.getByRole('option', { name: /Intrusión en Zona Restringida/i }).click()

  const judge = page.getByRole('switch', { name: /Enable optional LLM judge/i })
  for (const capability of ['Traditional Rules', 'ML / Deep Learning', 'Cognitive / GenAI', 'Agentic AI']) {
    const capabilityButton = page.getByTitle(capability)
    await capabilityButton.click()
    for (const enabled of [false, true]) {
      if ((await judge.getAttribute('data-state')) !== (enabled ? 'checked' : 'unchecked')) await judge.click()
      await expect(capabilityButton).toHaveClass(/text-white/)
      await expect(judge).toHaveAttribute('data-state', enabled ? 'checked' : 'unchecked')
      await expect(page.getByTestId('llm-judge-state')).toHaveText(enabled ? 'Enabled' : 'Disabled')
      await page.screenshot({
        path: testInfo.outputPath(`capability-${capability.toLowerCase().replace(/[^a-z]+/g, '-')}-judge-${enabled ? 'on' : 'off'}.png`),
      })
    }
  }

  const modelButton = page.getByRole('button', { name: /Model selection/i })
  const modelLabels = [/COCO-SSD/i, /YOLOv10-nano/i, /YOLOS-tiny/i]
  for (let mask = 1; mask < 8; mask += 1) {
    await modelButton.click()
    for (let index = 0; index < modelLabels.length; index += 1) {
      const checkbox = page.getByRole('checkbox', { name: modelLabels[index] })
      if ((mask & (1 << index)) !== 0 && !(await checkbox.isChecked())) await checkbox.check()
    }
    for (let index = 0; index < modelLabels.length; index += 1) {
      const checkbox = page.getByRole('checkbox', { name: modelLabels[index] })
      if ((mask & (1 << index)) === 0 && await checkbox.isChecked()) await checkbox.uncheck()
    }
    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(modelLabels.filter((_, index) => (mask & (1 << index)) !== 0).length)
    await page.screenshot({ path: testInfo.outputPath(`model-combination-${mask.toString(2).padStart(3, '0')}.png`) })
    await modelButton.click()
  }
})

test('evidence destinations render with experimental embeddings both disabled and enabled', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.getByRole('tab', { name: /Evidence Workspace|Espacio de evidencia/i }).click()
  const navigation = page.getByRole('navigation', { name: 'Evidence destinations' })
  const destinations = ['System & Session', 'Analyze Videos', 'Search Evidence', 'Associations & Timeline', 'Incidents & Actions', 'Models & Governance']
  for (const enabled of [false, true]) {
    await navigation.getByRole('button', { name: 'Analyze Videos' }).click()
    const experimental = page.getByLabel(/Experimental CLIP embeddings/i)
    if ((await experimental.isChecked()) !== enabled) await experimental.setChecked(enabled)
    for (const destination of destinations) {
      await navigation.getByRole('button', { name: destination }).click()
      await expect(navigation.getByRole('button', { name: destination })).toHaveAttribute('aria-current', 'page')
      await page.screenshot({
        path: testInfo.outputPath(`evidence-${destination.toLowerCase().replace(/[^a-z]+/g, '-')}-clip-${enabled ? 'on' : 'off'}.png`),
      })
    }
  }
})
