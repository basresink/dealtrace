import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('zijbalk per niveau', () => {
  test('Beginner buitendienst: 14 items met Planning open, en Bezoeken voor Belblokken', async ({ page }) => {
    await login(page, 'u-02')
    const items = page.locator('.sb-nav .sb-groep:not(.sb-slotgroep) .sb-link')
    // Planning is een uitklapmenu: dicht 10 items (met Opvolgreeksen en Richting in Start), open 15 (Prospectplanning staat sinds 0064 voor iedereen aan).
    await expect(items).toHaveCount(10)
    await page.getByTestId('sb-planning').click()
    await expect(items).toHaveCount(15)
    const sleutels = await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-sleutel')))
    expect(sleutels.indexOf('nav.bezoeken')).toBeLessThan(sleutels.indexOf('nav.belblokken'))
    // Nog niet aangezet: Inzichten, Briefings, Accountplannen, Leadgenerator, Signaalradar en Prospectreizen.
    await expect(page.locator('.sb-slotgroep-teller')).toHaveText('6')
    await expect(page.getByTestId('gebruikersblok')).toHaveText('ACCOUNTMANAGER · BEGINNER')
  })

  test('Richting staat in Start direct onder Agenda, ook met Planning dicht', async ({ page }) => {
    await login(page, 'u-07')
    const start = page.locator('.sb-groep[data-groep="Start"] .sb-link')
    expect(await start.evaluateAll((els) => els.map((e) => e.getAttribute('data-sleutel')))).toEqual(['nav.vandaag', 'nav.agenda', 'nav.richting'])
    await expect(page.locator('.sb-groep[data-groep="Planning"] [data-sleutel="nav.richting"]')).toHaveCount(0)
    await start.nth(2).click()
    await expect(page).toHaveURL(/\/richting$/)
  })

  test('Rapportages met Mijn dashboard en Funnel; de gebruikerskaart opent geen menu', async ({ page }) => {
    await login(page, 'u-01')
    const groep = page.locator('.sb-groep[data-groep="Rapportages"]')
    await expect(groep.locator('.sb-groep-kop')).toHaveText('Rapportages')
    await expect(groep.locator('.sb-link')).toHaveText(['Mijn dashboard', 'Funnel'])
    await expect(page.locator('.sb-groep[data-groep="Resultaten"]')).toHaveCount(0)
    await groep.locator('.sb-link[data-sleutel="nav.resultaten"]').click()
    await expect(page).toHaveURL(/\/mijn-dashboard$/)
    await expect(page.getByTestId('mijn-cijfers')).toBeVisible()
    // Geen drop-up meer: de kaart blijft zichtbaar maar is geen knop.
    const kaart = page.getByTestId('sb-gebruikerskaart')
    await expect(kaart).toBeVisible()
    await expect(kaart.locator('button')).toHaveCount(0)
    await kaart.click()
    await expect(page.getByTestId('sb-gebruikersmenu')).toHaveCount(0)
    // Icoonrij: knoppen van minstens 44 bij 44 en iconen van 22 px.
    const knoppen = page.getByTestId('sb-iconen').locator('.sb-icoonknop')
    for (const k of await knoppen.all()) {
      const b = (await k.boundingBox())!
      expect(b.width).toBeGreaterThanOrEqual(44)
      expect(b.height).toBeGreaterThanOrEqual(44)
      const i = (await k.locator('svg').first().boundingBox())!
      expect(Math.round(i.width)).toBe(22)
    }
  })

  test('icoonrij: account, mijn instellingen, helpcenter, notificaties en uitloggen; Planning met Leadgenerator', async ({ page }) => {
    await login(page, 'u-01')
    const rij = page.getByTestId('sb-iconen')
    await expect(rij.locator('a.sb-icoonknop')).toHaveCount(4)
    expect(await rij.locator('a.sb-icoonknop').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual(['/mij', '/mijn-instellingen', '/helpcenter', '/notificaties'])
    await expect(rij.getByTestId('sb-uitloggen')).toBeVisible()
    // Leadgenerator staat onder Planning, niet meer onder Prospects.
    await expect(page.locator('.sb-groep[data-groep="Prospects"] [data-sleutel="nav.leadgenerator"]')).toHaveCount(0)
    await page.getByTestId('sb-planning').click()
    await expect(page.locator('.sb-groep[data-groep="Planning"] [data-sleutel="nav.leadgenerator"]')).toBeVisible()
    await expect(page.getByTestId('sb-planning')).toContainText('Planning')
    // Meer lucht boven elke groepstitel (behalve de eerste).
    const pad = await page.locator('.sb-groep[data-groep="Prospects"] .sb-groep-kop').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop))
    expect(pad).toBeGreaterThanOrEqual(20)
    await rij.getByTestId('sb-mijn-instellingen').click()
    await expect(page).toHaveURL(/\/mijn-instellingen$/)
    await expect(page.getByTestId('toestellen')).toBeVisible()
  })

  test('Activiteiten: Inzichten voor Taken, Briefings onder Taken; Kennisbank via het helpcenter', async ({ page }) => {
    await login(page, 'u-01')
    const groep = page.locator('.sb-groep[data-groep="Activiteiten"]')
    await expect(groep.locator('.sb-link .sb-link-tekst')).toHaveText(['Inzichten', 'Taken', 'Briefings', 'Opvolgreeksen', 'Concepten'])
    await expect(page.locator('.sb-nav a[href="/kennisbank"]')).toHaveCount(0)
    await groep.locator('.sb-link[data-sleutel="briefing.bewerken"]').click()
    await expect(page).toHaveURL(/\/briefings$/)
    await ga(page, '/helpcenter')
    await page.getByTestId('ingang-kennisbank').click()
    await expect(page).toHaveURL(/\/kennisbank$/)
  })

  test('/resultaten stuurt door naar /mijn-dashboard met de query', async ({ page }) => {
    await login(page, 'u-01')
    await page.goto('/resultaten?bron=melding')
    await expect(page).toHaveURL(/\/mijn-dashboard\?bron=melding$/)
    await expect(page.getByTestId('mijn-cijfers')).toBeVisible()
  })

  test('Nog niet aangezet opent de uitlegflyout', async ({ page }) => {
    await login(page, 'u-02')
    await page.click('.sb-slotgroep-kop')
    // aria-disabled: Playwright ziet het item als uitgeschakeld, maar een klik opent bewust de uitleg.
    await page.click('.sb-link--slot[data-sleutel="nav.leadgenerator"]', { force: true })
    const flyout = page.getByTestId('niet-aangezet-flyout')
    await expect(flyout).toBeVisible()
    await expect(flyout).toContainText('Gevorderd · nog niet aangezet')
    await expect(flyout).toContainText('Wat het doet')
    await expect(flyout).toContainText('Tot die tijd')
    await page.keyboard.press('Escape')
    await expect(flyout).toBeHidden()
  })

  test('directe link naar een functie die nog niet aanstaat toont de uitleg', async ({ page }) => {
    await login(page, 'u-02')
    await page.goto('/leadgenerator')
    await expect(page.getByText('nog niet aangezet', { exact: false }).first()).toBeVisible()
  })

  test('beheerder ziet de managergroep en de instellingen', async ({ page }) => {
    await login(page, 'u-06')
    // Instellingen van de organisatie is een gewoon item in de groep Beheer.
    await expect(page.locator('.sb-groep[data-groep="Beheer"] .sb-link[data-sleutel="nav.instellingen"]')).toHaveAttribute('href', '/instellingen')
    await expect(page.locator('.sb-icoonknop[data-sleutel="nav.instellingen"]')).toHaveCount(0)
    await page.goto('/instellingen/gebruikers')
    await expect(page.getByTestId('gebruikers-tabel')).toBeVisible()
  })

  test('accountmanager krijgt geen toegang tot instellingen', async ({ page }) => {
    await login(page, 'u-02')
    await page.goto('/instellingen')
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
  })

  test('founder zonder organisatie komt op Platformbeheer', async ({ page }) => {
    await login(page, 'u-founder')
    await expect(page).toHaveURL(/\/platform\/klanten$/)
    // P24: alle platformschermen in de groep Beheer.
    await expect(page.locator('.sb-nav .sb-link')).toHaveCount(11)
  })
})
