import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// Instellingen, SalesDNA (verkoopverhaal): elk tabblad toont één kaart met de status, één primaire
// actie (Bevestig), velden met het label erboven, regels als vlakken met Verwijder en de knop om
// toe te voegen. Eigen aanvullingen en voorstellen staan eronder. Op 1280 en 390 px.

const ONDERDELEN = ['golden_circle', 'bedrijfsverhaal', 'ambitie', 'waarde', 'branches', 'concurrenten', 'winpunten', 'terugkomregels']

for (const breedte of [1280, 390]) {
  test.describe(`Verkoopverhaal op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('elk tabblad: kaart met status, één primaire actie en geen horizontale scroll', async ({ page }) => {
      await login(page, 'u-06')
      await ga(page, '/instellingen/verkoopverhaal')
      for (const o of ONDERDELEN) {
        await page.getByTestId(`vv-tab-${o}`).click()
        const kaart = page.getByTestId(`vv-${o}`)
        await expect(kaart).toBeVisible()
        await expect(kaart.getByTestId('vv-status')).toBeVisible()
        const gespiegeld = await kaart.getByTestId('vv-gespiegeld').count()
        if (!gespiegeld) {
          await expect(kaart.getByTestId('vv-bevestig')).toHaveClass(/dd-actie--primair/)
          await expect(kaart.locator('.dd-actie--primair')).toHaveCount(1)
        }
        if (['branches', 'concurrenten', 'winpunten', 'terugkomregels'].includes(o)) await expect(kaart.getByTestId('vv-nieuw')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        if (breedte < 500) {
          const klein = await kaart.locator('button:visible, input:visible, select:visible').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length)
          expect(klein).toBe(0)
        }
      }
      await expect(page.getByTestId('vv-aanvullingen')).toBeVisible()
      await expect(page.getByTestId('vv-voorstellen')).toBeVisible()
    })
  })
}
