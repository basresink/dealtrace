// Mijn dashboard en de funnel in de opzet van DealDrive /rapportage: kop, Filters met de periodestrook,
// gevulde tegels, grafieken en tabellen, periode wisselen via de URL, niveaus, en geen horizontale scroll.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// De pagina's laden veel cijfers; in de dev-server met andere builds ernaast ruim de tijd geven.
test.describe.configure({ timeout: 120_000 })

test.describe('Mijn dashboard', () => {
  test('Sanne ziet kop, doel, gevulde tegels, grafieken en tabellen', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/mijn-dashboard')
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Mijn dashboard · Deze maand')
    await expect(page.getByTestId('rapport-titel')).toHaveText('Waar sta jij?')
    await expect(page.getByTestId('knop-data')).toHaveAttribute('href', '/data-kwaliteit')
    await expect(page.getByTestId('doel-blok')).toContainText('Waar sta je tegenover je doel?')
    await expect(page.getByTestId('normen').locator('li')).toHaveCount(4)
    await expect(page.getByTestId('cijfers-titel')).toContainText('pogingen')
    for (const t of ['prospects', 'pogingen', 'gesprekken', 'afspraken', 'conversie', 'bereik', 'per-account', 'beslisser', 'gehouden', 'overdrachten', 'belblokken', 'inzichten', 'taken', 'op-dag', 'tempo']) {
      await expect(page.getByTestId(`tegel-${t}`)).toBeVisible()
    }
    const api = await (await page.request.get('/api/resultaten/dashboard')).json()
    await expect(page.getByTestId('tegel-pogingen')).toContainText(String(api.tegels.pogingen.aantal))
    expect(api.tegels.pogingen.aantal).toBeGreaterThan(0)
    for (const g of ['grafiek-activiteit', 'grafiek-reis', 'grafiek-uitkomsten', 'grafiek-dekking', 'grafiek-status', 'mijn-trend', 'mijn-team']) await expect(page.getByTestId(g)).toBeVisible()
    await expect(page.getByTestId('grafiek-dekking')).toContainText('Prospectdekking')
    await expect(page.getByTestId('trend-uit')).toHaveCount(0)
  })

  test('periode wisselen via Filters zet de URL en de kop, en Reset brengt deze maand terug', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/mijn-dashboard')
    await page.getByTestId('rapport-filters-knop').click()
    await expect(page.getByTestId('rapport-filters')).toBeVisible()
    await page.getByTestId('periode-week').click()
    await expect(page).toHaveURL(/periode=week/)
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Mijn dashboard · Deze week')
    await expect(page.getByTestId('grafiek-activiteit')).toContainText('Activiteiten per dag')
    await page.getByTestId('periode-kwartaal').click()
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Mijn dashboard · Dit kwartaal')
    await page.getByTestId('periode-eigen').click()
    await expect(page).toHaveURL(/periode=eigen/)
    // Langer dan 31 dagen telt per week.
    await page.getByTestId('periode-van').fill('2026-07-01')
    await page.getByTestId('periode-van').dispatchEvent('change')
    await expect(page).toHaveURL(/van=2026-07-01/)
    await expect(page.getByTestId('rapport-kicker')).toContainText('1 jul')
    await expect(page.getByTestId('grafiek-activiteit')).toContainText('Activiteiten per week')
    await page.getByTestId('rapport-reset').click()
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Mijn dashboard · Deze maand')
  })

  test('de beginner ziet zijn cijfers zonder dekking, weektabel en teamvergelijking', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/mijn-dashboard')
    await expect(page.getByTestId('tegel-pogingen')).toBeVisible()
    // Wat uit staat, staat er niet: geen slotknop en geen melding "Nog niet aangezet".
    await expect(page.getByTestId('dekking-slot')).toHaveCount(0)
    await expect(page.getByTestId('trend-uit')).toHaveCount(0)
    await expect(page.getByText('Nog niet aangezet')).toHaveCount(0)
    await expect(page.getByTestId('mijn-trend')).toHaveCount(0)
    await expect(page.getByTestId('mijn-team')).toHaveCount(0)
    const api = await (await page.request.get('/api/resultaten/dashboard')).json()
    expect(api.team).toBeNull()
    expect(api.prospects.dekking).toBeNull()
    expect(JSON.stringify(api)).not.toContain('Testgebruiker')
  })

  test('de API valideert de periode en houdt een eigen periode binnen vandaag', async ({ request }) => {
    await apiLogin(request, 'u-03')
    const raar = await (await request.get('/api/resultaten/dashboard?periode=onzin')).json()
    expect(raar.periode.sleutel).toBe('maand')
    const eigen = await (await request.get('/api/resultaten/dashboard?periode=eigen&van=2026-09-01&tot=2099-01-01')).json()
    expect(eigen.periode.van).toBe('2026-09-01')
    expect(eigen.periode.tot <= new Date().toISOString().slice(0, 10)).toBe(true)
  })

  test('op 390 px geen horizontale scroll en tegels in twee kolommen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-03')
    await ga(page, '/mijn-dashboard')
    const a = (await page.getByTestId('tegel-pogingen').boundingBox())!
    const b = (await page.getByTestId('tegel-gesprekken').boundingBox())!
    expect(Math.abs(a.y - b.y)).toBeLessThan(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.getByTestId('rapport-filters-knop').click()
    expect((await page.getByTestId('periode-week').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test.describe('Funnel', () => {
  test('kop, tegels, fases, doorlooptijden, uitval, pogingen en tabel', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/funnel')
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Funnel · Deze maand')
    const api = await (await page.request.get('/api/funnel')).json()
    await expect(page.getByTestId('rapport-titel')).toHaveText(api.kop.titel)
    for (const t of ['instroom', 'afspraak', 'gehouden', 'over', 'uitval', 'doorloop', 'stok']) await expect(page.getByTestId(`funnel-tegel-${t}`)).toBeVisible()
    await expect(page.getByTestId('funnel-tegel-instroom')).toContainText(String(api.aantalAccounts))
    await expect(page.getByTestId('funnel').first()).toContainText('Conversie per reisfase')
    for (const b of ['doorlooptijden', 'uitval', 'pogingen', 'funnel-tabel']) await expect(page.getByTestId(b)).toBeVisible()
    await page.getByTestId('fase-gevonden').click()
    await expect(page.getByTestId('funnel-lijst')).toBeVisible()
    await expect(page.getByTestId('funnel-lijst')).toContainText('Gevonden')
  })

  test('periode wisselen via Filters', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/funnel')
    await page.getByTestId('rapport-filters-knop').click()
    await expect(page.getByTestId('funnel-filters')).toBeVisible()
    await page.getByTestId('periode-kwartaal').click()
    await expect(page).toHaveURL(/periode=kwartaal/)
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Funnel · Dit kwartaal')
    await page.getByTestId('periode-verkoopjaar').click()
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Funnel · Dit verkoopjaar')
    await page.getByTestId('rapport-reset').click()
    await expect(page.getByTestId('rapport-kicker')).toHaveText('Funnel · Deze maand')
  })

  test('op 390 px geen horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-03')
    await ga(page, '/funnel')
    await expect(page.getByTestId('funnel-tegel-instroom')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.getByTestId('rapport-filters-knop').click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
