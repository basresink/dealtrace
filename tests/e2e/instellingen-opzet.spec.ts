// Eén opzet voor elk scherm onder Instellingen (InstellingenKop): de kruimel "Instellingen · <groep>" met
// een terug-link naar de hub, een titel, geen horizontale scroll, en op een lijst de knop Filters met
// een paneel. Op 1280 en 390 px, als beheerder (u-06). /instellingen/regels hoort bij een ander pakket.
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga } from './hulp'

const PAGINAS: [string, string][] = [
  ['/instellingen/organisatie', 'Organisatie'],
  ['/instellingen/gebruikers', 'Organisatie'],
  ['/instellingen/niveaus', 'Organisatie'],
  ['/instellingen/abonnement', 'Organisatie'],
  ['/instellingen/verbruik', 'Organisatie'],
  ['/instellingen/audit', 'Organisatie'],
  ['/instellingen/verkoopverhaal', 'Verkoop'],
  ['/instellingen/belscripts', 'Verkoop'],
  ['/instellingen/mailsjablonen', 'Verkoop'],
  ['/instellingen/opvolgreeksen', 'Verkoop'],
  ['/instellingen/meetingsoorten', 'Verkoop'],
  ['/instellingen/campagnesoorten', 'Verkoop'],
  ['/instellingen/funnel-normen', 'Verkoop'],
  ['/instellingen/terugkomen', 'Verkoop'],
  ['/instellingen/ritme', 'Ritme en regels'],
  ['/instellingen/gebieden', 'Ritme en regels'],
  ['/instellingen/privacy', 'Data en AI'],
  ['/instellingen/eigen-velden', 'Data en AI'],
  ['/instellingen/agents', 'Data en AI'],
  ['/instellingen/waarnemer', 'Data en AI'],
  ['/instellingen/prompts', 'Data en AI'],
  ['/instellingen/kanalen', 'Data en AI'],
  ['/instellingen/koppelingen/salesdna', 'Koppelingen'],
  ['/instellingen/koppelingen/agenda', 'Koppelingen'],
  ['/instellingen/mail', 'Koppelingen'],
  ['/instellingen/koppelingen/crm', 'Koppelingen'],
  ['/instellingen/koppelingen/dealdrive', 'Koppelingen'],
  ['/instellingen/help', 'Helpcenter'],
]

const geenScroll = async (page: Page) => {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(sw).toBeLessThanOrEqual(w)
}

test.describe('Instellingen in één opzet', () => {
  for (const breedte of [1280, 390]) {
    for (const [pad, groep] of PAGINAS) {
      test(`${pad}: standaardkop en de weg terug (${breedte} px)`, async ({ page }) => {
        await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
        await apiLogin(page.request, 'u-06')
        await ga(page, pad)
        const kop = page.getByTestId('paginakop')
        await expect(kop).toBeVisible()
        await expect(kop.getByTestId('inst-kicker')).toHaveText(new RegExp(`Instellingen\\s*·\\s*${groep}`))
        const terug = kop.getByTestId('terug-instellingen')
        await expect(terug).toBeVisible()
        await expect(terug).toHaveAttribute('href', '/instellingen')
        if (breedte < 720) expect((await terug.boundingBox())!.height, 'tikdoel terug').toBeGreaterThanOrEqual(44)
        await expect(kop.locator('h1')).toHaveCount(1)
        expect((await kop.locator('h1').innerText()).trim().length).toBeGreaterThan(3)
        await geenScroll(page)
      })
    }
  }

  test('de terug-link brengt je naar de hub, die zelf geen terug-link heeft', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    await ga(page, '/instellingen/campagnesoorten')
    await page.getByTestId('terug-instellingen').click()
    await expect(page).toHaveURL(/\/instellingen$/)
    await expect(page.getByTestId('inst-kicker')).toHaveText(/Instellingen · Beheer/)
    await expect(page.getByTestId('terug-instellingen')).toHaveCount(0)
  })

  test('Filters opent een paneel en filtert de lijst (campagnesoorten en de hub)', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    await ga(page, '/instellingen/campagnesoorten')
    const rijen = page.getByTestId('cs-lijst').locator('.rij')
    const alle = await rijen.count()
    expect(alle).toBeGreaterThan(0)
    await page.getByTestId('inst-filters').click()
    const paneel = page.getByTestId('inst-filterpaneel')
    await expect(paneel).toBeVisible()
    await paneel.getByRole('button', { name: 'Uit', exact: true }).click()
    await expect(page.getByTestId('inst-filters')).toContainText('1')
    await paneel.getByTestId('inst-filters-reset').click()
    await expect(rijen).toHaveCount(alle)

    await ga(page, '/instellingen')
    await page.getByTestId('inst-filters').click()
    await page.getByTestId('hub-zoek').fill('mailsjablonen')
    await expect(page.getByTestId('kaart-Mailsjablonen')).toBeVisible()
    await expect(page.getByTestId('kaart-Regels')).toHaveCount(0)
  })
})
