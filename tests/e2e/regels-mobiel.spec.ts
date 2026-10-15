// P06 op de telefoon: regels en matrix openen met "Beter op een groot scherm", zonder horizontale scroll.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

for (const pad of ['/instellingen/regels', '/instellingen/ritme']) {
  test(`${pad} op de telefoon`, async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, pad)
    await expect(page.locator('.alleen-groot-melding')).toContainText('Beter op een groot scherm')
    const breed = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(breed).toBeLessThanOrEqual(0)
  })
}
