// P05 op de telefoon: fasepil, statuspil en "Terug op" zonder horizontale scroll;
// Zet nee als schuifvenster met tikdoelen van 44 px; offline via de wachtrij.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test('Zet nee als schuifvenster, in hooguit 3 tikken, en offline precies één keer', async ({ page, context }) => {
  await apiLogin(page.request, 'u-02')
  // Een willekeurige naam: met een tijdstempel lijken de accounts van 375, 390 en 412 px meer dan 80 procent op
  // elkaar, en dan geeft het ontdubbelen terecht 409 "Al in je bestand".
  const r = await page.request.post('/api/accounts', { data: { naam: `${crypto.randomUUID().slice(0, 12)} Mobiel` } })
  expect(r.status()).toBe(200)
  const id = (await r.json()).id
  await login(page, 'u-02')
  await ga(page, `/accounts/${id}`)
  await expect(page.getByTestId('fasepil')).toBeVisible()
  await expect(page.getByTestId('statuspil')).toBeVisible()
  const breed = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(breed).toBeLessThanOrEqual(0)

  await context.setOffline(true)
  await page.getByTestId('zet-nee-knop').click() // tik 1
  const venster = page.getByTestId('zet-nee')
  const kader = await venster.boundingBox()
  expect(kader!.y).toBeGreaterThan(50) // schuift van onder in
  for (const r of await page.locator('.nee-reden').all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.locator('.nee-reden', { hasText: 'Geen behoefte' }).click() // tik 2
  const knop = page.getByTestId('zet-op-nee')
  expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await knop.click() // tik 3
  await expect(page.locator('.toast').last()).toContainText('zodra je weer online bent')
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(async () => (await (await page.request.get(`/api/accounts/${id}`)).json()).status, { timeout: 15_000 }).toBe('nee')
  // Precies één keer: één regel "Nee" in de reisgeschiedenis (gelezen als Gevorderde).
  await apiLogin(page.request, 'u-03')
  const regels = (await (await page.request.get(`/api/accounts/${id}/reisgeschiedenis`)).json()).regels
  expect(regels.filter((r: any) => r.reden?.startsWith('Nee:'))).toHaveLength(1)
  await login(page, 'u-02')
  await ga(page, `/accounts/${id}`)
  await expect(page.getByTestId('terug-op-mobiel')).toContainText('Terug op')
})
