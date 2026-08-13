import AxeBuilder from '@axe-core/playwright'
import { chromium, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('popup e superfícies estáticas não apresentam violações críticas ou sérias', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'guardiao-a11y-'))
  const extensionPath = resolve(process.cwd(), 'dist')
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  try {
    let [serviceWorker] = context.serviceWorkers()
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 20_000 })
    const extensionId = new URL(serviceWorker.url()).host
    const page = await context.newPage()

    for (const path of ['src/popup.html', 'src/devtools-panel.html', 'src/report.html']) {
      await page.goto(`chrome-extension://${extensionId}/${path}`)
      await expect(page.locator('#root')).not.toBeEmpty()

      const results = await new AxeBuilder({ page }).analyze()
      const blockingViolations = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      )

      expect(blockingViolations, path).toEqual([])
    }

    await page.goto(`chrome-extension://${extensionId}/src/popup.html`)
    const keyboardFocusOrder: string[] = []
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Tab')
      keyboardFocusOrder.push(
        await page.evaluate(() => {
          const active = document.activeElement
          if (!(active instanceof HTMLElement)) return ''
          return `${active.tagName}:${active.getAttribute('href') || active.getAttribute('aria-label') || active.innerText}`
        }),
      )
    }

    expect(new Set(keyboardFocusOrder.filter(Boolean)).size).toBeGreaterThanOrEqual(4)
    expect(keyboardFocusOrder.slice(0, 4).every((item) => !item.startsWith('BODY:'))).toBe(true)
  } finally {
    await context.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})
