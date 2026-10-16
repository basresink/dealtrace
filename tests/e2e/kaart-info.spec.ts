// Info-vensters van account- en contactkaart in de opzet van DealDrive (inline bewerken, Extra bronnen),
// logo en website uit het e-maildomein, de foto van een contact en het venster Contacten.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// Een geldige png van 64 bij 64 px, effen geel (gemaakt met een canvas in de browser van de test).
async function maakPng(page: import('@playwright/test').Page) {
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d')!; x.fillStyle = '#f5c400'; x.fillRect(0, 0, 64, 64); return c.toDataURL('image/png').split(',')[1]! })
  return Buffer.from(b64, 'base64')
}

test.describe('kaart info', () => {
  test('Info-venster van het account: blokken, inline bewerken en extra bronnen', async ({ page }) => {
    await login(page, 'u-01')
    await page.request.put('/api/accounts/pr-06/extra-bronnen', { data: { bronnen: [] } })
    await ga(page, '/accounts/pr-06')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('info-knop').click()
    const fly = page.getByTestId('info-flyout')
    await expect(fly).toContainText('Bedrijfsgegevens')
    for (const blok of ['if-adres', 'if-bereik', 'if-stam', 'if-extra-bronnen']) await expect(fly.getByTestId(blok)).toBeVisible()
    await expect(fly.getByTestId('if-account-id')).toHaveText('pr-06')

    // Land inline bewerken met het potlood en terugzetten.
    const plaats = fly.getByTestId('if-plaats')
    const oud = (await plaats.getByTestId('if-plaats-waarde').textContent())!.trim()
    await plaats.getByTestId('if-plaats-bewerk').click()
    await plaats.getByTestId('if-plaats-invoer').fill('Testdorp')
    await plaats.getByTestId('if-plaats-bewaar').click()
    await expect(plaats.getByTestId('if-plaats-waarde')).toHaveText('Testdorp')
    await expect.poll(async () => (await (await page.request.get('/api/accounts/pr-06')).json()).plaats).toBe('Testdorp')
    await page.request.put('/api/accounts/pr-06', { data: { plaats: oud } })

    // Een extra bron toevoegen: hij staat als URL-bron in de volgbronnen; daarna weer weg.
    await fly.getByTestId('extra-bron-nieuw').click()
    await fly.getByTestId('extra-bron-label').fill('Nieuwspagina')
    await fly.getByTestId('extra-bron-url').fill('nieuws.gevelpunt.test/berichten')
    await fly.getByTestId('extra-bron-bewaar').click()
    await expect(fly.getByTestId('extra-bron')).toContainText('Nieuwspagina')
    const a = await (await page.request.get('/api/accounts/pr-06')).json()
    expect(a.extraBronnen).toContainEqual({ label: 'Nieuwspagina', url: 'https://nieuws.gevelpunt.test/berichten' })
    await fly.getByTestId('extra-bron').filter({ hasText: 'Nieuwspagina' }).getByTestId('extra-bron-weg').click()
    await expect(fly.getByTestId('extra-bron')).toHaveCount(0)
  })

  test('nieuwe prospect: website uit het e-maildomein van een contact en een logo-URL', async ({ request }) => {
    await apiLogin(request, 'u-01')
    // Willekeurige letters, zodat de dubbelcheck op naam geen eerdere testprospect vindt.
    const naam = `Testlogo ${Array.from({ length: 10 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('')}`
    const r = await request.post('/api/accounts', { data: { naam, plaats: 'Testdorp' } })
    expect(r.status()).toBe(200)
    const { id } = await r.json()
    // Een gratis maildienst zegt niets over het bedrijf.
    expect((await request.post('/api/contacten', { data: { accountId: id, achternaam: `Testprive${naam.slice(-5)}`, email: `iemand${naam.slice(-5).trim()}@gmail.com` } })).status()).toBe(200)
    expect((await (await request.get(`/api/accounts/${id}`)).json()).website).toBeNull()
    expect((await request.post('/api/contacten', { data: { accountId: id, achternaam: `Testzakelijk${naam.slice(-5)}`, email: `inkoop${naam.slice(-5).trim()}@bouwstaal-logo.test` } })).status()).toBe(200)
    const a = await (await request.get(`/api/accounts/${id}`)).json()
    expect(a.website).toBe('https://bouwstaal-logo.test')
    expect(a.domein).toBe('bouwstaal-logo.test')
    expect((await request.put(`/api/accounts/${id}`, { data: { logoUrl: 'geen-url' } })).status()).toBe(400)
    expect((await request.put(`/api/accounts/${id}`, { data: { logoUrl: 'https://bouwstaal-logo.test/logo.png' } })).status()).toBe(200)
    expect((await (await request.get(`/api/accounts/${id}`)).json()).logoUrl).toBe('https://bouwstaal-logo.test/logo.png')
    const lijst = await (await request.get(`/api/accounts?eigenaar=iedereen&q=${encodeURIComponent(naam)}`)).json()
    expect(lijst.rijen.find((x: any) => x.id === id)?.logoUrl).toBe('https://bouwstaal-logo.test/logo.png')
    await apiLogin(request, 'u-06')
    await request.delete(`/api/accounts/${id}`)
  })

  test('foto van een contact uploaden, tonen en verwijderen; contactenvenster in de opzet van DealDrive', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/contacten/ct-07')
    await page.getByTestId('contact-foto-potlood').click()
    await page.getByTestId('contact-foto-paneel').getByTestId('contact-foto-bestand').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: await maakPng(page) })
    await expect(page.getByTestId('contact-avatar').getByTestId('contact-foto')).toBeVisible()
    const c = await (await page.request.get('/api/contacten/ct-07')).json()
    expect(c.fotoUrl).toMatch(/^\/api\/bijlagen\//)
    expect((await page.request.get(c.fotoUrl)).headers()['content-type']).toMatch(/image\//)

    // In het venster Contacten van het account: kicker, uitleg, foto en de link naar de contactkaart.
    await ga(page, '/accounts/pr-06')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('contacten-knop').click()
    const fly = page.getByTestId('contacten-flyout')
    await expect(fly.getByTestId('cf-kicker')).toHaveText(/Contactpersonen · \d+/)
    await expect(fly).toContainText('Klik een naam voor de contactpersoonkaart.')
    const rij = fly.locator('[data-contact="ct-07"]')
    await expect(rij.getByTestId('contact-foto')).toBeVisible()
    await expect(fly.getByTestId('cf-alle')).toHaveAttribute('href', '/contacten/alle')
    await rij.getByTestId('cf-contact').click()
    await expect(page).toHaveURL(/\/contacten\/ct-07/)

    // Verwijderen: de initialen staan er weer.
    await page.getByTestId('contact-foto-potlood').click()
    page.once('dialog', (d) => d.accept())
    await page.getByTestId('contact-foto-paneel').getByTestId('contact-foto-weg').click()
    await expect(page.getByTestId('contact-avatar').getByTestId('contact-foto')).toHaveCount(0)
    expect((await (await page.request.get('/api/contacten/ct-07')).json()).fotoUrl).toBeNull()
  })

  test('Info-venster van het contact: blokken en extra bronnen', async ({ page }) => {
    await login(page, 'u-01')
    await page.request.put('/api/contacten/ct-07', { data: { extraBronnen: [] } })
    await ga(page, '/contacten/ct-07')
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('contact-info-knop').click()
    const fly = page.getByTestId('contact-info-flyout')
    await expect(fly).toContainText('Contactgegevens')
    for (const blok of ['ci-persoon', 'ci-bereik', 'ci-extra-bronnen']) await expect(fly.getByTestId(blok)).toBeVisible()
    await fly.getByTestId('extra-bron-nieuw').click()
    await fly.getByTestId('extra-bron-label').fill('Interview')
    await fly.getByTestId('extra-bron-url').fill('https://vakblad.test/interview')
    await fly.getByTestId('extra-bron-bewaar').click()
    await expect(fly.getByTestId('extra-bron')).toContainText('Interview')
    expect((await (await page.request.get('/api/contacten/ct-07')).json()).extraBronnen).toEqual([{ label: 'Interview', url: 'https://vakblad.test/interview' }])
    await fly.getByTestId('extra-bron-weg').click()
    await expect(fly.getByTestId('extra-bron')).toHaveCount(0)
  })
})
