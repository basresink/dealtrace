// Vandaag: kop met quote en Dagstart, de aanleiding van de dag, het dashboard "Jouw resultaten · deze maand" en de blokken Klaargezet door AI en Belscript.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe('Vandaag-dashboard', () => {
  test('Eva ziet het dashboard met kop, link en tegels, en Klaargezet door AI naast Belscript', async ({ page }) => {
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
    const rechts = (await page.getByTestId('belscript').boundingBox())!
    expect(Math.abs(links.y - rechts.y)).toBeLessThan(2)
    expect(Math.abs(links.height - rechts.height)).toBeLessThan(2)
    expect(rechts.x).toBeGreaterThan(links.x + links.width - 1)
    await expect(page.getByTestId('belscript-studio')).toHaveAttribute('href', /^\/belscripts/)
    await expect(page.getByTestId('agents')).toHaveCount(0)
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

  test('Beginner ziet het dashboard zonder prospectdekking, met Belscript en zonder agents-blok', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/')
    await expect(page.getByTestId('vandaag-dashboard')).toBeVisible()
    await expect(page.getByTestId('dashboard-dekking')).toHaveCount(0)
    await expect(page.getByTestId('concepten')).toBeVisible()
    await expect(page.getByTestId('agents')).toHaveCount(0)
    await expect(page.getByTestId('belscript')).toBeVisible()
  })

  test('op 390 px stapelen tegels en AI-blokken zonder horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    await ga(page, '/')
    const a = (await page.getByTestId('dashboard-gesprekken').boundingBox())!
    const b = (await page.getByTestId('dashboard-afspraken').boundingBox())!
    expect(b.y).toBeGreaterThan(a.y + a.height - 1)
    const l = (await page.getByTestId('concepten').boundingBox())!
    const r = (await page.getByTestId('belscript').boundingBox())!
    expect(r.y).toBeGreaterThan(l.y + l.height - 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('kop: quote van de dag onder de groet, knop Dagstart in plaats van Prospect, geen eerste zet en geen dagritmeblok', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/')
    const kop = page.getByTestId('paginakop')
    const quote = kop.getByTestId('quote-van-de-dag')
    await expect(quote).not.toBeEmpty()
    expect(await quote.textContent()).not.toMatch(/[—–]/)
    expect((await quote.boundingBox())!.y).toBeGreaterThan((await kop.locator('h1').boundingBox())!.y)
    await expect(page.getByTestId('vandaag-dagstart')).toHaveAttribute('href', '/dagstart')
    await expect(page.getByTestId('vandaag-prospect')).toHaveCount(0)
    await expect(page.getByTestId('focusregel')).toHaveCount(0)
    await expect(page.getByText('Je eerste zet')).toHaveCount(0)
    await expect(page.getByTestId('dagritme-strook')).toHaveCount(0)
  })

  test('Beginner ziet ook de aanleiding van de dag', async ({ page }) => {
    await apiLogin(page.request, 'u-02')
    const v = await (await page.request.get('/api/vandaag')).json()
    expect(v.kop.quote).toBeTruthy()
    test.skip(!v.aanleiding, 'geen open inzicht van 60 of hoger op een eigen account in de laatste zeven dagen')
    await login(page, 'u-02')
    await ga(page, '/')
    await expect(page.getByTestId('aanleiding-van-de-dag')).toBeVisible()
    await expect(page.getByTestId('aanleiding-van-de-dag')).toContainText(v.aanleiding.titel)
  })

  test('op 390 px de quote onder de groet en geen eerste zet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    await ga(page, '/')
    await expect(page.getByTestId('vt-quote')).not.toBeEmpty()
    await expect(page.getByTestId('vt-focus')).toHaveCount(0)
    await expect(page.locator('[data-test="dagritme-strook"]:visible')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
