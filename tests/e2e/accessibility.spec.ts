import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const destination of [
  /Overview|Resumen/i,
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

test('supports reduced motion and 200 percent browser zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await page.evaluate(() => { document.body.style.zoom = '200%' })
  await expect(page.getByRole('tab', { name: /Overview|Resumen/i })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  expect(overflow).toBeFalsy()
})
