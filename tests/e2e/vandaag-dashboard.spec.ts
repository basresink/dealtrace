// Vandaag: het dashboard "Jouw resultaten · deze maand" en de blokken Klaargezet door AI en Door AI agents gedaan.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe('Vandaag-dashboard', () => {
  test('Eva ziet het dashboard met kop, link en tegels, en beide AI-blokken naast elkaar', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/')
    const d = page.getByTestId('vandaag-dashboard')
    await expect(d).toContainText('Jouw resultaten · deze maand')
    await expect(page.getByTestId('dashboard-kop')).not.toBeEmpty()
    await expect(page.getByTestId('dashboard-link')).toHaveAttribute('href', '/mijn-dashboard')
    for (const t of ['verdeling', 'gesprekken', 'afspraken', 'conversie', 'overdrachten', 'inzichten', 'taken']) await expect(page.getByTestId(`dashboard-${t}`)).toBeVisible()
    await expect(page.getByTestId('dashboard-dekking')).toContainText('Prospectdekking')
    // Volgorde: paneel, dashboard, AI-blokken, inzichten bij prospects.
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    expect(await y('vandaag-paneel')).toBeLessThan(await y('vandaag-dashboard'))
    expect(await y('vandaag-dashboard')).toBeLessThan(await y('concepten'))
    expect(await y('concepten')).toBeLessThan(await y('prospect-signalen'))
    const links = (await page.getByTestId('concepten').boundingBox())!
    const rechts = (await page.getByTestId('agents').boundingBox())!
    expect(Math.abs(links.y - rechts.y)).toBeLessThan(2)
    expect(Math.abs(links.height - rechts.height)).toBeLessThan(2)
    expect(rechts.x).toBeGreaterThan(links.x + links.width - 1)
    await expect(page.getByTestId('agents-samenvatting')).toContainText('taken klaargezet')
    await expect(page.getByTestId('week')).toHaveCount(0)
    await expect(page.getByTestId('datakwaliteit')).toHaveCount(0)
  })

  test('Goedkeuren op Vandaag stuurt het besluit en haalt het concept uit de lijst', async ({ page }) => {
    await apiLogin(page.request, 'u-07')
    const dash = await (await page.request.get('/api/vandaag/dashboard')).json()
    const c = dash.klaargezet.lijst.find((x: any) => x.bron === 'concept')
    test.skip(!c, 'geen concept dat wacht')
    await login(page, 'u-07')
    await ga(page, '/')
    // De seed van Eva blijft intact: het besluit zelf onderscheppen we en controleren we op inhoud.
    let body: any = null
    await page.route(`**/api/concepten/${c.id}/besluit`, async (r) => { body = r.request().postDataJSON(); await r.fulfill({ status: 200, json: { id: c.id, status: 'goedgekeurd' } }) })
    await page.getByTestId(`goedkeuren-${c.id}`).click()
    await expect(page.getByTestId(`klaargezet-${c.id}`)).toHaveCount(0)
    expect(body).toEqual({ besluit: 'goedkeuren' })
  })

  test('Beginner ziet het dashboard zonder prospectdekking en zonder agents-blok', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/')
    await expect(page.getByTestId('vandaag-dashboard')).toBeVisible()
    await expect(page.getByTestId('dashboard-dekking')).toHaveCount(0)
    await expect(page.getByTestId('concepten')).toBeVisible()
    await expect(page.getByTestId('agents')).toHaveCount(0)
  })

  test('op 390 px stapelen tegels en AI-blokken zonder horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    await ga(page, '/')
    const a = (await page.getByTestId('dashboard-gesprekken').boundingBox())!
    const b = (await page.getByTestId('dashboard-afspraken').boundingBox())!
    expect(b.y).toBeGreaterThan(a.y + a.height - 1)
    const l = (await page.getByTestId('concepten').boundingBox())!
    const r = (await page.getByTestId('agents').boundingBox())!
    expect(r.y).toBeGreaterThan(l.y + l.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
