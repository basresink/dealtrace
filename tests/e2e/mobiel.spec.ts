import { expect, test } from '@playwright/test'
import { login } from './hulp'

for (const pad of ['/', '/notificaties', '/mij', '/mijn-instellingen', '/prospects']) {
  test(`geen horizontale scroll op ${pad}`, async ({ page }) => {
    await login(page, 'u-02')
    await page.goto(pad)
    await page.waitForLoadState('networkidle')
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(over).toBeLessThanOrEqual(0)
  })
}

test('beheerder: gebruikers en instellingen zonder horizontale scroll', async ({ page }) => {
  await login(page, 'u-06')
  for (const pad of ['/instellingen', '/instellingen/gebruikers', '/instellingen/organisatie']) {
    await page.goto(pad)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  }
  await expect(page.locator('.alleen-groot-melding')).toHaveCount(0)
})

test('tikvlakken in de zijbalk zijn minstens 44 px', async ({ page }) => {
  await login(page, 'u-02')
  // Ingeklapte items (Nog niet aangezet) zijn verborgen en tellen niet mee.
  const hoogtes = await page.locator('.sb-nav .sb-link:visible').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  for (const h of hoogtes) expect(h).toBeGreaterThanOrEqual(44)
})
