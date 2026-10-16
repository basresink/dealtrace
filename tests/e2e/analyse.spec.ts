import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// Bezoekanalyse en meetinganalyse in de opzet van DealDrive: de knoppen rechtsboven op Bezoeken en
// Meetings, de doorverwijzing van /analyse/regio, cijfers, dekkingstabel met flyout, filters in de
// URL, het teambeeld voor de salesmanager, Download en de pagina "Nog niet aangezet" voor Beginner.
test.describe('bezoekanalyse', () => {
  test('knop Bezoekanalyse rechtsboven op Bezoeken en terug', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/bezoeken')
    await page.getByTestId('kop-knoppen').getByTestId('kop-meer').click()
    const knop = page.getByTestId('kop-knoppen').getByTestId('bezoekanalyse-knop')
    await expect(knop).toHaveText('Bezoekanalyse')
    await expect(page.getByTestId('regio-analyse')).toHaveCount(0)
    await knop.click()
    await expect(page).toHaveURL(/\/bezoek-analyse$/)
    await expect(page.locator('h1.title')).toHaveText('Waar laat je omzet liggen?')
    await page.getByTestId('ba-terug').click()
    await expect(page).toHaveURL(/\/bezoeken/)
  })

  test('/analyse/regio stuurt door met de query', async ({ page }) => {
    await login(page, 'u-04')
    await ga(page, '/analyse/regio?scope=team')
    await expect(page).toHaveURL(/\/bezoek-analyse\?scope=team$/)
    await expect(page.getByTestId('ba-kicker')).toContainText('Team')
  })

  test('cijfers, regiotabel met flyout, bezoeken, routes en filters in de URL', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/bezoek-analyse')
    await expect(page.getByTestId('ba-kicker')).toHaveText('Rapportage · Bezoekanalyse')
    await expect(page.getByTestId('ba-kpi-inbeeld')).toContainText('Accounts in beeld')
    await expect(page.getByTestId('ba-kpi-dekking')).toContainText('Bezocht in 90 dagen')
    await expect(page.getByTestId('afspraak-cijfers')).toBeVisible()
    await expect(page.getByTestId('ba-routes')).toContainText('Benut je je regiodagen?')
    await expect(page.getByTestId('ba-kansen')).toContainText('Inloopbezoeken')

    const rij = page.getByTestId('regio-tabel').locator('tbody tr').first()
    await rij.getByRole('button', { name: 'Openen' }).click()
    const flyout = page.getByTestId('analyse-flyout')
    await expect(flyout).toBeVisible()
    await expect(flyout).toContainText('Laatste bezoek')
    await expect(flyout.locator('tbody tr').first()).toBeVisible()
    await flyout.locator('[data-test^="aaf-plan-"]').first().click()
    await expect(page.getByTestId('plan-afspraak')).toBeVisible()
    await expect(page.getByTestId('pa-vorm-bezoek')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')

    await ga(page, '/bezoek-analyse')
    await page.getByTestId('ba-filters').click()
    await page.getByTestId('af-venster-week').click()
    await expect(page).toHaveURL(/venster=week/)
    await expect(page.getByTestId('ba-kpi-dekking')).toContainText('Bezocht in 7 dagen')
    await page.getByTestId('af-venster-periode').click()
    await expect(page).toHaveURL(/venster=periode&van=\d{4}-\d{2}-\d{2}&tot=/)
    await expect(page.getByTestId('af-van')).toBeVisible()
    await page.getByTestId('af-soort-inventarisatie').click()
    await expect(page).toHaveURL(/soort=inventarisatie/)
    await expect(page.getByTestId('ba-kpi-stil')).toContainText('Inventarisatie', { ignoreCase: true })
  })

  test('Download geeft een CSV', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/bezoek-analyse')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('ba-download').click()])
    expect(download.suggestedFilename()).toMatch(/^bezoekanalyse-.*\.csv$/)
  })

  test('teambeeld en een persoon voor de salesmanager', async ({ page }) => {
    await login(page, 'u-04')
    await ga(page, '/bezoek-analyse')
    await page.getByTestId('ba-filters').click()
    await page.getByTestId('af-scope-team').click()
    await expect(page).toHaveURL(/scope=team/)
    await expect(page.getByTestId('ba-kicker')).toContainText('Team')
    await expect(page.getByTestId('ba-routetabel')).toContainText('Wie')
    await page.getByTestId('af-persoon-u-07').click()
    await expect(page).toHaveURL(/persoon=u-07/)
    await expect(page.getByTestId('ba-kicker')).toContainText('Eva Ervaren')
  })
})

test.describe('meetinganalyse', () => {
  test('knop Analyse rechtsboven op Meetings; geen knop meer bij de Meetinglijst', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meetings')
    await expect(page.getByTestId('aan-de-beurt')).toBeVisible()
    await expect(page.getByTestId('meeting-analyse')).toHaveCount(0)
    await page.getByTestId('kop-knoppen').getByTestId('kop-meer').click()
    const knop = page.getByTestId('kop-knoppen').getByTestId('meetings-analyse')
    await expect(knop).toHaveText('Meetinganalyse')
    await knop.click()
    await expect(page).toHaveURL(/\/meeting-analyse$/)
    await page.getByTestId('ma-terug').click()
    await expect(page).toHaveURL(/\/meetings/)
  })

  test('cijfers, klassetabel met flyout, meetings per soort en filters in de URL', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meeting-analyse')
    await expect(page.locator('h1.title')).toHaveText('Haal je je meetingritme?')
    await expect(page.getByTestId('ma-kpi-doel')).toContainText('Doel volgens afspraakmatrix')
    await expect(page.getByTestId('ma-kpi-dekking')).toContainText('Ritmedekking')
    await expect(page.getByTestId('klasse-rij-A')).toContainText('per jaar')
    await expect(page.getByTestId('ac-transcript')).toContainText('Notulist')
    await expect(page.getByTestId('ac-doorlooptijd')).toContainText('Doorlooptijd naar vervolg')
    await expect(page.getByTestId('ac-soort-kennismaking')).toBeVisible()
    await expect(page.getByTestId('ma-regiotabel')).toBeVisible()

    await page.getByTestId('klasse-open-A').click()
    const flyout = page.getByTestId('analyse-flyout')
    await expect(flyout).toContainText('Laatste meeting')
    await page.getByTestId('analyse-flyout-sluit').click()
    await expect(flyout).toHaveCount(0)

    await page.getByTestId('ma-filters').click()
    await page.getByTestId('af-vorm-online').click()
    await expect(page).toHaveURL(/vorm=online/)
    await expect(page.getByTestId('ma-kpi-gehouden')).toContainText('van het gekozen type')
    await expect(page.getByTestId('ac-soort-belafspraak')).toHaveCount(0)
    await page.getByTestId('af-venster-maand').click()
    await expect(page).toHaveURL(/venster=maand/)
  })

  test('Download geeft een CSV', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meeting-analyse')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('ma-download').click()])
    expect(download.suggestedFilename()).toMatch(/^meetinganalyse-.*\.csv$/)
  })

  test('Beginner ziet bij beide analyses "Nog niet aangezet" en geen knoppen', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/meeting-analyse')
    await expect(page.getByTestId('niet-aangezet-pagina')).toContainText('Meetinganalyse')
    await ga(page, '/bezoek-analyse')
    await expect(page.getByTestId('niet-aangezet-pagina')).toContainText('Bezoekanalyse')
    await ga(page, '/meetings')
    await page.getByTestId('kop-meer').click()
    await expect(page.getByTestId('meetings-agenda')).toBeVisible()
    await expect(page.getByTestId('meetings-analyse')).toHaveCount(0)
  })
})
