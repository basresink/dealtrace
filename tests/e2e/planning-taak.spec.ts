// Wensen opdrachtgever: + Taak op Belblokken, + Bel taak en de weergave Maand, Kwartaal of Jaar op
// Prospectplanning (filterpaneel, in de URL), op 1280 en 390 px.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

for (const breedte of [1280, 390]) {
  test(`${breedte} px: Belblokken heeft + Taak in de kop (type Bellen), geen Meer en geen Belscripts`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/belblokken')
    await expect(page.getByTestId('kop-meer')).toHaveCount(0)
    await expect(page.getByTestId('naar-belscripts')).toHaveCount(0)
    const knop = page.getByTestId('belblokken-taak')
    await expect(knop).toBeVisible()
    await expect(knop).toHaveText(/Taak/)
    expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
    await knop.click()
    const venster = page.getByTestId('nieuwe-taak')
    await expect(venster).toBeVisible()
    await expect(venster.getByTestId('nt-type-bellen')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(venster).toHaveCount(0)
  })

  test(`${breedte} px: + Bel taak opent Nieuwe taak met Bellen, de prospect en het contact`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/planning')
    const plan = await (await page.request.get('/api/planning/jaar')).json()
    const rij = page.locator('.plan-rij').first()
    await expect(rij).toBeVisible()
    await expect(rij.getByTestId('bel')).toHaveCount(0)
    await expect(rij.getByTestId('plan-bezoek')).toHaveCount(0)
    const naam = (await rij.getAttribute('data-account'))!
    const account = plan.accounts.find((a: any) => a.naam === naam)
    const knop = rij.getByTestId('bel-taak')
    expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await knop.click()
    const venster = page.getByTestId('nieuwe-taak')
    await expect(venster).toBeVisible()
    await expect(venster.getByTestId('nt-type-bellen')).toHaveAttribute('aria-pressed', 'true')
    await expect(venster.getByTestId('nt-klant-keuze')).toContainText(naam)
    if (account?.contact) await expect(venster.getByTestId('nt-contact-keuze')).toContainText(account.contact.naam)
    await expect(venster.getByTestId('nt-titel')).toHaveValue(/^Bel /)
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
  })

  test(`${breedte} px: weergave Maand, Kwartaal of Jaar in het filterpaneel, in de URL`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: 900 })
    await login(page, 'u-07')
    await ga(page, '/planning')
    const kalender = page.getByTestId('kalender')
    await expect(kalender.locator('.maandtegel')).toHaveCount(12)
    await expect(page.getByTestId('planning-filters')).toHaveCount(0)
    await page.getByTestId('planning-filters-knop').click()
    const paneel = page.getByTestId('planning-filters')
    await expect(paneel.locator('.filter-pil')).toHaveText(['Maand', 'Kwartaal', 'Jaar'])
    await expect(page.getByTestId('weergave-jaar')).toHaveAttribute('aria-pressed', 'true')

    // Maand: één maand met vorige en volgende; het maanddetail volgt.
    await page.getByTestId('weergave-maand').click()
    await expect(page).toHaveURL(/weergave=maand/)
    await expect(kalender.locator('.maandtegel')).toHaveCount(1)
    await expect(page.getByTestId('planning-filter-teller')).toHaveText('1')
    const eerste = Number(await kalender.locator('.maandtegel').getAttribute('data-maand'))
    const volgende = page.getByTestId('maand-volgende')
    const vorige = page.getByTestId('maand-vorige')
    for (const k of [volgende, vorige]) expect((await k.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    if (eerste < 12) {
      await volgende.click()
      await expect(kalender.locator('.maandtegel')).toHaveAttribute('data-maand', String(eerste + 1))
      await expect(page.getByTestId('maand-titel')).toContainText((await page.getByTestId('maand-naam').textContent())!.split(' ')[0]!, { ignoreCase: true })
      await vorige.click()
    } else {
      await vorige.click()
      await expect(kalender.locator('.maandtegel')).toHaveAttribute('data-maand', String(eerste - 1))
      await volgende.click()
    }
    await expect(kalender.locator('.maandtegel')).toHaveAttribute('data-maand', String(eerste))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)

    // Kwartaal en Jaar; een directe link opent het paneel met de keuze.
    await page.getByTestId('weergave-kwartaal').click()
    await expect(page).toHaveURL(/weergave=kwartaal/)
    await expect(kalender.locator('.maandtegel')).toHaveCount(3)
    await page.getByTestId('weergave-jaar').click()
    await expect(page).not.toHaveURL(/weergave=/)
    await expect(kalender.locator('.maandtegel')).toHaveCount(12)
    await ga(page, '/planning?weergave=maand')
    await expect(page.getByTestId('planning-filters')).toBeVisible()
    await expect(page.getByTestId('weergave-maand')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('maandnav')).toBeVisible()
  })
}
