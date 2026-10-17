// /briefings in de opzet van DealDrive met wat Dealtrace al had: dagen met kaarten (achterstallig rood bovenaan),
// soorten met een eigen kleur, filters met chips in de link, de flyout met drie regels en de hele briefing (soort met
// reden, genummerde blokken, eigen tekst per blok met opslaan-status), en zelf opzoeken in één veld. Laptop en telefoon.
import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

const uniek = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
const naam = () => `Testbrief ${Array.from({ length: 2 }, () => Array.from({ length: 5 }, () => 'bcdfghjklmnprstvwz'[Math.floor(Math.random() * 18)] + 'aeiou'[Math.floor(Math.random() * 5)]).join('').slice(0, 7)).join(' ')}`
const opDag = (dagen: number) => { const d = new Date(Date.now() + dagen * 864e5); d.setUTCHours(9, 0, 0, 0); return d.toISOString() }

/** Een prospect met een beslisser, een achterstallige beltaak (twee dagen terug) en een beltaak over twee dagen. */
async function metBeltaken(request: APIRequestContext, gebruiker: string) {
  await apiLogin(request, gebruiker)
  const accountNaam = naam()
  const { id: accountId } = await (await request.post('/api/accounts', { data: { naam: accountNaam } })).json()
  const contact = await (await request.post('/api/contacten', { data: { accountId, voornaam: 'Iris', achternaam: `Testbrief ${uniek()}`, rol: 'beslisser', functie: 'Directeur' } })).json()
  const maak = async (titel: string, dueDate: string) => (await (await request.post('/api/tasks', { data: { title: titel, actionType: 'bellen', accountId, contactId: contact.id, dueDate } })).json())
  const laat = await maak(`Bel over de levering ${uniek()}`, opDag(-2))
  const later = await maak(`Bel na de demo ${uniek()}`, opDag(2))
  return { accountId, accountNaam, contact, laat: laat.id ?? laat.taak?.id, later: later.id ?? later.taak?.id }
}

test.describe('briefings: dagen, kaarten, soorten en zelf opzoeken', () => {
  test('laptop: achterstallig bovenaan, filters met chips, flyout met soort en eigen tekst', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1280, height: 900 })
    const x = await metBeltaken(page.request, 'u-03')
    expect(x.laat, 'achterstallige taak').toBeTruthy()
    await login(page, 'u-03')
    await ga(page, '/briefings')
    await expect(page.getByTestId('briefings-kicker')).toContainText('Taken · Briefings')
    // Deze week (standaard): de achterstallige taak staat in de rode groep Achterstallig.
    const laatGroep = page.getByTestId('briefings-dag-laat')
    await expect(laatGroep).toContainText('Achterstallig')
    const kaart = page.getByTestId(`briefing-kaart-${x.laat}`)
    await expect(kaart).toBeVisible()
    await expect(kaart).toContainText(x.accountNaam)
    await expect(kaart).toContainText('Iris')
    await expect(kaart.getByTestId('briefing-compleet')).toHaveText(/(\d+ van \d+|Alle \d+) blokken bekend/)
    await expect(kaart.getByTestId('briefing-kaart-soort')).toHaveText('Eerste gesprek')
    await expect(laatGroep.locator('.bfp-dagkop')).toHaveCSS('border-bottom-color', /rgb\(/)
    // Kaarten in een raster van drie.
    const kolommen = await page.locator('.bfp-raster').first().evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
    expect(kolommen).toBe(3)

    // Periode Alle: de latere taak staat onder zijn eigen dag.
    await page.getByTestId('briefings-filters').click()
    await page.getByTestId('bf-periode-alle').click()
    await expect(page).toHaveURL(/periode=alle/)
    await expect(page.getByTestId('chip-periode')).toContainText('Alle')
    await expect(page.getByTestId(`briefing-kaart-${x.later}`)).toBeVisible()
    // Status Achterstallig: alleen wat over tijd is.
    await page.getByTestId('bf-status-laat').click()
    await expect(page).toHaveURL(/status=laat/)
    await expect(page.getByTestId(`briefing-kaart-${x.later}`)).toHaveCount(0)
    await expect(page.getByTestId(`briefing-kaart-${x.laat}`)).toBeVisible()
    // Soort: meer dan één tegelijk, elk als chip.
    await page.getByTestId('bf-soort-eerste-gesprek').click()
    await page.getByTestId('bf-soort-verdieping').click()
    await expect(page).toHaveURL(/soort=eerste-gesprek%2Cverdieping|soort=eerste-gesprek,verdieping/)
    await expect(page.getByTestId('chip-soort-eerste-gesprek')).toBeVisible()
    await expect(page.getByTestId('chip-soort-verdieping')).toBeVisible()
    await expect(page.getByTestId(`briefing-kaart-${x.laat}`)).toBeVisible()
    // Een chip wissen en daarna alles wissen.
    await page.getByTestId('chip-soort-verdieping').getByRole('button').click()
    await expect(page.getByTestId('chip-soort-verdieping')).toHaveCount(0)
    await page.getByTestId('chips-wis-alles').click()
    await expect(page).not.toHaveURL(/status=|soort=|periode=/)
    // Weergave Lijst: dezelfde briefing als rij.
    await page.getByTestId('bf-weergave-lijst').click()
    await expect(page).toHaveURL(/weergave=lijst/)
    await expect(page.getByTestId(`briefing-kaart-${x.laat}`)).toHaveClass(/item-rij/)
    await page.getByTestId('briefings-filters-sluit').click()
    await expect(page.getByTestId('briefings-filterpaneel')).toHaveCount(0)

    // De flyout: eerst drie regels, dan de hele briefing.
    await page.getByTestId(`briefing-kaart-${x.laat}`).click()
    const venster = page.getByTestId('briefing-venster')
    await expect(venster).toBeVisible()
    await expect(venster.getByTestId('briefing-regels').locator('li')).not.toHaveCount(0)
    await venster.getByTestId('briefing-tab-hele').click()
    await expect(venster.getByTestId('briefing-soort-eerste-gesprek')).toHaveAttribute('aria-pressed', 'true')
    await expect(venster.locator('[data-test^="briefing-soort-"][aria-pressed="true"]')).toHaveCount(1)
    await expect(venster.getByTestId('briefing-soortreden')).toContainText(/Automatisch gekozen: .+\./)
    await expect(venster.getByTestId('blok-bedrijf').locator('.bfd-nr')).toHaveText('1')
    // Eigen tekst in een blok, met de opslaan-status in de kop.
    await venster.getByTestId('bewerk-opening').click()
    await venster.getByTestId('tekst-opening').fill('Hoe plannen jullie de levering per bouwfase?')
    await expect(venster.getByTestId('briefing-opslag')).toContainText('Gewijzigd')
    await venster.getByTestId('bewaar-opening').click()
    await expect(venster.getByTestId('briefing-opslag')).toContainText('Opgeslagen om')
    await expect(venster.getByTestId('blok-opening')).toContainText('Eigen tekst')
    await expect(venster.getByTestId('blok-opening')).toContainText('Hoe plannen jullie de levering per bouwfase?')
    // Na een gesprek dat voorbij is: Doel gehaald?
    await expect(venster.getByTestId('doel-gehaald')).toBeVisible()
    // Voet: de taak openen en de accountkaart.
    await expect(venster.getByTestId('briefing-open-account')).toHaveAttribute('href', `/accounts/${x.accountId}`)
    await expect(venster.getByTestId('briefing-afdrukken')).toBeVisible()
    await venster.getByTestId('briefing-open-item').click()
    await expect(venster).toHaveCount(0)
    await expect(page.locator('[role="dialog"]').first()).toBeVisible()
  })

  test('telefoon: geen horizontale scroll, filters als blad, zoeken en de flyout met tikdoelen van 44 px', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const x = await metBeltaken(page.request, 'u-03')
    await login(page, 'u-03')
    await ga(page, '/briefings')
    await expect(page.getByTestId(`briefing-kaart-${x.laat}`)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // Eén kaart per rij.
    expect(await page.locator('.bfp-raster').first().evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1)
    // Filters als blad van onderen met "Toon N briefings".
    await page.getByTestId('briefings-filters').click()
    const blad = page.getByRole('dialog', { name: 'Filters' })
    await expect(blad).toBeVisible()
    const pil = blad.getByTestId('bf-status-laat')
    expect(Math.round((await pil.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
    await pil.click()
    await expect(page).toHaveURL(/status=laat/)
    await expect(blad.getByTestId('briefings-toon')).toHaveText(/Toon \d+ briefings?/)
    await blad.getByTestId('briefings-toon').click()
    await expect(blad).toHaveCount(0)
    await expect(page.getByTestId('chip-status')).toBeVisible()
    // Zelf opzoeken: het bedrijf opent zijn briefing in de flyout.
    await page.getByTestId('bf-zoek').fill(x.accountNaam)
    await page.getByTestId('bf-zoek-optie').filter({ hasText: x.accountNaam }).first().click()
    const gekozen = page.getByTestId('briefing-gekozen')
    await expect(gekozen.getByTestId('briefing')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    for (const knop of await gekozen.locator('.fo-foot .dd-act').all()) expect(Math.round((await knop.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
    await gekozen.getByRole('button', { name: 'Sluiten' }).click()
    await expect(gekozen).toHaveCount(0)
  })
})
