// /help werd /helpcenter en /meldingen werd /notificaties (opzet van DealDrive). De oude adressen sturen
// door met hetzelfde pad en dezelfde query.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// De dev-server is traag bij een koude start van nieuwe pagina's; elke test bezoekt meerdere pagina's.
test.describe.configure({ timeout: 90_000 })

test.describe('Doorsturen van de oude adressen', () => {
  test('/help, /help/<artikel> en /meldingen houden pad en query', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/help')
    await expect(page).toHaveURL(/\/helpcenter$/)
    await ga(page, '/help/hercontactritme?alsNiveau=expert')
    await expect(page).toHaveURL(/\/helpcenter\/hercontactritme\?alsNiveau=expert$/)
    await expect(page.getByTestId('artikel-titel')).toHaveText('Hercontactritme')
    await ga(page, '/help?zoek=poging')
    await expect(page).toHaveURL(/\/helpcenter\?zoek=poging$/)
    await expect(page.getByTestId('help-resultaten')).toContainText('Wat betekent poging 3 van 5')
    await ga(page, '/meldingen?alle=1&soort=inzicht')
    await expect(page).toHaveURL(/\/notificaties\?alle=1&soort=inzicht$/)
    await expect(page.getByTestId('stat-inzicht')).toHaveAttribute('aria-pressed', 'true')
  })

  test('links in de app gaan naar de nieuwe adressen', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/acties')
    await page.getByTestId('hulp-knop').click()
    await expect(page.getByTestId('hulp-flyout').getByRole('link', { name: 'Open in het helpcenter' })).toHaveAttribute('href', /^\/helpcenter\//)
  })
})

test.describe('Helpcenter in de opzet van DealDrive', () => {
  test('van de start naar een categorie en een artikel, en terug via de kruimel', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter')
    await expect(page.getByTestId('voor-jou')).toBeVisible()
    await page.getByTestId('categorie-Bellen').click()
    await expect(page).toHaveURL(/\/helpcenter\/categorie\/bellen$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bellen')
    await page.getByTestId('help-kaart-de-eerste-20-seconden').click()
    await expect(page).toHaveURL(/\/helpcenter\/de-eerste-20-seconden$/)
    await expect(page.getByTestId('artikel-titel')).toHaveText('De eerste 20 seconden')
    await expect(page.getByTestId('artikel-inhoud').locator('.ha-blok').first()).toBeVisible()
    await expect(page.getByTestId('controlevragen')).toBeVisible()
    await page.getByTestId('artikel-categorie').click()
    await expect(page).toHaveURL(/\/helpcenter\/categorie\/bellen$/)
  })

  test('Hoe werkt Dealtrace en de academie: zoeken binnen de selectie', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter')
    await page.getByTestId('ingang-instructies').click()
    await expect(page).toHaveURL(/\/helpcenter\/instructies$/)
    await expect(page.getByTestId('groep-Dagelijks werk')).toBeVisible()
    await expect(page.getByTestId('groep-Inrichten')).toHaveCount(0)
    await page.getByTestId('overzicht-zoek').fill('belblok')
    await expect(page.getByTestId('overzicht-telling')).toContainText(/\d+ van \d+/)
    await expect(page.getByTestId('help-kaart-belblokken')).toBeVisible()
    await page.getByTestId('overzicht-zoek').fill('zebrastreepjeswoord')
    await expect(page.getByTestId('overzicht-leeg')).toBeVisible()
    await ga(page, '/helpcenter/academie')
    await expect(page.getByTestId('groep-Bezwaren')).toBeVisible()
    await expect(page.getByTestId('help-kaart-geen-budget')).toBeVisible()
  })

  test('een categorie die niet voor jouw rol is, bestaat niet; de beheerder ziet Inrichten', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter/categorie/inrichten')
    await expect(page.getByTestId('categorie-onbekend')).toBeVisible()
    await ga(page, '/helpcenter/categorie/bestaat-niet')
    await expect(page.getByTestId('categorie-onbekend')).toBeVisible()
    await ga(page, '/helpcenter/bestaat-niet')
    await expect(page.getByTestId('artikel-onbekend')).toBeVisible()
    await login(page, 'u-06')
    await ga(page, '/helpcenter/categorie/inrichten')
    await expect(page.getByTestId('categorie-artikelen')).toBeVisible()
    await expect(page.getByTestId('help-kaart-regels')).toBeVisible()
  })
})

test.describe('Notificaties in de opzet van DealDrive', () => {
  test('kaarten: drie naast elkaar op de laptop, een op de telefoon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/notificaties?alle=1')
    const kaarten = page.getByTestId('melding')
    expect(await kaarten.count()).toBeGreaterThanOrEqual(3)
    const [a, b, c] = await Promise.all([0, 1, 2].map((i) => kaarten.nth(i).boundingBox()))
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    expect(Math.abs(a!.y - c!.y)).toBeLessThan(2)
    await page.setViewportSize({ width: 900, height: 900 })
    const [d, e, f] = await Promise.all([0, 1, 2].map((i) => kaarten.nth(i).boundingBox()))
    expect(Math.abs(d!.y - e!.y)).toBeLessThan(2)
    expect(f!.y).toBeGreaterThan(d!.y + 10)
    await page.setViewportSize({ width: 390, height: 844 })
    const [g, h] = await Promise.all([0, 1].map((i) => kaarten.nth(i).boundingBox()))
    expect(h!.y).toBeGreaterThan(g!.y + 10)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('filters op soort en Ongelezen of Alles staan in de URL', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/notificaties')
    await expect(page.getByTestId('filter-ongelezen')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('filter-alles').click()
    await expect(page).toHaveURL(/alle=1/)
    await page.getByTestId('stat-inzicht').click()
    await expect(page).toHaveURL(/soort=inzicht/)
    const n = await page.getByTestId('melding').count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) await expect(page.getByTestId('melding').nth(i)).toContainText('Inzicht')
    await page.getByTestId('stat-alles').click()
    await expect(page).not.toHaveURL(/soort=/)
  })

  test('klik op een kaart opent de link en markeert hem gelezen', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/notificaties?alle=1')
    const kaart = page.locator('[data-test="melding"].nkaart--link').first()
    await kaart.locator('.nkaart-titel').click()
    await expect(page).not.toHaveURL(/\/notificaties/)
  })

  test('Voorkeuren toont de kanalen per soort', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/notificaties')
    await page.getByTestId('voorkeuren-knop').click()
    await expect(page.getByTestId('notificatie-kanalen')).toBeVisible()
    await expect(page.getByTestId('kanaal-kritiek-inApp')).toBeVisible()
  })

  test('Markeer gelezen en Alles gelezen', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/notificaties?alle=1')
    const knop = page.getByTestId('melding-gelezen').first()
    if (await knop.count()) {
      const voor = await page.getByTestId('melding-ongelezen').count()
      await knop.click()
      await expect(page.getByTestId('melding-ongelezen')).toHaveCount(voor - 1)
    }
    if (await page.getByTestId('alles-gelezen').count()) {
      await page.getByTestId('alles-gelezen').click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alles bijgewerkt.')
    }
    await ga(page, '/notificaties')
    await expect(page.getByTestId('melding-ongelezen')).toHaveCount(0)
    await expect(page.getByTestId('alles-gelezen')).toHaveCount(0)
  })
})
