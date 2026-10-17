// Pakket E: Instellingen, Privacy (bewaartermijnen, wat zou vervallen, export als zip), factuurgegevens en
// facturen met pdf op Abonnement, en het organisatielogo (controle op bestandstype, zichtbaar in de zijbalk).
// Rechten: een accountmanager krijgt 403 op de API's. Op 1280 en 390 px zonder horizontale scroll.
// Alle data is fictief.
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga } from './hulp'

test.describe.configure({ mode: 'serial' })

async function als(page: Page, id: string, pad: string) {
  await apiLogin(page.request, id)
  await ga(page, pad)
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><rect width="120" height="32" fill="#1b1b1b"/><circle cx="16" cy="16" r="10" fill="#ffd400"/></svg>'

test.describe('Privacy, export, facturen en logo op 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('accountmanager: 403 op privacy, export, factuurgegevens en logo', async ({ request }) => {
    await apiLogin(request, 'u-01')
    expect((await request.get('/api/instellingen/privacy')).status()).toBe(403)
    expect((await request.put('/api/instellingen/privacy', { data: { termijnen: { activiteiten: 12 } } })).status()).toBe(403)
    expect((await request.get('/api/instellingen/export')).status()).toBe(403)
    expect((await request.put('/api/instellingen/abonnement/factuurgegevens', { data: { gegevens: {} } })).status()).toBe(403)
    expect((await request.post('/api/instellingen/logo', { data: { data: Buffer.from(SVG).toString('base64') } })).status()).toBe(403)
    // De algemene instellingen-API laat deze sleutels niet toe, ook niet voor de beheerder.
    await apiLogin(request, 'u-06')
    expect((await request.put('/api/settings/bewaartermijnen', { data: { value: {} } })).status()).toBe(403)
  })

  test('beheerder: bewaartermijn kiezen, overzicht van wat vervalt en de export als zip', async ({ page }) => {
    await als(page, 'u-06', '/instellingen/privacy')
    await expect(page.getByRole('heading', { name: 'Privacy en bewaartermijnen' })).toBeVisible()
    await expect(page.getByTestId('privacy-geen-job')).toContainText('er wordt nu niets verwijderd')
    await expect(page.getByTestId('privacy-vast')).toContainText('7 jaar')

    await page.getByTestId('kies-verslagen').selectOption('12')
    await expect(page.getByTestId('privacy-status')).toHaveText('Opgeslagen')
    await expect(page.getByTestId('verval-verslagen')).toContainText('ouder dan 1 jaar')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('kies-verslagen')).toHaveValue('12')
    await page.getByTestId('kies-verslagen').selectOption('24')
    await expect(page.getByTestId('privacy-status')).toHaveText('Opgeslagen')

    const download = page.waitForEvent('download')
    await page.getByTestId('exporteer-organisatie').click()
    const d = await download
    expect(d.suggestedFilename()).toMatch(/^dealtrace-export-testbedrijf-voltvast-\d{4}-\d{2}-\d{2}\.zip$/)
    const pad = await d.path()
    const inhoud = (await import('node:fs')).readFileSync(pad!)
    expect(inhoud.subarray(0, 2).toString()).toBe('PK')
    const tekst = inhoud.toString('latin1')
    for (const b of ['accounts.csv', 'contactpersonen.csv', 'taken.csv', 'afspraken.csv', 'activiteiten.csv', 'verslagen.csv', 'campagnes.csv', 'accountplannen.csv', 'instellingen.json']) expect(tekst).toContain(b)
    await expect(page.getByTestId('export-laatste')).toContainText('Laatste export op')
  })

  test('beheerder: factuurgegevens met controle per veld, bewaren en terugzien; factuur als pdf', async ({ page }) => {
    // Zorg voor een (fictieve) factuur: als founder een prijs en een maandfactuur via de Stripe-mock.
    await apiLogin(page.request, 'u-06')
    let a = await (await page.request.get('/api/instellingen/abonnement')).json()
    if (!a.facturen.length) {
      await apiLogin(page.request, 'u-founder')
      const ab = await (await page.request.get('/api/platform/abonnementen')).json()
      if (!JSON.stringify(ab).includes('"prijsCent"')) {
        expect((await page.request.put('/api/platform/abonnementen/prijs', { data: { pakket: 'compleet', prijsCent: 9900, seatCent: 4900, geldigVanaf: new Date().toISOString().slice(0, 10) } })).status()).toBe(200)
      }
      expect((await page.request.post('/api/platform/facturen/maak', { data: { organisatieId: 'org-voltvast' } })).status()).toBe(200)
    }

    await als(page, 'u-06', '/instellingen/abonnement')
    const kaart = page.getByTestId('factuurgegevens')
    await kaart.getByTestId('factuur-bedrijfsnaam').fill('Testbedrijf Voltvast')
    await kaart.getByTestId('factuur-adres').fill('Teststraat 12')
    await kaart.getByTestId('factuur-postcode').fill('12')
    await kaart.getByTestId('factuur-plaats').fill('Teststad')
    await kaart.getByTestId('factuur-btw').fill('NL123')
    await kaart.getByTestId('factuur-email').fill('facturen@voltvast.test')
    await kaart.getByTestId('factuur-bewaar').click()
    await expect(kaart.getByTestId('factuur-fout-postcode')).toContainText('4 cijfers en 2 letters')
    await expect(kaart.getByTestId('factuur-fout-btw')).toContainText('NL123456789B01')
    await kaart.getByTestId('factuur-postcode').fill('1234ab')
    await kaart.getByTestId('factuur-btw').fill('NL123456789B01')
    await kaart.getByTestId('factuur-kvk').fill('12345678')
    await kaart.getByTestId('factuur-bewaar').click()
    await expect(page.locator('.toast-tekst').last()).toContainText('Factuurgegevens bewaard')
    await expect(kaart.getByTestId('factuur-postcode')).toHaveValue('1234 AB')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('factuurgegevens').getByTestId('factuur-btw')).toHaveValue('NL123456789B01')

    // Facturen: geen betaalknop, wel een pdf.
    const facturen = page.getByTestId('facturen')
    await expect(facturen.getByRole('link', { name: /Betaal/ })).toHaveCount(0)
    const link = facturen.getByTestId('factuur-pdf').first()
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    const pdf = await page.request.get(href!)
    expect(pdf.status()).toBe(200)
    expect(pdf.headers()['content-type']).toContain('application/pdf')
    const body = await pdf.body()
    expect(body.subarray(0, 5).toString()).toBe('%PDF-')
    expect(body.toString('latin1')).toContain('Teststraat 12')
    // Een accountmanager krijgt de pdf niet.
    await apiLogin(page.request, 'u-01')
    expect((await page.request.get(href!)).status()).toBe(403)
  })

  test('beheerder: logo weigert een ander bestandstype, toont een svg in de zijbalk en verwijdert hem', async ({ page }) => {
    await als(page, 'u-06', '/instellingen/organisatie')
    const kaart = page.getByTestId('org-logo')
    if (await kaart.getByTestId('org-logo-weg').isVisible()) {
      await kaart.getByTestId('org-logo-weg').click()
      await expect(kaart.getByTestId('org-logo-beeld')).toHaveCount(0)
    }
    await kaart.getByTestId('org-logo-invoer').setInputFiles({ name: 'logo.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a\x01\x00\x01\x00') })
    await expect(kaart.getByTestId('org-logo-fout')).toContainText('geen png, jpg of svg')
    // De server controleert zelf ook, los van het scherm.
    expect((await page.request.post('/api/instellingen/logo', { data: { data: Buffer.from('GIF89a\x01\x00').toString('base64') } })).status()).toBe(415)
    expect((await page.request.post('/api/instellingen/logo', { data: { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>').toString('base64') } })).status()).toBe(415)

    await kaart.getByTestId('org-logo-invoer').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) })
    await expect(kaart.getByTestId('org-logo-beeld')).toBeVisible()
    await expect(page.getByTestId('sb-org-logo').locator('img')).toHaveAttribute('alt', 'Logo van Testbedrijf Voltvast')
    const src = await page.getByTestId('sb-org-logo').locator('img').getAttribute('src')
    const r = await page.request.get(src!)
    expect(r.headers()['content-type']).toBe('image/svg+xml')
    expect(r.headers()['content-security-policy']).toContain("default-src 'none'")

    await kaart.getByTestId('org-logo-weg').click()
    await expect(kaart.getByTestId('org-logo-beeld')).toHaveCount(0)
    await expect(page.getByTestId('sb-org-logo')).toHaveCount(0)
  })

  test('hub: kaart Privacy en export voor de beheerder', async ({ page }) => {
    await als(page, 'u-06', '/instellingen')
    await page.getByRole('link', { name: /Privacy en export/ }).click()
    await expect(page).toHaveURL(/\/instellingen\/privacy$/)
  })
})

test.describe('Privacy, abonnement en organisatie op 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const pad of ['/instellingen/privacy', '/instellingen/abonnement', '/instellingen/organisatie']) {
    test(`${pad}: geen horizontale scroll, tikdoelen van minstens 44 px`, async ({ page }) => {
      await als(page, 'u-06', pad)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      const knoppen = page.locator('main [data-test="exporteer-organisatie"], main [data-test="factuur-bewaar"], main [data-test="org-logo-kies"], main select[data-test^="kies-"], main [data-test^="factuur-"]:is(input, select)')
      const n = await knoppen.count()
      for (let i = 0; i < n; i++) {
        const b = await knoppen.nth(i).boundingBox()
        if (b) expect(b.height, `tikdoel ${i}`).toBeGreaterThanOrEqual(44)
      }
    })
  }
})
