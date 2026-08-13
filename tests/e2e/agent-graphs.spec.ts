import { expect, test } from '@playwright/test'

async function openPrototype(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
  await expect(page.getByRole('main', { name: 'Live prototype' })).toBeVisible()
}

test('decision map preserves the prototype and exposes all nine inspectable stages', async ({ page }, testInfo) => {
  await openPrototype(page)
  const flow = page.getByTestId('agent-decision-flow')
  await expect(flow).toBeVisible()
  for (const stage of [
    'observe', 'validate_evidence', 'policy', 'judge', 'validate_judge',
    'propose_action', 'approval', 'execute', 'verify_outcome',
  ]) {
    await expect(page.getByTestId(`flow-node-${stage}`)).toBeVisible()
  }

  await page.getByTestId('flow-node-approval').click()
  await expect(flow.getByText('Approval gate', { exact: true }).last()).toBeVisible()
  await expect(page.getByTestId('use-case-comparison')).toBeVisible()
  await page.locator('#flow-compare-use-case').selectOption('post_quake')
  await expect(page.getByTestId('use-case-comparison')).toContainText(/Post-Sismo/i)
  await flow.screenshot({ path: testInfo.outputPath('decision-flow-awaiting-cycle.png') })
})

test('decision map remains contained at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPrototype(page)
  await expect(page.getByTestId('agent-decision-flow')).toBeVisible()
  const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  expect(documentOverflows).toBeFalsy()
})

test('authoritative cycle replay advances through distinct active stages at 500ms sampling', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_REMOTE_MODELS !== 'true', 'Set RUN_REMOTE_MODELS=true for measured inference and animation evidence')
  test.setTimeout(360_000)
  await openPrototype(page)
  await expect(page.getByTestId('start-pause-button')).toBeEnabled({ timeout: 240_000 })
  await page.getByTestId('camera-trigger').click()
  await page.getByRole('option', { name: /\[Static\] Intersección/i }).click()
  await page.getByTestId('start-pause-button').click()
  await expect(page.getByTestId('agent-decision-flow').getByText(/Cycle #[1-9]\d*/)).toBeVisible({ timeout: 180_000 })

  await page.getByRole('button', { name: /Replay cycle/i }).click()
  const observed = new Set<string>()
  const flow = page.getByTestId('agent-decision-flow')
  for (let index = 0; index < 8; index += 1) {
    const active = flow.locator('[data-active="true"]')
    observed.add((await active.getAttribute('data-testid')) ?? 'none')
    await flow.screenshot({ path: testInfo.outputPath(`decision-flow-${String(index).padStart(2, '0')}.png`) })
    await page.waitForTimeout(500)
  }
  expect([...observed].filter(stage => stage !== 'none').length).toBeGreaterThan(1)
})
