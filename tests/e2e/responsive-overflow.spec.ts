import { expect, test, type Page } from '@playwright/test'

type ViewportCase = {
  name: string
  width: number
  height: number
  project: 'chromium-desktop' | 'webkit-desktop'
}

const VIEWPORTS: ViewportCase[] = [
  { name: 'Android compact portrait', width: 360, height: 800, project: 'chromium-desktop' },
  { name: 'Android standard portrait', width: 412, height: 915, project: 'chromium-desktop' },
  { name: 'iPhone 13 Pro portrait', width: 390, height: 844, project: 'webkit-desktop' },
  { name: 'iPhone 13 Pro landscape', width: 844, height: 390, project: 'webkit-desktop' },
  { name: 'iPad mini portrait', width: 768, height: 1024, project: 'webkit-desktop' },
  { name: 'iPad Pro 11 landscape', width: 1194, height: 834, project: 'webkit-desktop' },
]

async function expectNoUncontainedOverflow(page: Page, context: string) {
  const audit = await page.evaluate(() => {
    const tolerance = 2
    const viewportWidth = document.documentElement.clientWidth
    const describe = (element: Element) => {
      const html = element as HTMLElement
      const testId = html.dataset.testid ? `[data-testid="${html.dataset.testid}"]` : ''
      const id = html.id ? `#${html.id}` : ''
      const classes = typeof html.className === 'string'
        ? html.className.split(/\s+/).filter(Boolean).slice(0, 3).map(name => `.${name}`).join('')
        : ''
      return `${html.tagName.toLowerCase()}${id}${testId}${classes}`
    }
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    const elements = [...document.body.querySelectorAll<HTMLElement>('*')].filter(visible)
    const offenders = elements.filter(element => {
      if (element.closest('[data-allow-horizontal-scroll="true"]')) return false
      const rect = element.getBoundingClientRect()
      return rect.left < -tolerance || rect.right > viewportWidth + tolerance
    }).slice(0, 12).map(describe)
    const unexpectedScrollers = elements.filter(element => {
      if (element.dataset.allowHorizontalScroll === 'true') return false
      const overflowX = getComputedStyle(element).overflowX
      return ['auto', 'scroll'].includes(overflowX) && element.scrollWidth > element.clientWidth + tolerance
    }).slice(0, 12).map(describe)

    return {
      rootDelta: document.documentElement.scrollWidth - viewportWidth,
      bodyDelta: document.body.scrollWidth - viewportWidth,
      offenders,
      unexpectedScrollers,
    }
  })

  expect(audit, `${context}: ${JSON.stringify(audit, null, 2)}`).toEqual({
    rootDelta: 0,
    bodyDelta: 0,
    offenders: [],
    unexpectedScrollers: [],
  })
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} has no uncontained horizontal overflow`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== viewport.project, `Validated in ${viewport.project}`)
    test.setTimeout(120_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('./')

    for (const destination of [
      /Overview|Resumen/i,
      /Strategic Brief|Informe estratégico/i,
      /Live Prototype|Prototipo en vivo/i,
      /Evidence Workspace|Espacio de evidencia/i,
    ]) {
      await page.getByRole('tab', { name: destination }).click()
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      await expectNoUncontainedOverflow(page, `${viewport.name} · ${destination}`)
    }

    await page.getByRole('tab', { name: /Live Prototype|Prototipo en vivo/i }).click()
    await page.getByRole('button', { name: 'Open split comparison' }).click()
    await expect(page.getByTestId('flow-split-comparison')).toBeVisible()
    await expectNoUncontainedOverflow(page, `${viewport.name} · expanded decision comparison`)

    await page.getByRole('tab', { name: /Evidence Workspace|Espacio de evidencia/i }).click()
    const evidenceNav = page.getByRole('navigation', { name: 'Evidence destinations' })
    for (const destination of [
      'System & Session',
      'Analyze Videos',
      'Search Evidence',
      'Associations & Timeline',
      'Incidents & Actions',
      'Models & Governance',
    ]) {
      await evidenceNav.getByRole('button', { name: destination }).click()
      await expectNoUncontainedOverflow(page, `${viewport.name} · ${destination}`)
    }
  })
}
