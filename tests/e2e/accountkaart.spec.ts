// Accountkaart in de opzet van DealDrive: kop met Info, Contacten en Briefing, statstrook, de tabbladen
// met het tabblad in de URL, de tijdlijnfilter, een document uploaden en verwijderen, en de kwalificatie.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('accountkaart', () => {
  test('kop, statstrook en alle tabbladen; tabblad in de URL; filter op de tijdlijn', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/accounts/pr-06')
    await expect(page.getByTestId('account-naam')).toContainText('Testtechniek Gevelpunt')
    await expect(page.getByTestId('statstrook')).toContainText('Open acties')
    for (const t of ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'campagnes', 'documenten', 'kwalificatie']) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
    for (const t of ['deals', 'eigenvelden']) await expect(page.getByTestId(`tab-${t}`)).toHaveCount(0)
    // Geen knop Bel in de kop en geen fase met dagen in de stuurstrip.
    await expect(page.locator('.ak-acties').getByText('Bel', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('stuurstrip')).not.toContainText('Fase')
    await page.getByTestId('tl-filters').click()
    await page.locator('.filter-pil', { hasText: 'Contactmomenten' }).click()
    await expect(page.locator('.tl-soort').first()).toHaveText('Contact')
    await page.getByTestId('tab-verslagen').click()
    await expect(page).toHaveURL(/tab=verslagen/)
    await page.locator('[data-test^=ak-verslag-]').first().click()
    await expect(page.getByTestId('verslag-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
    await ga(page, '/accounts/pr-06?tab=kwalificatie')
    await expect(page.getByTestId('band')).toBeVisible()
    await page.getByTestId('briefing-knop').click()
    await expect(page.getByTestId('briefing-flyout')).toBeVisible()
  })

  test('kop op één regel op 1280 en compact op de telefoon; één gele knop in de tijdlijn; aanleiding met spaties', async ({ page }) => {
    await login(page, 'u-07')
    await page.setViewportSize({ width: 1280, height: 900 })
    await ga(page, '/accounts/eva-a04')
    // Laptop: alle knoppen in de kop op één regel; Info, Contacten en Invloed staan onder Meer.
    const tops = await page.locator('.ak-acties > button, .ak-acties > a, .ak-acties > div').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    await expect(page.getByTestId('knop-volgen')).toBeVisible()
    await page.getByTestId('kop-meer').click()
    for (const id of ['info-knop', 'contacten-knop', 'knop-invloed']) await expect(page.getByTestId('kop-meer-menu').getByTestId(id)).toBeVisible()
    await expect(page.getByTestId('kop-meer-menu').getByTestId('scan-visitekaartje')).toHaveCount(0)
    await page.keyboard.press('Escape')
    // Aanleiding met spaties; in de tijdlijn alleen + Taak geel, + Mail met rand.
    await expect(page.getByTestId('aanleiding')).toHaveText(/^Waarom nu: Won een .+ · web · /)
    await expect(page.getByTestId('tl-taak')).toHaveClass(/dd-actie--primair/)
    if (await page.getByTestId('tl-mail').count()) await expect(page.getByTestId('tl-mail')).toHaveClass(/dd-actie--secundair/)
    // Telefoon: hulp, Briefing, Volgen en Meer op één regel; de rest onder Meer.
    await page.setViewportSize({ width: 390, height: 844 })
    await ga(page, '/accounts/eva-a04')
    await expect(page.getByTestId('knop-volgen')).toBeVisible()
    const rij = await page.locator('.ak-acties > button, .ak-acties > div, .ak-acties .kop-iconen > button').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(rij).size).toBe(1)
    await page.getByTestId('kop-meer').click()
    await expect(page.getByTestId('kop-meer-menu').getByTestId('info-knop')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('document uploaden staat in Documenten en is te verwijderen; een vreemd bestandstype niet', async ({ page }) => {
    await login(page, 'u-01')
    const fout = await page.request.post('/api/accounts/pr-06/documenten', { data: { naam: 'virus.exe', mime: 'application/x-msdownload', data: Buffer.from('x').toString('base64') } })
    expect(fout.status()).toBe(415)
    const naam = `offerte-test-${Date.now().toString(36)}.pdf`
    await ga(page, '/accounts/pr-06?tab=documenten')
    await page.getByTestId('document-uploaden').click()
    await page.getByTestId('document-bestand').setInputFiles({ name: naam, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
    await expect(page.getByTestId('document-naam')).toHaveValue(naam)
    await page.getByTestId('document-bewaar').click()
    const rij = page.locator('.ak-doc', { hasText: naam })
    await expect(rij).toBeVisible()
    await rij.getByTestId('document-verwijder').click()
    await page.getByTestId('bevestig').click()
    await expect(rij).toHaveCount(0)
  })
})
