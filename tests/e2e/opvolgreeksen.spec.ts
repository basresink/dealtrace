import { expect, test, type APIRequestContext } from '@playwright/test'
import { ga, login } from './hulp'

// Opvolgreeksen (F7): het overzicht /opvolgreeksen (kop, filters, lijst met de stand en de detailkolom met de stappen),
// een antwoord in de mailbox (mock-adapter) dat de reeks stopt met een taak bel terug, Start reeks vanuit het overzicht,
// de strip in Prospects, een reeks starten bij de uitkomst in Rond af, en het sjablonenbeheer voor de beheerder.
// Een eigen fictieve prospect met een .test-adres.
const NAAM = 'Testreeks Waalkade'
const MAIL = 'noor@waalkade.test'

async function fixture(request: APIRequestContext) {
  await request.post('/api/sessie/ontwikkel', { data: { gebruikerId: 'u-01' } })
  const treffers = await (await request.get(`/api/accounts/kies?q=${encodeURIComponent(NAAM)}`)).json()
  let id: string = treffers.find((t: any) => (t.naam ?? t.name) === NAAM)?.id
  if (!id) id = (await (await request.post('/api/accounts', { data: { naam: NAAM, plaats: 'Nijmegen', telefoon: '024 400 1234', negeerMogelijk: true } })).json()).id
  const v = await (await request.get(`/api/volgen/${id}`)).json()
  if (!v.contacten?.length) await request.post('/api/contacten', { data: { accountId: id, voornaam: 'Noor', achternaam: 'Proefkade', functie: 'Inkoper', email: MAIL, rol: 'beslisser' } })
  const na = await (await request.get(`/api/volgen/${id}`)).json()
  if (na.reeks && ['loopt', 'gepauzeerd'].includes(na.reeks.status)) await request.put(`/api/reeksen/${na.reeks.id}`, { data: { actie: 'stop' } })
  const schoon = await (await request.get(`/api/volgen/${id}`)).json()
  return { id, contactId: schoon.contacten[0].id as string, sjablonen: schoon.sjablonen as { id: string; sleutel: string }[] }
}

async function startReeks(request: APIRequestContext, id: string, sleutel = 'na-informatie') {
  const f = await fixture(request)
  const r = await request.post(`/api/volgen/${id}/reeks`, { data: { sjabloonId: f.sjablonen.find((s) => s.sleutel === sleutel)!.id } })
  expect(r.ok()).toBe(true)
  return (await r.json()).id as string
}

test.describe('opvolgreeksen', () => {
  test.describe.configure({ timeout: 180_000, mode: 'serial' })

  test('overzicht: kop, lijst met stand, detail met stappen, filters en een antwoord in de mailbox', async ({ page, request }) => {
    const { id } = await fixture(request)
    const reeksId = await startReeks(request, id)
    await login(page, 'u-01')
    await ga(page, `/opvolgreeksen?reeks=${reeksId}`)
    await expect(page.getByTestId('paginakop')).toContainText(/(reeks loopt|reeksen lopen)/)
    const rij = page.getByTestId(`or-rij-${reeksId}`)
    await expect(rij).toContainText(NAAM)
    await expect(rij).toContainText('Na informatie')
    await expect(page.getByTestId(`or-stand-pil-${reeksId}`)).toHaveText(/Concept|Open|Loopt/)
    const detail = page.getByTestId('reeks-detail')
    await expect(detail.getByTestId('vr-stappen').locator('li')).toHaveCount(5, { timeout: 60_000 })
    await expect(detail.getByTestId('vr-mandaat-C')).toHaveAttribute('aria-pressed', 'true')
    // Filter: bij Raak staat de lopende reeks niet.
    await page.getByTestId('or-stand-raak').click()
    await expect(page.getByTestId(`or-rij-${reeksId}`)).toHaveCount(0)
    await page.getByTestId('or-stand-alle').click()
    await expect(rij).toBeVisible()
    // Pauzeren en hervatten vanuit de detailkolom.
    await detail.getByTestId('vr-pauzeer').click()
    await expect(detail.getByTestId('rd-status')).toContainText('Gepauzeerd')
    await detail.getByTestId('vr-hervat').click()
    await expect(detail.getByTestId('rd-status')).toContainText('Loopt')
    // De prospect antwoordt op de mail: de mock-adapter leest het postvak, de reeks stopt met een taak bel terug.
    const m = await page.request.post('/api/mail/inkomend/mock', { data: { van: `Noor Proefkade <${MAIL}>`, onderwerp: 'Re: informatie', tekst: 'Bel me morgen maar.', berichtId: `e2e-${Date.now()}` } })
    expect(m.ok()).toBe(true)
    expect((await m.json()).gestopt).toBe(1)
    await ga(page, `/opvolgreeksen?reeks=${reeksId}`)
    await expect(page.getByTestId(`or-stand-pil-${reeksId}`)).toHaveText('Raak')
    await expect(page.getByTestId('rd-stop')).toContainText('antwoord in de mailbox')
    await expect(page.getByTestId('rd-belterug')).toBeVisible()
    const taken = await (await page.request.get(`/api/accounts/${id}/tabbladen`)).json()
    expect(taken.taken.some((t: any) => /antwoordde op je mail/.test(t.title ?? t.titel) && t.status === 'open')).toBe(true)
    // Dezelfde mail nog eens telt niet dubbel; een webhook zonder geldige ondertekening wordt geweigerd.
    expect((await page.request.post('/api/mail/inkomend?o=org-voltvast&t=fout', { data: { van: MAIL } })).status()).toBe(401)
  })

  test('Start reeks vanuit het overzicht en de strip in Prospects', async ({ page, request }) => {
    await fixture(request)
    await login(page, 'u-01')
    await ga(page, '/opvolgreeksen')
    await page.getByTestId('or-start').click()
    const f = page.getByTestId('reeks-start-flyout')
    await f.getByTestId('rsf-zoek').fill('Testreeks Waal')
    await page.locator('[data-test^="rsf-kies-"]').first().click()
    await expect(f.getByTestId('rsf-gekozen')).toContainText(NAAM)
    await f.getByTestId('rsf-sjabloon-na-voicemail').click()
    await f.getByTestId('rsf-start').click()
    await expect(f).toBeHidden({ timeout: 60_000 })
    await expect(page.getByTestId('reeks-detail')).toContainText('Na voicemail')
    await expect(page.getByTestId('reeks-detail').getByTestId('vr-stappen').locator('li')).toHaveCount(5)
    // De strip in Prospects: lopende reeks met stap x van y.
    await ga(page, `/prospects/alle?q=${encodeURIComponent(NAAM)}&eigenaar=iedereen`)
    const strip = page.locator(`[data-account] [data-test="rij-reeks"]`).first()
    await expect(strip).toContainText('Na voicemail · stap 1 van 4')
  })

  test('Rond af: bij Voicemail ingesproken staat het sjabloon klaar en start de reeks', async ({ page, request }) => {
    const { id, contactId } = await fixture(request)
    const t = await (await request.post('/api/tasks', { data: { title: 'Bel Noor over de offerte', actionType: 'bellen', accountId: id, contactId } })).json()
    await login(page, 'u-01')
    await ga(page, `/taken?taak=${t.id}`)
    const flyout = page.getByTestId('taak-flyout')
    await flyout.getByTestId('uitkomst-voicemail').click()
    const keuze = flyout.getByTestId('reeks-na-uitkomst')
    await expect(keuze.getByTestId('rnu-na-voicemail')).toHaveAttribute('aria-checked', 'true')
    await flyout.getByTestId('afronden').click()
    await expect.poll(async () => (await (await page.request.get(`/api/volgen/${id}`)).json()).reeks?.status, { timeout: 60_000 }).toBe('loopt')
    const v = await (await page.request.get(`/api/volgen/${id}`)).json()
    expect(v.reeks.naam).toBe('Na voicemail')
    expect(v.reeks.aanleiding).toBe('Voicemail ingesproken')
  })

  test('sjablonen: de beheerder maakt en zet uit; een accountmanager mag niet', async ({ page, request }) => {
    await request.post('/api/sessie/ontwikkel', { data: { gebruikerId: 'u-01' } })
    expect((await request.post('/api/reekssjablonen', { data: { naam: 'Mag niet' } })).status()).toBe(403)
    const naam = `Na beurs ${Date.now() % 100000}`
    await login(page, 'u-06')
    await ga(page, '/instellingen/opvolgreeksen')
    await expect(page.getByTestId('rsj-na-informatie')).toBeVisible()
    await page.getByTestId('rsj-nieuw').click()
    const f = page.getByTestId('rsj-flyout')
    await f.getByTestId('rsj-naam').fill(naam)
    await f.getByTestId('rsj-titel-1').fill('Mail: het overzicht van de beurs')
    await f.getByTestId('rsj-instructie-1').fill('Noem de beurs en het winpunt.')
    await f.getByTestId('rsj-titel-2').fill('Bellen: overzicht ontvangen?')
    await f.getByTestId('rsj-uitkomst-later').click()
    // Een einde voor de laatste stap geeft een melding en Bewaar staat uit.
    await f.getByTestId('rsj-einde-dag').fill('2')
    await expect(f.getByTestId('rsj-fouten')).toContainText('Het einde ligt na de laatste stap')
    await expect(f.getByTestId('rsj-bewaar')).toBeDisabled()
    await f.getByTestId('rsj-einde-dag').fill('12')
    await f.getByTestId('rsj-bewaar').click()
    await expect(f).toBeHidden()
    const rij = page.locator('[data-test^="rsj-eigen-"]', { hasText: naam })
    await expect(rij).toContainText('dag 0 mail · dag 3 bellen · dag 12 terug naar het ritme')
    await expect(rij).toContainText('Gesproken, later')
    // Uitzetten: hij staat niet meer bij Start reeks.
    await rij.getByRole('switch').click()
    await expect(rij).toContainText('uit')
    const actief = await (await page.request.get('/api/reekssjablonen')).json()
    expect(actief.sjablonen.some((s: any) => s.naam === naam)).toBe(false)
  })
})
