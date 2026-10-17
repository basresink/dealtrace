// W5: Alle prospects zonder klantenlink en zonder Meer, met klikbare contacticonen; Mijn dashboard met de
// knop Funnel (Funnel niet meer in de zijbalk); bij welke poging de eerste afspraak kwam op dashboard en funnel.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

for (const breedte of [1280, 390]) {
  test.describe(`op ${breedte} px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 }) })

    test('Alle prospects: geen klantenlink, geen Meer, export in het filterpaneel en contacticoon naar de contactpersoon', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/prospects/alle')
      await expect(page.getByText('Klanten zie je bij')).toHaveCount(0)
      await expect(page.locator('.subtitle a[href="/klanten"]')).toHaveCount(0)
      await expect(page.getByTestId('kop-meer')).toHaveCount(0)
      await expect(page.getByTestId('lijst-taak')).toHaveCount(0)
      // Exporteren blijft bereikbaar onderaan het filterpaneel (Eva is Expert).
      await page.getByTestId('filters-knop').click()
      await expect(page.getByTestId('filterpaneel').getByTestId('exporteren')).toHaveAttribute('href', /\/api\/accounts\/export\?.*soort=prospect/)
      await page.getByTestId('filters-knop').click()
      const icoon = page.getByTestId('rij-contact').first()
      await expect(icoon).toBeVisible()
      await expect(icoon).toHaveAttribute('aria-label', /^Open contactpersoon \S/)
      const href = (await icoon.getAttribute('href'))!
      expect(href).toMatch(/^\/contacten\/[^/]+$/)
      if (breedte < 500) {
        const b = (await icoon.boundingBox())!
        expect(b.width).toBeGreaterThanOrEqual(44)
        expect(b.height).toBeGreaterThanOrEqual(44)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      await icoon.click()
      await expect(page).toHaveURL(new RegExp(`${href}$`))
    })

    test('Mijn dashboard: knop Funnel in plaats van Meer; Funnel niet in de zijbalk', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/mijn-dashboard')
      await expect(page.getByTestId('kop-meer')).toHaveCount(0)
      const knop = page.getByTestId('knop-funnel')
      await expect(knop).toBeVisible()
      await expect(knop).toHaveText('Funnel')
      await expect(page.locator('.sb-nav a[href="/funnel"]')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      await knop.click()
      await expect(page).toHaveURL(/\/funnel$/)
      await expect(page.getByTestId('funnel-tegels')).toBeVisible()
    })

    test('bij welke poging de eerste afspraak kwam: in de drie dashboardblokken en op de funnel, gelijk aan de API', async ({ page }) => {
      await login(page, 'u-07')
      const api = await (await page.request.get('/api/resultaten/dashboard')).json()
      const ea = api.funnel.eersteAfspraak
      expect(ea.accounts).toBe(Object.values(ea.verdeling as Record<string, number>).reduce((s, n) => s + n, 0))
      expect(ea.accounts).toBeGreaterThan(0)
      const gem = ea.gemiddeld.toLocaleString('nl-NL')
      await ga(page, '/mijn-dashboard')
      const reis = page.getByTestId('reis-eerste-afspraak')
      await expect(reis).toContainText(`gemiddeld bij poging ${gem}`)
      for (const [k, sleutel] of [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4+']]) await expect(reis.getByTestId(`eerste-afspraak-${k}`)).toContainText(String(ea.verdeling[sleutel!]))
      await expect(page.getByTestId('grafiek-uitkomsten').getByTestId('uitkomsten-eerste-afspraak')).toContainText(`${ea.verdeling['4+']} bij poging 4 of later`)
      await expect(page.getByTestId('grafiek-dekking').getByTestId('dekking-eerste-afspraak')).toContainText(`gemiddeld bij poging ${gem}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      await ga(page, '/funnel')
      await expect(page.getByTestId('funnel-eerste-afspraak')).toContainText(`gemiddeld bij poging ${gem}`)
      await expect(page.getByTestId('pogingen')).toContainText(`gemiddeld bij poging ${gem}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
    })
  })
}
