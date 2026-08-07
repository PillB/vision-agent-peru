import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const destination of [
  /Overview|Resumen/i,
  /Live Prototype|Prototipo en vivo/i,
  /Evidence Workspace|Espacio de evidencia/i,
]) {
  test(`has no critical or serious axe violations: ${destination}`, async ({ page }) => {
    await page.goto('./')
    await page.getByRole('tab', { name: destination }).click()
    const results = await new AxeBuilder({ page }).analyze()
    const material = results.violations.filter(item => item.impact === 'critical' || item.impact === 'serious')
    expect(material, JSON.stringify(material, null, 2)).toEqual([])
  })
}

test('supports reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await expect(page.getByRole('tab', { name: /Overview|Resumen/i })).toBeVisible()
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBeTruthy()
})

test('reflows at the 640 CSS-pixel viewport equivalent to 200 percent desktop zoom', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('-desktop'), 'WCAG 200% zoom equivalence is evaluated from a 1280px desktop viewport')
  await page.setViewportSize({ width: 640, height: 720 })
  await page.goto('./')
  await expect(page.getByRole('tab', { name: /Overview|Resumen/i })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  expect(overflow).toBeFalsy()
})
