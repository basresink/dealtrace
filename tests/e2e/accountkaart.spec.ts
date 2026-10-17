// Accountkaart in de opzet van DealDrive: kop met Zoeken, Vraag AI, Contacten en Meer, statstrook, de tabbladen
// met het tabblad in de URL, de tijdlijnfilter, een document uploaden en verwijderen, en de kwalificatie onder Meer.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe('accountkaart', () => {
  test('kop, statstrook en alle tabbladen; tabblad in de URL; filter op de tijdlijn', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/accounts/pr-06')
    await expect(page.getByTestId('account-naam')).toContainText('Testtechniek Gevelpunt')
    await expect(page.getByTestId('statstrook')).toContainText('Open acties')
    for (const t of ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'campagnes', 'documenten']) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
    // Reis en kwalificatie staan onder Meer; Accountplan alleen met de functie (Expert).
    for (const t of ['deals', 'eigenvelden', 'kwalificatie', 'reis', 'accountplan']) await expect(page.getByTestId(`tab-${t}`)).toHaveCount(0)
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
    // Een oude link naar het tabblad Reis en kwalificatie opent het venster Kwalificatie.
    await ga(page, '/accounts/pr-06?tab=kwalificatie')
    await expect(page.getByTestId('kwalificatie-flyout').getByTestId('band')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('meer-flyout').getByTestId('briefing-knop').click()
    await expect(page.getByTestId('briefing-flyout')).toBeVisible()
  })

  test('kop op één regel op 1280 en 390: Zoeken, Vraag AI, Contacten en Meer; geen hulp, Waarom nu of leverancier onder de kop', async ({ page }) => {
    await login(page, 'u-07')
    await page.setViewportSize({ width: 1280, height: 900 })
    await ga(page, '/accounts/eva-a04')
    // Laptop: vier knoppen op één regel, in deze volgorde; de rest staat onder Meer.
    const kop = await page.locator('.ak-acties [data-test]:not([data-test=kop-iconen]):visible').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-test'), top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })))
    expect(kop.map((k) => k.id)).toEqual(['kop-zoeken', 'vraag-ai', 'contacten-knop', 'kop-meer'])
    expect(new Set(kop.map((k) => k.top)).size).toBe(1)
    expect(kop.every((k) => k.h >= 44)).toBe(true)
    await expect(page.getByTestId('hulp-knop')).toHaveCount(0)
    await expect(page.getByTestId('aanleiding')).toHaveCount(0)
    await expect(page.getByTestId('leverancier')).toHaveCount(0)
    await expect(page.locator('.ak-kop-info, .ak-sectie--wit').getByText('Waarom nu:')).toHaveCount(0)
    await page.getByTestId('contacten-knop').click()
    await expect(page.getByTestId('contacten-flyout')).toBeVisible()
    await page.getByTestId('contacten-flyout').locator('.fo-sluit').click()
    // In de tijdlijn alleen + Taak geel, + Mail met rand.
    await expect(page.getByTestId('tl-taak')).toHaveClass(/dd-actie--primair/)
    if (await page.getByTestId('tl-mail').count()) await expect(page.getByTestId('tl-mail')).toHaveClass(/dd-actie--secundair/)
    // Telefoon: Contacten en Meer op één regel met tikdoelen van 44 px; zoeken en AI staan in de mobiele kop.
    await page.setViewportSize({ width: 390, height: 844 })
    await ga(page, '/accounts/eva-a04')
    const rij = await page.locator('.ak-acties [data-test]:not([data-test=kop-iconen]):visible').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-test'), top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })))
    expect(rij.map((k) => k.id)).toEqual(['contacten-knop', 'kop-meer'])
    expect(new Set(rij.map((k) => k.top)).size).toBe(1)
    expect(rij.every((k) => k.h >= 44)).toBe(true)
    await page.getByTestId('kop-meer').click()
    for (const id of ['briefing-knop', 'info-knop']) await expect(page.getByTestId('meer-flyout').getByTestId(id)).toBeVisible()
    for (const h of await page.locator('[data-test=meer-flyout] .mf-kader').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44)
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

// Bij elk item in de tabbladen: de naam van het contact (link naar de contactkaart) en de gebruiker die het
// deed of de eigenaar is, in één metaregel: "Wietse Testsma · door Anouk Noorderveld · 14 okt".
test.describe('accountkaart: contact en gebruiker per item', () => {
  test('de API levert contact en gebruiker bij elk item', async ({ page }) => {
    await login(page, 'u-01')
    const api = await (await page.request.get('/api/accounts/pr-06/tabbladen')).json()
    for (const soort of ['taken', 'inzichten', 'afspraken', 'mails', 'verslagen', 'momenten']) {
      expect(api[soort].every((x: any) => 'contactId' in x && 'contactNaam' in x && 'gebruiker' in x), soort).toBe(true)
    }
    const metContact = [...api.taken, ...api.verslagen, ...api.momenten].filter((x: any) => x.contactId === 'ct-07')
    expect(metContact.length).toBeGreaterThan(0)
    expect(metContact.every((x: any) => x.contactNaam === 'Wietse Testsma')).toBe(true)
    expect(api.taken.every((x: any) => x.gebruiker === null || !/^Testgebruiker /.test(x.gebruiker))).toBe(true)
  })

  for (const breedte of [1280, 390]) {
    test(`${breedte} px: tijdlijn, taken en verslagen tonen contactlink en gebruiker in de metaregel`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: breedte === 390 ? 844 : 900 })
      await login(page, 'u-01')
      await ga(page, '/accounts/pr-06')
      const meta = page.getByTestId('tijdlijn').getByTestId('item-meta').filter({ hasText: 'Wietse Testsma' }).first()
      await expect(meta).toHaveText(/^Wietse Testsma\s*·\s*door \S+ \S+.*·\s*\d{1,2} \w+/)
      const link = meta.getByTestId('tl-contact')
      await expect(link).toHaveAttribute('href', '/contacten/ct-07')
      await expect(meta.getByTestId('tl-door')).toHaveText(/^door \S+ \S+/)
      await expect(meta.getByTestId('tl-door')).not.toContainText('Testgebruiker')
      if (breedte === 390) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

      for (const tab of ['taken', 'verslagen']) {
        await page.getByTestId(`tab-${tab}`).click()
        // Andere specs ronden taken van pr-06 af; elk item met een contact toont de link en de gebruiker.
        const m = page.getByTestId('item-meta').filter({ has: page.getByTestId('tl-contact') }).first()
        await expect(m.getByTestId('tl-contact')).toHaveAttribute('href', /^\/contacten\/[\w-]+$/)
        await expect(m.getByTestId('tl-door')).toHaveText(/^door \S+ \S+/)
      }
      await page.getByTestId('tab-tijdlijn').click()
      await page.getByTestId('tijdlijn').getByTestId('tl-contact').filter({ hasText: 'Wietse Testsma' }).first().click()
      await expect(page).toHaveURL(/\/contacten\/ct-07/)
    })
  }
})
