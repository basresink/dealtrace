// P09: helpcenter, hulp per scherm en features per niveau voor de founder.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

const ROUTES = [
  '/', '/taken', '/taken?weergave=horizon', '/inzichten', '/prospects', '/contacten', '/reizen', '/notificaties', '/mij', '/leadgenerator', '/helpcenter',
  '/instellingen', '/instellingen/regels', '/instellingen/ritme', '/instellingen/agents', '/instellingen/gebruikers', '/instellingen/niveaus',
  '/instellingen/audit', '/instellingen/eigen-velden', '/instellingen/nee-redenen', '/instellingen/organisatie', '/instellingen/abonnement', '/planning',
]

test.describe('Hulp per scherm', () => {
  test('Hulp op Taken opent "Een taak afronden met een uitkomst"; Escape sluit', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/taken')
    await page.getByTestId('hulp-knop').click()
    const f = page.getByTestId('hulp-flyout')
    await expect(f.locator('#hulp-titel')).toHaveText('Een taak afronden met een uitkomst')
    await page.keyboard.press('Escape')
    await expect(f).toBeHidden()
  })

  test('elk gebouwd scherm opent een artikel', async ({ page }) => {
    test.setTimeout(180_000)
    await login(page, 'u-06')
    for (const r of ROUTES) {
      await ga(page, r)
      await page.getByTestId('hulp-knop').first().click()
      const titel = page.getByTestId('hulp-flyout').locator('#hulp-titel')
      await expect(titel, r).not.toHaveText(/Laden|Geen artikel/)
      await page.keyboard.press('Escape')
    }
  })
})

test.describe('Helpcenter', () => {
  test('Aan de slag: vijf artikelen; markeer als gelezen geeft een vinkje, zonder teller of balk', async ({ page }) => {
    await login(page, 'u-05')
    await ga(page, '/helpcenter')
    await expect(page.getByTestId('aan-de-slag').locator('li')).toHaveCount(5)
    await expect(page.locator('progress, .voortgang')).toHaveCount(0)
    await expect(page.getByText(/van 5 gelezen/)).toHaveCount(0)
    await page.getByTestId('aan-de-slag-je-eerste-dag-in-dealtrace').getByRole('link').click()
    await expect(page.getByTestId('artikel-titel')).toHaveText('Je eerste dag in Dealtrace')
    // Een kort artikel telt bij openen als gelezen; anders klik je "Markeer als gelezen".
    if (await page.getByTestId('markeer-gelezen').isEnabled()) await page.getByTestId('markeer-gelezen').click()
    await expect(page.getByTestId('markeer-gelezen')).toHaveText('Gelezen')
    await ga(page, '/helpcenter')
    await expect(page.getByTestId('aan-de-slag-je-eerste-dag-in-dealtrace').getByTestId('gelezen-vinkje')).toBeVisible()
  })

  test('zoeken vindt "Poging" zonder accenten; niets gevonden geeft de lege staat', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter')
    await page.getByTestId('help-zoekicoon').click()
    await page.getByTestId('help-zoek').fill('Pogíng')
    await expect(page.getByTestId('help-resultaten')).toContainText('Wat betekent poging 3 van 5')
    await page.getByTestId('help-zoek').fill('zebrastreepjeswoord')
    await expect(page.getByTestId('help-resultaten')).toContainText('Daar staat nog niets over in het helpcenter.')
  })

  test('Was dit nuttig? Nee vraagt een reden en bedankt', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter/hercontactritme')
    await page.getByTestId('nuttig-nee').click()
    await expect(page.getByTestId('nuttig-verstuur')).toBeDisabled()
    await page.getByTestId('nuttig-reden').selectOption('Onduidelijk')
    await page.getByTestId('nuttig-verstuur').click()
    await expect(page.getByText('Bedankt. We gebruiken dit om het artikel te verbeteren.')).toBeVisible()
  })

  test('Inrichten alleen voor de beheerder', async ({ page, request }) => {
    await apiLogin(request, 'u-01')
    const am = await (await request.get('/api/help')).json()
    expect(am.artikelen.some((a: any) => a.categorie === 'Inrichten')).toBe(false)
    await apiLogin(request, 'u-06')
    const bh = await (await request.get('/api/help')).json()
    expect(bh.artikelen.some((a: any) => a.categorie === 'Inrichten')).toBe(true)
    void page
  })
})

test.describe('Features per niveau (founder)', () => {
  test('aanzetten voor Beginner werkt direct; de toast heeft Ongedaan maken; Draai terug', async ({ page, request }) => {
    await login(page, 'u-founder')
    await ga(page, '/platform/features')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/functies, \d+ aan voor Beginner\./)
    const cel = page.getByTestId('cel-nav.leadgenerator-beginner')
    await cel.getByRole('switch').click()
    await expect(page.getByText('Leadgenerator staat nu aan voor Beginner.')).toBeVisible()
    await apiLogin(request, 'u-02')
    const me = await (await request.get('/api/me')).json()
    expect(me.functies.find((f: any) => f.sleutel === 'nav.leadgenerator').beschikbaar).toBe(true)
    expect(me.nogTonen.map((n: any) => n.sleutel)).toContain('nav.leadgenerator')
    await page.getByTestId('feature-wijzigingen').getByTestId('draai-terug').first().click()
    await expect(page.getByText('Teruggedraaid.')).toBeVisible()
    const na = await (await request.get('/api/me')).json()
    expect(na.functies.find((f: any) => f.sleutel === 'nav.leadgenerator').beschikbaar).toBe(false)
  })

  test('afwijking voor Voltvast: gele cel en Terug naar standaard', async ({ page }) => {
    await login(page, 'u-founder')
    await ga(page, '/platform/features?organisatie=org-voltvast')
    const cel = page.getByTestId('cel-nav.funnel-gevorderd')
    await cel.getByRole('switch').click()
    await expect(cel).toHaveClass(/cel-afwijking/)
    await page.getByTestId('standaard-nav.funnel-gevorderd').click()
    await expect(cel).not.toHaveClass(/cel-afwijking/)
  })

  test('niemand anders komt bij /api/platform/features', async ({ request }) => {
    for (const u of ['u-06', 'u-04', 'u-01']) {
      await apiLogin(request, u)
      expect((await request.get('/api/platform/features')).status()).toBe(404)
      expect((await request.put('/api/platform/features', { data: { functie: 'nav.funnel', niveau: 'beginner', aan: false } })).status()).toBe(404)
      expect((await request.put('/api/settings/functies_per_niveau', { data: { value: {} } })).status()).toBeGreaterThanOrEqual(400)
    }
  })
})

test.describe('Helpcenter op de telefoon', () => {
  for (const breedte of [375, 390, 412]) {
    test(`${breedte} px: /helpcenter en een artikel zonder horizontale scroll; hulp als schuifvenster`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: 800 })
      await login(page, 'u-01')
      await ga(page, '/helpcenter')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      await ga(page, '/helpcenter/vandaag')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      await ga(page, '/taken')
      await page.getByTestId('hulp-knop').click()
      const box = await page.getByTestId('hulp-flyout').boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(breedte - 1)
    })
  }
})
