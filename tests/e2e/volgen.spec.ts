import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { ga, login } from './hulp'

// Volgen (F2 en F7): de knop Volgen op de prospect- en contactpagina opent een flyout met de volgende beste stap
// (weging, Bewaker, herkomst, alternatieven, Niet nu) en de opvolgreeks (starten vanuit een sjabloon, stap afvinken,
// mandaat, pauzeren en hervatten, reactie die de reeks stopt met een taak "bel terug"). Een eigen fictieve prospect.
const NAAM = 'Testvolgen Rietpunt'

async function fixture(request: APIRequestContext) {
  await request.post('/api/sessie/ontwikkel', { data: { gebruikerId: 'u-01' } })
  const treffers = await (await request.get(`/api/accounts/kies?q=${encodeURIComponent(NAAM)}`)).json()
  let id: string = treffers.find((t: any) => (t.naam ?? t.name) === NAAM)?.id
  if (!id) id = (await (await request.post('/api/accounts', { data: { naam: NAAM, plaats: 'Zwolle', telefoon: '038 400 1234', negeerMogelijk: true } })).json()).id
  const v = await (await request.get(`/api/volgen/${id}`)).json()
  if (!v.contacten?.length) await request.post('/api/contacten', { data: { accountId: id, voornaam: 'Mira', achternaam: 'Proefhuis', functie: 'Bedrijfsleider', email: 'mira@rietpunt.test', rol: 'beslisser' } })
  // Een lopende reeks van een vorige run stoppen, zodat elke test schoon begint.
  const na = await (await request.get(`/api/volgen/${id}`)).json()
  if (na.reeks && ['loopt', 'gepauzeerd'].includes(na.reeks.status)) await request.put(`/api/reeksen/${na.reeks.id}`, { data: { actie: 'stop' } })
  return { id, contactId: (await (await request.get(`/api/volgen/${id}`)).json()).contacten[0].id as string }
}

async function openVolgen(page: Page, pad: string) {
  await ga(page, pad)
  await page.getByTestId('kop-meer').click()
  await page.getByTestId('knop-volgen').click()
  const f = page.getByTestId('volgen-flyout')
  await expect(f.getByTestId('vs-titel')).toBeVisible({ timeout: 60_000 })
  return f
}

test.describe('volgen', () => {
  test.describe.configure({ timeout: 180_000 })

  test('volgende beste stap: weging, Bewaker, herkomst, alternatieven en Niet nu', async ({ page, request }) => {
    const { id } = await fixture(request)
    await login(page, 'u-01')
    // Het kader Volgen staat onder Meer, vóór Invloed.
    await ga(page, `/accounts/${id}`)
    await page.getByTestId('kop-meer').click()
    const knoppen = await page.locator('[data-test=meer-flyout] .mf-kader').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    const iv = knoppen.indexOf('knop-invloed')
    if (iv >= 0) expect(knoppen.indexOf('knop-volgen')).toBeLessThan(iv)
    const f = await openVolgen(page, `/accounts/${id}`)
    await expect(f).toContainText(`Volgen · ${NAAM}`)
    await expect(f.getByTestId('vs-factoren').locator('li').first()).toBeVisible()
    await expect(f.getByTestId('vs-score')).toContainText('punten')
    await expect(f.getByTestId('vs-bewaker')).toContainText('Bewaker')
    await expect(f.getByTestId('vs-herkomst')).toContainText('Bewaker')
    // Twee alternatieven, tenzij eerdere runs er met Niet nu een paar tijdelijk weghaalden.
    await expect(f.getByTestId('vs-alt-0')).toBeVisible()
    expect(await f.getByTestId('vs-alternatieven').locator('[data-test^="vs-alt-"]').count()).toBeLessThanOrEqual(2)
    await f.getByTestId('vs-niet-nu').click()
    await f.getByTestId('vs-reden-later').click()
    await expect(page.getByText(/Deze stap komt terug op/)).toBeVisible()
    await expect(f.getByTestId('vs-titel')).toBeVisible()
    await f.getByTestId('volgen-sluit').click()
    await expect(f).toBeHidden()
  })

  test('opvolgreeks: starten, mail afvinken, mandaat, pauze en een reactie die stopt met bel terug', async ({ page, request }) => {
    const { id } = await fixture(request)
    await login(page, 'u-01')
    const f = await openVolgen(page, `/accounts/${id}`)
    await f.getByTestId('vr-sjabloon-na-informatie').click()
    await f.getByTestId('vr-start').click()
    await expect(f.getByTestId('vr-status')).toContainText('Loopt', { timeout: 60_000 })
    await expect(f.getByTestId('vr-meta')).toContainText('Na informatie')
    const stappen = f.getByTestId('vr-stappen').locator('li')
    await expect(stappen).toHaveCount(5)
    await expect(f.getByTestId('vr-stap-5')).toContainText('terug naar het ritme')
    // Dag 0: een mailconcept van de Schrijver dat jij goedkeurt; hier zelf verstuurd.
    await f.getByTestId('vr-bekijk-1').click()
    await expect(f.getByTestId('vr-concept-1')).toContainText('Schrijver')
    await expect(f.getByTestId('vr-tekst')).not.toHaveValue('')
    await f.getByTestId('vr-zelf').click()
    await expect(f.getByTestId('vr-stap-1')).toContainText('Klaar')
    // Mandaat B (binnen kader) en terug, pauzeren en hervatten.
    await f.getByTestId('vr-mandaat-B').click()
    await expect(f.getByTestId('vr-mandaat-B')).toHaveAttribute('aria-pressed', 'true')
    await f.getByTestId('vr-mandaat-C').click()
    await expect(f.getByTestId('vr-mandaat-C')).toHaveAttribute('aria-pressed', 'true')
    await f.getByTestId('vr-pauzeer').click()
    await expect(f.getByTestId('vr-status')).toContainText('Gepauzeerd')
    await f.getByTestId('vr-hervat').click()
    await expect(f.getByTestId('vr-status')).toContainText('Loopt')
    // Een tweede reeks op hetzelfde account mag niet.
    const v = await (await page.request.get(`/api/volgen/${id}`)).json()
    expect((await page.request.post(`/api/volgen/${id}/reeks`, { data: { sjabloonId: v.sjablonen[0].id } })).status()).toBe(409)
    // De prospect reageert: de reeks stopt en er komt een taak bel terug.
    await f.getByTestId('vr-reactie').click()
    await f.getByTestId('vr-reactie-notitie').fill('Belde terug: wil volgende week praten.')
    await f.getByTestId('vr-reactie-stop').click()
    await expect(f.getByTestId('vr-status')).toContainText('Gestopt: de prospect reageerde')
    await expect(f.getByTestId('vr-belterug')).toBeVisible()
    const taken = await (await page.request.get(`/api/accounts/${id}/tabbladen`)).json()
    expect(taken.taken.some((t: any) => /^Bel terug: Mira Proefhuis/.test(t.title ?? t.titel) && t.status === 'open')).toBe(true)
  })

  test('contactkaart: de stap gaat over dat contact; Doe het nu opent de taak', async ({ page, request }) => {
    const { contactId } = await fixture(request)
    await login(page, 'u-01')
    const f = await openVolgen(page, `/contacten/${contactId}`)
    await expect(f).toContainText(`Volgen · Mira Proefhuis bij ${NAAM}`)
    const v = await (await page.request.get(`/api/volgen/${(await (await page.request.get(`/api/contacten/${contactId}`)).json()).accountId}?contact=${contactId}`)).json()
    expect([v.stap, ...v.alternatieven].filter((k: any) => k.contactId).every((k: any) => k.contactId === contactId)).toBe(true)
    if (v.stap.soort !== 'wachten') {
      await f.getByTestId('vs-nu').click()
      await expect(page.getByTestId('taak-flyout')).toBeVisible({ timeout: 30_000 })
    }
  })
})
