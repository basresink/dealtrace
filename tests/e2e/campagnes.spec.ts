// P16: Campagnes in de opzet van DealDrive. Overzicht met kop, tellers, filters en kaarten; het bord met
// kop, tempo, Begin hier, kolommen, KolomVenster en de lijstweergave.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('Campagnes', () => {
  test('overzicht: kop, tellers per status, filterpaneel en kaarten met soort, status, doel en voortgang', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/campagnes?eigenaar=alle')
    await expect(page.locator('h1.title')).toHaveText('Eén lijst, één doel, elke dag een stap.')
    await expect(page.getByTestId('campagne-nieuw')).toBeVisible()
    const actief = Number(await page.getByTestId('campagne-stat-actief').locator('.stat-num').textContent())
    expect(actief).toBeGreaterThan(0)
    const kaart = page.getByTestId('campagne-cp-01')
    await expect(kaart).toContainText('Koude belronde installateurs')
    await expect(kaart.locator('.co-soort')).toBeVisible()
    await expect(kaart.locator('.co-status')).toHaveText(/Actief/i)
    await expect(kaart).toContainText('Doel:')
    await expect(kaart.getByTestId('tempopil')).toBeVisible()
    await expect(kaart.getByRole('progressbar')).toBeVisible()
    // De teller Concept filtert op status; cp-01 (actief) verdwijnt.
    await page.getByTestId('campagne-stat-concept').click()
    await expect(page).toHaveURL(/status=concept/)
    await expect(page.getByTestId('campagne-cp-01')).toHaveCount(0)
    // Filterpaneel: status met vinkjes en tellingen, soort en eigenaar.
    await page.getByTestId('campagne-filters').click()
    await expect(page.getByTestId('campagne-filterbalk')).toBeVisible()
    await page.getByTestId('status-actief').check()
    await expect(page).toHaveURL(/status=concept%2Cactief|status=concept,actief/)
    await expect(page.getByTestId('campagne-cp-01')).toBeVisible()
    await expect(page.getByTestId('filter-eigenaar')).toBeVisible()
    await page.getByTestId('campagne-cp-01').click()
    await expect(page).toHaveURL(/\/campagnes\/cp-01/)
  })

  test('bord: kop met winpunt, doel en stand, tempo, Begin hier, kolommen, KolomVenster en lijst', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/campagnes/cp-01')
    await expect(page.getByTestId('bord-kop')).toContainText('Winpunt')
    await expect(page.getByTestId('stand')).toHaveText(/\d+ van \d+ afspraken/)
    await expect(page.getByTestId('bord-tempo')).toBeVisible()
    await expect(page.getByTestId('plus-accounts')).toBeVisible()
    for (const k of ['gespot', 'benaderd', 'in-gesprek', 'afspraak', 'geparkeerd', 'afgewezen']) await expect(page.getByTestId(`kolom-${k}`)).toBeVisible()
    // Naar Afspraak vraagt de uitkomst; annuleren laat het account staan.
    const kaart = page.getByTestId('kolom-gespot').locator('[data-test^=kaart-]').first()
    const accountId = (await kaart.getAttribute('data-test'))!.replace('kaart-', '')
    await page.getByTestId(`verplaats-${accountId}`).selectOption('afspraak')
    await expect(page.getByTestId('kolom-venster')).toBeVisible()
    await page.getByTestId('kolom-venster').getByRole('button', { name: 'Annuleren' }).click()
    await expect(page.getByTestId('kolom-gespot').getByTestId(`kaart-${accountId}`)).toBeVisible()
    // + Accounts opent de AccountKiezer.
    await page.getByTestId('plus-accounts').click()
    await expect(page.getByTestId('accounts-toevoegen').getByTestId('account-zoek')).toBeVisible()
    // Lijstweergave en terug naar het overzicht.
    await page.getByTestId('weergave-lijst').click()
    await expect(page.getByTestId('lijst')).toBeVisible()
    await page.getByTestId('terug-campagnes').click()
    await expect(page).toHaveURL(/\/campagnes$/)
  })

  test('390 px: overzicht en bord zonder horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-07')
    for (const pad of ['/campagnes?eigenaar=alle', '/campagnes/cp-01']) {
      await ga(page, pad)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    }
  })
})
