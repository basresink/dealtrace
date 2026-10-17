import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

// De managerpagina's /team, /coaching, /analyse en /audit in de opzet van de app: kop met kicker, verbale
// titel en een primaire actie, Filters met filterpaneel en filters in de link, klikbare cijfers die in een
// flyout tonen wat erachter zit. Op 1280 en 390 px zonder horizontale scroll.
const geenScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

for (const breedte of [1280, 390]) {
  test.describe(`managerpagina's op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('team: verbale kop, cijfer met flyout, filter periode in de link', async ({ page }) => {
      await login(page, 'u-04')
      await ga(page, '/team')
      await expect(page.getByTestId('team-kicker')).toContainText('Deze week')
      await expect(page.locator('h1.title')).toContainText('tempo')
      await expect(page.getByTestId('team-plan-coaching')).toBeVisible()
      await page.getByTestId('team-cijfer-achterstallig').click()
      const fly = page.getByTestId('cijfer-flyout')
      await expect(fly).toContainText('Taken over tijd per accountmanager')
      await fly.getByTestId('cijfer-regels').locator('button').first().click()
      await expect(fly).toContainText('Achterstallig')
      await page.keyboard.press('Escape')
      await expect(fly).toHaveCount(0)
      await page.getByTestId('team-filters').click()
      await page.getByTestId('tf-periode-maand').click()
      await expect(page).toHaveURL(/periode=maand/)
      await expect(page.getByTestId('team-kicker')).toContainText('Deze maand')
      if (breedte < 500) await page.getByTestId('tf-toon').click()
      await geenScroll(page)
    })

    test('coaching: wie wacht, open afspraken, cijferflyout en gesprek plannen', async ({ page }) => {
      await login(page, 'u-04')
      await ga(page, '/coaching')
      await expect(page.locator('h1.title')).toContainText('coachingsgesprek')
      await expect(page.getByTestId('coaching-rij-u-07')).toContainText('Eva Ervaren')
      await expect(page.getByTestId('coaching-afspraken')).toBeVisible()
      await page.getByTestId('coaching-cijfer-nodig').click()
      await expect(page.getByTestId('cijfer-flyout')).toContainText('Wie wacht op een gesprek')
      await page.keyboard.press('Escape')
      await page.getByTestId('coaching-filters').click()
      await page.getByTestId('cf-stand-op-ritme').click()
      await expect(page).toHaveURL(/stand=op-ritme/)
      if (breedte < 500) await page.getByTestId('cf-toon').click()
      await expect(page.getByTestId('coaching-chip-stand')).toBeVisible()
      await page.getByTestId('coaching-plan').click()
      await expect(page.getByTestId('plan-coaching')).toBeVisible()
      await expect(page.getByTestId('pc-moment')).not.toHaveValue('')
      await page.keyboard.press('Escape')
      await geenScroll(page)
    })

    test('analyse: titel uit de cijfers, tegel met flyout, wat valt op, persoon in de link', async ({ page }) => {
      await login(page, 'u-04')
      await ga(page, '/analyse?tab=activiteit')
      await expect(page.getByTestId('analyse-kicker')).toContainText('Activiteit')
      await expect(page.getByTestId('analyse-cijfers')).toBeVisible()
      await page.getByTestId('analyse-cijfer-afspraken').click()
      await expect(page.getByTestId('cijfer-flyout')).toContainText('Afspraken per accountmanager')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('analyse-opvallend')).toBeVisible()
      await expect(page.getByTestId('analyse-download')).toHaveAttribute('href', /formaat=csv/)
      await page.getByTestId('analyse-filters').click()
      await page.getByTestId('af-persoon-u-07').click()
      await expect(page).toHaveURL(/persoon=u-07/)
      await expect(page.getByTestId('analyse-kicker')).toContainText('Eva Ervaren')
      if (breedte < 500) await page.getByTestId('af-toon').click()
      await geenScroll(page)
    })

    test('audit: kop met stand, filters achter de knop, cijfer per persoon', async ({ page }) => {
      await login(page, 'u-04')
      await ga(page, '/audit')
      await expect(page.getByTestId('audit-kicker')).toContainText('Laatste 7 dagen')
      await expect(page.getByTestId('audit-filters')).toHaveCount(0)
      await page.getByTestId('audit-filters-knop').click()
      await expect(page.getByTestId('audit-filters')).toBeVisible()
      const cijfer = page.getByTestId('audit-cijfers').locator('.stat-card').first()
      if (await cijfer.count()) {
        await cijfer.click()
        await expect(page.getByTestId('cijfer-flyout')).toBeVisible()
        await page.keyboard.press('Escape')
      }
      await geenScroll(page)
    })
  })
}
