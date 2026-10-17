// Pakket D: de hub met de stand per kaart, functies per niveau en wie mag wat, de audit met filter,
// paging en CSV, mailsjabloon aan en uit, de agendaschakelaar onder Instellingen en de rechten per rol.
// Op 1280 en 390 px zonder horizontale scroll.
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial' })

const geenScroll = async (page: Page) => {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(sw).toBeLessThanOrEqual(w)
}

test.describe('Instellingen beheer', () => {
  for (const breedte of [1280, 390]) {
    test(`hub toont per kaart de stand in woorden (${breedte} px)`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: 900 })
      await login(page, 'u-06')
      const overzicht = await (await page.request.get('/api/instellingen/overzicht')).json()
      await ga(page, '/instellingen')
      const regels = page.getByTestId('kaart-Regels')
      await expect(regels.getByTestId('kaart-stand')).toHaveText(overzicht.stand['/instellingen/regels'])
      await expect(regels.getByTestId('kaart-stand')).toHaveText(/regels, /)
      await expect(page.getByTestId('kaart-Mailsjablonen').getByTestId('kaart-stand')).toHaveText(/van \d+ sjablonen aan/)
      await expect(page.getByTestId('groepstand-Koppelingen')).toHaveText(/^\d+ van \d+ koppelingen actief$/)
      // Elke kaart met een stand toont precies wat de API zegt.
      const kaarten = page.locator('[data-test^="kaart-"]:has([data-test="kaart-stand"])')
      expect(await kaarten.count()).toBeGreaterThan(20)
      await geenScroll(page)
      await page.getByTestId('kaart-Agenda').click()
      await expect(page).toHaveURL(/\/instellingen\/koppelingen\/agenda$/, { timeout: 30000 })
      await expect(page.getByTestId('agenda-org-stand')).toBeVisible()
    })
  }

  test('functies per niveau en wie mag wat, alleen lezen', async ({ page }) => {
    for (const breedte of [1280, 390]) {
      await page.setViewportSize({ width: breedte, height: 900 })
      await login(page, 'u-06')
      await ga(page, '/instellingen/niveaus')
      const tel = page.getByTestId('niveau-tellingen')
      await expect(tel.locator('[data-niveau="beginner"]')).toContainText(/\d+ van \d+/)
      await page.getByTestId('niveau-zoek').fill('Inzichten')
      const rij = page.locator('[data-test="niveau-functie"][data-sleutel="nav.inzichten"]')
      await expect(rij).toBeVisible()
      await expect(rij.locator('[data-niveau="expert"]')).toHaveAttribute('data-aan', 'ja')
      await expect(rij.locator('button, input, select')).toHaveCount(0)
      await expect(page.getByTestId('wie-mag-wat').locator('[data-onderdeel="abonnement"] [data-rol="accountmanager"]')).toContainText('Geen toegang')
      await geenScroll(page)
    }
  })

  test('audit: filter op soort, meer laden, download als CSV en een lege staat', async ({ page }) => {
    await login(page, 'u-06')
    // Zorg voor een recente regel van de soort Instellingen.
    const sj = (await (await page.request.get('/api/mailsjablonen')).json()).sjablonen[0]
    expect((await page.request.put(`/api/mailsjablonen/${sj.id}/actief`, { data: { actief: sj.actief } })).status()).toBe(200)
    await ga(page, '/instellingen/audit')
    await page.getByTestId('audit-soort').selectOption('instellingen')
    await expect(page).toHaveURL(/soort=instellingen/)
    await expect(page.getByTestId('audit-regel').first()).toBeVisible()
    for (const actie of await page.getByTestId('audit-regel').evaluateAll((r) => r.map((x) => x.getAttribute('data-actie') ?? ''))) {
      expect(actie).toMatch(/^(instelling|mailsjabloon|koppeling|agent|agents|eigenVeld|reekssjabloon|verkoopverhaal|toegang)/)
    }
    const download = page.waitForEvent('download')
    await page.getByTestId('audit-download').click()
    const d = await download
    expect(d.suggestedFilename()).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.csv$/)
    const csv = await (await page.request.get('/api/instellingen/audit?soort=instellingen&formaat=csv')).text()
    expect(csv.split('\r\n')[0]).toContain('Wanneer;Wie;')
    expect(csv).toContain('Mailsjabloon')
    // Paging: zonder filter meer dan 50 regels, Meer laden voegt toe.
    await page.getByTestId('audit-wis').first().click()
    await expect(page).not.toHaveURL(/soort=/)
    await expect(page.getByTestId('audit-telling')).toHaveText('50 regels, er zijn er meer')
    await page.getByTestId('audit-meer').click()
    await expect.poll(() => page.getByTestId('audit-regel').count(), { timeout: 20000 }).toBeGreaterThan(50)
    // Lege staat.
    await ga(page, '/instellingen/audit?van=2001-01-01&tot=2001-01-02')
    await expect(page.getByTestId('audit-leeg')).toContainText('Niets gevonden')
    // De beheerder op /audit komt op hetzelfde scherm.
    await ga(page, '/audit')
    await expect(page).toHaveURL(/\/instellingen\/audit/)
  })

  test('audit op de telefoon zonder horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-06')
    await ga(page, '/instellingen/audit')
    await expect(page.getByTestId('audit-tabel')).toBeVisible()
    await geenScroll(page)
  })

  test('mailsjabloon aan en uit, met auditregel', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/instellingen/mailsjablonen')
    const rij = page.getByTestId('sj-rij').first()
    const knop = rij.getByTestId('sj-actief')
    const was = (await knop.getAttribute('aria-checked')) === 'true'
    await knop.click()
    await expect(knop).toHaveAttribute('aria-checked', String(!was))
    const naam = await rij.getAttribute('data-naam')
    const lijst = (await (await page.request.get('/api/mailsjablonen')).json()).sjablonen
    expect(lijst.find((s: any) => s.naam === naam).actief).toBe(!was)
    const audit = (await (await page.request.get('/api/instellingen/audit?soort=instellingen')).json()).regels
    expect(audit[0].actie).toBe(was ? 'mailsjabloon.uit' : 'mailsjabloon.aan')
    await knop.click()
    await expect(knop).toHaveAttribute('aria-checked', String(was))
  })

  test('rechten per rol', async ({ request }) => {
    await apiLogin(request, 'u-04')
    const sm = await (await request.get('/api/instellingen/overzicht')).json()
    expect(sm.stand['/instellingen/gebruikers']).toMatch(/in \d+ teams?|nog geen team/)
    expect(sm.stand['/instellingen/abonnement']).toBeUndefined()
    expect((await request.get('/api/instellingen/niveaus')).status()).toBe(403)
    expect((await request.get('/api/instellingen/audit')).status()).toBe(403)
    expect((await request.get('/api/instellingen/agenda')).status()).toBe(403)
    expect((await request.get('/api/audit?formaat=csv')).status()).toBe(200)
    const eigen = await (await request.get('/api/audit')).json()
    expect(eigen.personen.every((p: any) => p.naam !== 'Mira Beheer')).toBe(true)

    await apiLogin(request, 'u-01')
    for (const pad of ['/api/instellingen/overzicht', '/api/instellingen/niveaus', '/api/instellingen/audit', '/api/audit']) expect((await request.get(pad)).status()).toBe(403)
    expect((await request.put('/api/mailsjablonen/x/actief', { data: { actief: false } })).status()).toBe(403)
    expect((await request.put('/api/koppelingen/agenda', { data: { aan: false } })).status()).toBe(403)
  })
})
