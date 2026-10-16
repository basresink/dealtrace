import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// Meetings in de opzet van DealDrive: kop, filterstrook in de URL, lijst per week en dag of de
// lege staat, en de Meetinglijst met uitleg, advies en een planknop die het afspraakvenster opent.
test.describe('meetings', () => {
  test('kop, lijst per dag en filters in de URL', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meetings')
    await expect(page.getByTestId('meetings-kicker')).toContainText('Komende 30 dagen')
    await expect(page.locator('h1.title')).toHaveText('Elk gesprek op het juiste moment.')
    await expect(page.getByTestId('meetings-bezoeken')).toHaveAttribute('href', '/bezoeken')
    await expect(page.locator('[data-test^="meeting-"]').first()).toBeVisible()
    await expect(page.getByTestId('meetings-filters')).toHaveCount(0)
    await page.getByTestId('meetings-filterknop').click()
    await page.getByTestId('meetings-vorm-intern').click()
    await expect(page).toHaveURL(/vorm=intern/)
    await expect(page.locator('.mt-vorm--online')).toHaveCount(0)
    await page.locator('[data-test^="meeting-"]').first().click()
    await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
  })

  test('Meetinglijst: uitleg, advies en planknop met account en vorm', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meetings')
    const lijst = page.getByTestId('aan-de-beurt')
    await expect(lijst).toContainText('Wie is er aan de beurt?')
    await expect(page.getByTestId('meeting-analyse')).toBeVisible()
    const rij = lijst.locator('[data-test^="beurt-"]').filter({ has: page.locator('button') }).first()
    await expect(rij.locator('.pil')).toHaveText(/vandaag|deze week|Fysiek/i)
    await rij.locator('button').click()
    const flyout = page.getByTestId('plan-afspraak')
    await expect(flyout).toBeVisible()
    const naam = (await rij.locator('.mt-plan-naam').textContent())!.split(' · ')[0]!
    await expect(flyout).toContainText(naam)
    await expect(page.getByTestId('pa-vorm-telefoon')).toHaveAttribute('aria-checked', 'true')
  })

  test('lege staat met Eerste meeting', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/meetings?vorm=intern')
    // u-01 heeft geen intern overleg: dan wel de filter-lege staat of de lege staat.
    const leeg = page.locator('[data-test="meetings-leeg"], [data-test="meetings-leeg-filter"]')
    await expect(leeg).toBeVisible()
  })
})
