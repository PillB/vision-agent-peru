import { expect, test } from '@playwright/test'

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
