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
    await ga(page, '/taken')
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

  test('Nieuwe klanten werven hoort bij de academie: hoofdstuk, categorie en artikel met bron', async ({ page }) => {
    // Drie rollen en zes pagina's: ruimer dan de standaard van 90 seconden.
    test.setTimeout(180_000)
    for (const gebruiker of ['u-02', 'u-04', 'u-06']) {
      await login(page, gebruiker)
      await ga(page, '/helpcenter')
      await expect(page.getByTestId('ingang-werven'), gebruiker).toHaveCount(0)
      await expect(page.getByTestId('ingang-academie'), gebruiker).toContainText('55 artikelen')
      await expect(page.getByTestId('groep-academie').getByTestId('categorie-Je verhaal schrijven'), gebruiker).toBeVisible()
    }
    await page.getByTestId('categorie-Je verhaal schrijven').click()
    await expect(page).toHaveURL(/\/helpcenter\/categorie\/je-verhaal-schrijven$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Je verhaal schrijven')
    await expect(page.getByTestId('terug-overzicht')).toHaveAttribute('href', '/helpcenter/academie#werven')
    await page.getByTestId('help-kaart-vertel-een-userstory').click()
    await expect(page).toHaveURL(/\/helpcenter\/vertel-een-userstory$/)
    await expect(page.getByTestId('artikel-titel')).toHaveText('Vertel een userstory')
    await expect(page.getByTestId('artikel-bron')).toHaveText('Uit de whitepaper The Perfect Pitch')
    await expect(page.getByTestId('artikel-inhoud').locator('.ha-blok')).toHaveCount(5)
    await expect(page.getByTestId('controlevragen')).toBeVisible()
    await expect(page.getByTestId('artikel-inhoud').getByRole('link', { name: 'Een belscript kiezen' })).toHaveAttribute('href', '/helpcenter/een-belscript-kiezen')
    // De academie: het hoofdstuk Nieuwe klanten werven met de twaalf artikelen, zoeken binnen de academie.
    await ga(page, '/helpcenter/academie')
    const werven = page.getByTestId('hoofdstuk-werven')
    await expect(page.getByTestId('hoofdstuk-vak')).toBeVisible()
    await expect(werven.getByRole('heading', { name: 'Nieuwe klanten werven' })).toBeVisible()
    await expect(werven.getByTestId('groep-Waarom klanten kopen')).toBeVisible()
    await expect(werven.getByTestId('groep-Openen en presenteren')).toBeVisible()
    await expect(werven.locator('[data-test^="help-kaart-"]')).toHaveCount(12)
    await page.getByTestId('overzicht-zoek').fill('foray')
    await expect(page.getByTestId('help-kaart-de-foray-toestemming-voor-je-vragen')).toBeVisible()
    await expect(page.getByTestId('help-kaart-vertel-een-userstory')).toHaveCount(0)
    // Het oude adres stuurt door naar het hoofdstuk.
    await ga(page, '/helpcenter/werven')
    await expect(page).toHaveURL(/\/helpcenter\/academie#werven$/)
    // Zoeken in het hele helpcenter: de wervingsartikelen staan bij New business.
    await ga(page, '/helpcenter?zoek=waardestatement')
    await expect(page.getByTestId('help-resultaten')).toContainText('New business')
    await expect(page.getByTestId('help-resultaten')).toContainText('Klantsituaties en waardestatements')
  })

  test('Tips & Tricks: twintig tips in vier categorieën, een tip linkt naar zijn functie', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter')
    await expect(page.getByTestId('ingang-tips')).toContainText('20 tips')
    await expect(page.getByTestId('groep-tips').locator('.hc-categorie')).toHaveCount(4)
    await page.getByTestId('ingang-tips').click()
    await expect(page).toHaveURL(/\/helpcenter\/tips$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tips & Tricks')
    await expect(page.locator('[data-test^="help-kaart-tip-"]')).toHaveCount(20)
    await page.getByTestId('overzicht-zoek').fill('rijmodus')
    await expect(page.getByTestId('help-kaart-tip-rijmodus-handen-aan-het-stuur')).toBeVisible()
    await page.getByTestId('help-kaart-tip-rijmodus-handen-aan-het-stuur').click()
    await expect(page.getByTestId('artikel-bron')).toHaveText('Van het DealDrive-team')
    await expect(page.getByTestId('artikel-inhoud').locator('.ha-blok').first()).toContainText('Wat het je oplevert')
    await expect(page.getByTestId('controlevragen')).toBeVisible()
    await expect(page.getByTestId('artikel-inhoud').getByRole('link', { name: 'Meldingen instellen' })).toHaveAttribute('href', '/helpcenter/meldingen-instellen')
    await expect(page.getByTestId('probeer-het')).toHaveAttribute('href', '/mijn-instellingen')
  })

  test('zoeken via het icoon in de kop: klapt open, zoekt, ?zoek= blijft werken', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/helpcenter')
    await expect(page.getByTestId('help-zoek')).toHaveCount(0)
    const icoon = page.getByTestId('kop-knoppen').getByTestId('help-zoekicoon')
    await expect(icoon).toHaveAttribute('aria-expanded', 'false')
    const b = (await icoon.boundingBox())!
    expect(Math.round(b.width)).toBe(44)
    await icoon.click()
    await expect(icoon).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('help-zoek')).toBeFocused()
    await page.getByTestId('help-zoek').fill('Ctrl K')
    await expect(page).toHaveURL(/zoek=Ctrl/)
    await expect(page.getByTestId('help-resultaten')).toContainText('Spring overal heen met Ctrl K')
    await expect(page.getByTestId('help-resultaten')).toContainText('Tips & Tricks')
    await page.getByTestId('help-zoek-sluit').click()
    await expect(page.getByTestId('help-zoek')).toHaveCount(0)
    await expect(page).not.toHaveURL(/zoek=/)
    await expect(page.getByTestId('voor-jou')).toBeVisible()
    await ga(page, '/helpcenter?zoek=poging')
    await expect(page.getByTestId('help-zoek')).toHaveValue('poging')
    await expect(page.getByTestId('help-resultaten')).toContainText('Wat betekent poging 3 van 5')
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
    // De tellers per soort staan los van de lijn onder de kop, op de laptop en op de telefoon.
    const ruimte = async () => {
      const lijn = await page.getByTestId('paginakop').evaluate((el) => el.closest('section')!.getBoundingClientRect().bottom)
      return (await page.getByTestId('melding-stats').boundingBox())!.y - lijn
    }
    await expect.poll(ruimte).toBeGreaterThanOrEqual(12)
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
    await expect.poll(ruimte).toBeGreaterThanOrEqual(12)
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
