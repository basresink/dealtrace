import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

// Agenda in de opzet van DealDrive: kop met de dag, weergave in het filterpaneel en in de URL, navigatie met weeknummer,
// weekrooster met hele-dag-rij en nu-lijn, klik op een lege tijd plant een afspraak, maand.
test.describe('agenda', () => {
  test('kop, weergave in het filterpaneel en navigatie', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/agenda')
    await expect(page.locator('h1.title')).toHaveText(/^(Geen afspraken vandaag\.|1 afspraak vandaag\.|\d+ afspraken vandaag\.)$/)
    await expect(page.getByTestId('agenda-periode')).toHaveText(/^Week \d+ · \d+ t\/m \d+ \w+ \d{4}$/)
    await expect(page.locator('[data-test^="dagkop-"]')).toHaveCount(5)
    await expect(page.getByTestId('nu-lijn')).toHaveCount(1)
    // Briefings staat sinds de ronde Taken op /taken, niet meer in de agenda.
    await expect(page.getByTestId('briefings-knop')).toHaveCount(0)
    // De weergave staat in het filterpaneel.
    await expect(page.getByTestId('weergave-knop')).toHaveCount(0)
    await page.getByTestId('agenda-filters').click()
    await expect(page.getByTestId('weergave-werkweek')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('weergave-week').click()
    await expect(page).toHaveURL(/weergave=week/)
    await expect(page.locator('[data-test^="dagkop-"]')).toHaveCount(7)
    const periode = await page.getByTestId('agenda-periode').textContent()
    await page.getByTestId('agenda-volgende').click()
    await expect(page.getByTestId('agenda-periode')).not.toHaveText(periode!)
    await page.getByTestId('agenda-vandaag').click()
    await expect(page.getByTestId('agenda-periode')).toHaveText(periode!)
    await page.getByTestId('weergave-maand').click()
    await expect(page).toHaveURL(/weergave=maand/)
    await expect(page.getByTestId('agenda-maand')).toBeVisible()
  })

  test('kop: geen knop Taak, rechts van Afspraak de knoppen Weekstart en Weekreview op één regel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/agenda')
    const rij = page.getByTestId('kop-knoppen')
    await expect(page.getByTestId('agenda-taak')).toHaveCount(0)
    await expect(rij.getByRole('button', { name: /^Taak$/ })).toHaveCount(0)
    await expect(page.getByTestId('agenda-weekstart')).toHaveAttribute('href', '/weekstart')
    await expect(page.getByTestId('agenda-weekreview')).toHaveAttribute('href', '/weekreview')
    const afspraak = (await page.getByTestId('plan-afspraak-knop').boundingBox())!
    const ws = (await page.getByTestId('agenda-weekstart').boundingBox())!
    const wr = (await page.getByTestId('agenda-weekreview').boundingBox())!
    expect(ws.x).toBeGreaterThan(afspraak.x)
    expect(wr.x).toBeGreaterThan(ws.x)
    expect(Math.abs(wr.y - afspraak.y)).toBeLessThan(4)
    await page.getByTestId('agenda-weekstart').click()
    await expect(page).toHaveURL(/\/weekstart$/)
  })

  test('hele-dag-rij met afgerond belblok en klik op een afspraak', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/agenda')
    const raster = page.getByTestId('agenda-raster')
    // Eva heeft deze week afgeronde belblokken (seed): die staan gestreept in de hele-dag-rij.
    await expect(page.getByTestId('agenda-heledag')).toContainText('Belblok: afgerond')
    const afspraak = raster.locator('[data-test^="afspraak-"]').first()
    await afspraak.click()
    await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
    await expect(page).toHaveURL(/afspraak=/)
  })

  test('klik op een lege tijd plant een afspraak op dat moment', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/agenda?weergave=week')
    const kolom = page.locator('[data-test^="kolom-"]').nth(5) // zaterdag: leeg
    const iso = (await kolom.getAttribute('data-test'))!.slice(6)
    const doos = (await kolom.boundingBox())!
    const uur = doos.height / 24
    await kolom.scrollIntoViewIfNeeded()
    await page.getByTestId('agenda-raster').evaluate((el, y) => { el.scrollTop = y }, 13 * uur - 40)
    const b = (await kolom.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + 14.2 * uur)
    await expect(page.getByTestId('plan-afspraak')).toBeVisible()
    await expect(page.getByTestId('pa-datum')).toHaveValue(iso)
    await expect(page.getByTestId('pa-start')).toHaveValue('14:00')
  })

  test('oude links: weergave=meetings gaat naar /meetings, weergave=dag toont één dag', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/agenda?weergave=meetings')
    await expect(page).toHaveURL(/\/meetings/)
    await ga(page, '/agenda?weergave=dag')
    await expect(page.locator('[data-test^="dagkop-"]')).toHaveCount(1)
  })
})
