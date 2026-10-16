import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// Meetings in de opzet van DealDrive: kop, filterstrook in de URL, lijst per week en dag of de
// lege staat, en de Meetinglijst met uitleg, advies en een planknop die het afspraakvenster opent.
test.describe('meetings', () => {
  test('kop, lijst per dag en filters in de URL', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meetings')
    await expect(page.getByTestId('meetings-kicker')).toContainText('30 dagen')
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
    // De knop Meeting-analyse staat nu rechtsboven als Analyse (analyse.spec.ts).
    await expect(lijst.getByTestId('meeting-analyse')).toHaveCount(0)
    const rij = lijst.locator('[data-test^="beurt-"]').filter({ has: page.locator('button') }).first()
    await expect(rij.locator('.pil')).toHaveText(/vandaag|deze week|Fysiek/i)
    await rij.locator('button').click()
    const flyout = page.getByTestId('plan-afspraak')
    await expect(flyout).toBeVisible()
    const naam = (await rij.locator('.mt-plan-naam').textContent())!.split(' · ')[0]!
    await expect(flyout).toContainText(naam)
    await expect(page.getByTestId('pa-vorm-telefoon')).toHaveAttribute('aria-checked', 'true')
  })

  test('een meeting van vandaag die al voorbij is: Afgelopen en Verslag maken (B18)', async ({ page }) => {
    const start = new Date(Date.now() - 20 * 60_000)
    const dag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
    test.skip(dag(start) !== dag(new Date()), 'net na middernacht is er nog geen eerder vandaag')
    await apiLogin(page.request, 'u-07')
    const soorten: any = await (await page.request.get('/api/meetingsoorten')).json()
    const kennis = soorten.soorten.find((s: any) => s.slug === 'kennismaking')
    const r = await page.request.post('/api/afspraken', { data: { accountId: 'eva-a08', contactId: 'eva-a08-c1', meetingsoortId: kennis.id, vorm: 'online', start: start.toISOString(), duurMin: 15, titel: `Afgelopen ${Date.now().toString(36)}` } })
    expect(r.ok()).toBe(true)
    const { id } = await r.json()
    await login(page, 'u-07')
    await ga(page, '/meetings')
    const kaart = page.getByTestId(`meeting-${id}`)
    await expect(kaart).toHaveClass(/mt-kaart--voorbij/)
    await expect(kaart.getByTestId('mt-afgelopen')).toHaveText('Afgelopen')
    await kaart.getByTestId('mt-verslag').click()
    await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
    await page.request.post(`/api/afspraken/${id}/status`, { data: { status: 'geannuleerd' } })
  })

  test('lege staat met Eerste meeting', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/meetings?vorm=intern')
    // u-01 heeft geen intern overleg: dan wel de filter-lege staat of de lege staat.
    const leeg = page.locator('[data-test="meetings-leeg"], [data-test="meetings-leeg-filter"]')
    await expect(leeg).toBeVisible()
  })
})
