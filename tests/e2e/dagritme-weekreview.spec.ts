// Dagritme: weekreview (F10), weekstart, dagstart (F3) en de mails ervan. Blijvers ontstaan door een taak
// drie keer naar een latere dag te zetten (de teller verschoven telt via de database). Voornemens worden
// meteen iets in de week erna; "Kies opnieuw" maakt de test herhaalbaar. Fictieve data.
import { expect, test } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ timeout: 120_000 })

const dagNa = (n: number) => { const d = new Date(Date.now() + n * 864e5); d.setUTCHours(9, 0, 0, 0); return d.toISOString() }
function volgendeWerkdag(): string {
  const d = new Date(Date.now() + 864e5)
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

test.describe('Weekreview', () => {
  test('een taak die drie keer schoof is een blijver; Laat los sluit hem met de reden', async ({ page }) => {
    await login(page, 'u-01')
    const titel = `Blijver e2e ${Date.now()}`
    const t = await (await page.request.post('/api/tasks', { data: { title: titel, actionType: 'taak', dueDate: dagNa(0) } })).json()
    for (const n of [1, 2, 3]) expect((await page.request.put(`/api/tasks/${t.id}`, { data: { dueDate: dagNa(n) } })).ok()).toBe(true)
    const api = await (await page.request.get('/api/weekreview')).json()
    expect(api.liggen.blijvers.find((b: any) => b.id === t.id)).toMatchObject({ titel, verschoven: 3, tekst: '3 keer verschoven' })
    expect(api.bewoog.cijfers.map((c: any) => c.sleutel)).toEqual(['gesprekken', 'afspraken', 'overdrachten', 'bereik', 'pogingen'])

    await ga(page, '/weekreview')
    await expect(page.getByTestId('wr-kaart-0')).toContainText('1 van 4 · Wat bewoog')
    for (const s of ['gesprekken', 'afspraken', 'overdrachten', 'bereik', 'pogingen']) await expect(page.getByTestId(`wr-cijfer-${s}`)).toBeVisible()
    await page.getByTestId('wr-stap-2').click()
    const rij = page.getByTestId(`wr-blijver-${t.id}`)
    await expect(rij).toContainText('3 keer verschoven')
    await rij.getByTestId('wr-loslaten').click()
    await rij.getByTestId('wr-reden').fill('Klant koos een ander')
    await rij.getByTestId('wr-bevestig').click()
    await expect(rij.getByTestId('wr-besluit')).toHaveText('Losgelaten: Klant koos een ander')
    expect((await (await page.request.get(`/api/tasks/${t.id}`)).json()).status).toBe('geannuleerd')
  })

  test('Plan in zet de datum en de teller begint opnieuw', async ({ page }) => {
    await login(page, 'u-01')
    const t = await (await page.request.post('/api/tasks', { data: { title: `Inplannen e2e ${Date.now()}`, actionType: 'bellen', dueDate: dagNa(0) } })).json()
    for (const n of [1, 2, 3]) await page.request.put(`/api/tasks/${t.id}`, { data: { dueDate: dagNa(n) } })
    const week = (await (await page.request.get('/api/weekreview')).json()).week
    const r = await page.request.post('/api/weekreview/blijver', { data: { week: week.van, taakId: t.id, besluit: 'inplannen', datum: week.volgende } })
    expect(r.ok()).toBe(true)
    const na = await (await page.request.get('/api/weekreview')).json()
    expect(na.liggen.blijvers.find((b: any) => b.id === t.id)?.besluit).toMatchObject({ besluit: 'inplannen', datum: week.volgende })
    expect((await page.request.post('/api/weekreview/blijver', { data: { week: week.van, taakId: t.id, besluit: 'loslaten', reden: '' } })).status()).toBe(422)
  })

  test('voornemens worden meteen iets in volgende week, gedeeld met de manager, en Kies opnieuw maakt ze ongedaan', async ({ page }) => {
    await login(page, 'u-01')
    const week = (await (await page.request.get('/api/weekreview')).json()).week
    await page.request.delete('/api/weekreview/voornemens', { params: { week: week.van } })
    await ga(page, '/weekreview')
    await page.getByTestId('wr-stap-3').click()
    await expect(page.getByTestId('wr-kop-volgende')).toHaveText('Kies tot 3 voornemens.')
    // Twee voorstellen staan al aan; een eigen voornemen maakt er drie, een vierde kan niet.
    await page.getByTestId('wr-eigen').fill('Elke afspraak met een tweede contact')
    await page.getByTestId('wr-eigen-toevoegen').click()
    await expect(page.getByTestId('wr-eigen-voornemen')).toHaveAttribute('aria-pressed', 'true')
    const vierde = page.locator('[data-test^="wr-voorstel-"][aria-pressed="false"]').first()
    if (await vierde.count()) { await vierde.click(); await expect(page.getByText('Hooguit drie voornemens.')).toBeVisible(); await expect(vierde).toHaveAttribute('aria-pressed', 'false') }
    if ((await page.getByTestId('wr-delen').getAttribute('aria-checked')) !== 'true') await page.getByTestId('wr-delen').click()
    await expect(page.getByTestId('wr-delen')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('wr-zet-in').click()
    await expect(page.getByTestId('wr-ingepland')).toContainText('Elke afspraak met een tweede contact')
    await expect(page.getByTestId('wr-ingepland').locator('li')).toHaveCount(3)
    await expect(page.getByTestId('wr-ingepland')).toContainText('Gedeeld')
    const api = await (await page.request.get('/api/weekreview')).json()
    expect(api.volgende.ingepland).toHaveLength(3)
    expect(api.volgende.ingepland.every((v: any) => v.gedeeld)).toBe(true)
    expect(api.volgende.ingepland.find((v: any) => v.tekst === 'Elke afspraak met een tweede contact').data.taakIds).toHaveLength(1)
    // Nog een keer inplannen kan niet; Kies opnieuw wel.
    expect((await page.request.post('/api/weekreview/voornemens', { data: { week: week.van, voornemens: [{ soort: 'taak', tekst: 'Nog een' }] } })).status()).toBe(409)
    await page.getByTestId('wr-opnieuw').click()
    await expect(page.getByTestId('wr-zet-in')).toBeVisible()
    expect((await (await page.request.get('/api/weekreview')).json()).volgende.ingepland).toHaveLength(0)
  })

  test('op de telefoon veeg je door de vier kaarten, zonder horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-01')
    await ga(page, '/weekreview')
    await expect(page.getByTestId('wr-kaart-0')).toHaveAttribute('aria-hidden', 'false')
    await page.getByTestId('wr-baan').evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: 'instant' as ScrollBehavior }))
    await expect(page.getByTestId('wr-kaart-1')).toHaveAttribute('aria-hidden', 'false')
    await page.getByTestId('wr-volgende').click()
    await expect(page.getByTestId('wr-kaart-2')).toHaveAttribute('aria-hidden', 'false')
    const [breed, venster] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(breed).toBeLessThanOrEqual(venster)
    const knop = await page.getByTestId('wr-volgende').boundingBox()
    expect(knop!.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('Weekstart en dagstart', () => {
  test('weekstart toont de week, het tempo, wat openstaat en de voornemens', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/weekstart')
    await expect(page.getByTestId('ws-week').locator('[data-test^="ws-dag-"]')).toHaveCount(5)
    await expect(page.getByTestId('ws-tempo')).toContainText('Tempo tegen je doel')
    await expect(page.getByTestId('ws-open')).toContainText('Wat openstaat')
    await expect(page.getByTestId('ws-voornemens')).toBeVisible()
    await expect(page.getByTestId('ws-naar-dagstart')).toHaveAttribute('href', '/dagstart')
  })

  test('dagstart deelt de dag in met het belblok op het beste uur en wisselt buiten- en binnendienst', async ({ page }) => {
    await login(page, 'u-07')
    const dag = volgendeWerkdag()
    await ga(page, `/dagstart?dag=${dag}`)
    await expect(page.getByTestId('ds-titel')).toHaveText('Je dag staat klaar.')
    await expect(page.getByTestId('ds-bereik')).toContainText('Wanneer neemt jouw doelgroep op?')
    await expect(page.getByTestId('ds-bel-uitleg')).not.toBeEmpty()
    await expect(page.getByTestId('ds-schoof')).toContainText('Wat schoof')
    await page.getByTestId('ds-modus-buiten').click()
    await expect(page).toHaveURL(/modus=buiten/)
    await expect(page.getByTestId('ds-modus-buiten')).toHaveAttribute('aria-pressed', 'true')
    const api = await (await page.request.get(`/api/dagstart?dag=${dag}&modus=binnen`)).json()
    expect(api.modus).toBe('binnen')
    expect(api.plan.blokken.length).toBeGreaterThan(0)
    expect((await page.request.get('/api/dagstart?dag=morgen')).status()).toBe(400)
  })

  test('Vandaag en Mijn dashboard leiden naar het ritme', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/')
    await expect(page.locator('[data-test="dagritme-strook"]:visible')).toHaveCount(1)
    await ga(page, '/mijn-dashboard')
    await page.getByTestId('kop-meer').click()
    await expect(page.getByTestId('knop-weekreview')).toHaveAttribute('href', '/weekreview')
    await expect(page.getByTestId('knop-weekstart')).toHaveAttribute('href', '/weekstart')
  })
})

test.describe('Dagritme per mail', () => {
  test('drie schakelaars met tijdstip bij Notificaties, ook in Mijn instellingen, en een voorbeeld via de mock', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/notificaties')
    await page.getByTestId('voorkeuren-knop').click()
    const blok = page.getByTestId('dagritme-mail')
    for (const s of ['weekreview', 'weekstart', 'dagstart']) await expect(blok.getByTestId(`dagritme-mail-${s}`)).toBeVisible()
    const schakel = blok.getByTestId('dagritme-mail-weekreview-aan')
    if ((await schakel.getAttribute('aria-checked')) !== 'true') await schakel.click()
    await expect(schakel).toHaveAttribute('aria-checked', 'true')
    await blok.getByTestId('dagritme-mail-weekreview-tijd').selectOption('16:00')
    await blok.getByTestId('dagritme-mail-weekreview-voorbeeld').click()
    await expect(page.getByText(/Voorbeeld verstuurd naar eva@voltvast\.test/)).toBeVisible()
    const r = await (await page.request.post('/api/mij/dagritme-mail/voorbeeld', { data: { soort: 'dagstart' } })).json()
    expect(r.onderwerp).toMatch(/^Je dag: /)
    expect(r.tekst).toContain('/dagstart')
    expect(r.tekst).not.toMatch(/[–—]/)
    // Opgeslagen via de sync-wachtrij: na herladen staat hij aan, ook in Mijn instellingen.
    await page.waitForTimeout(1500)
    await ga(page, '/mijn-instellingen#dagritme-mail')
    const mi = page.locator('#dagritme-mail').getByTestId('dagritme-mail-weekreview-aan')
    await expect(mi).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('#dagritme-mail').getByTestId('dagritme-mail-weekreview-tijd')).toHaveValue('16:00')
    await mi.click()
    await expect(mi).toHaveAttribute('aria-checked', 'false')
    expect((await page.request.post('/api/mij/dagritme-mail/voorbeeld', { data: { soort: 'iets' } })).status()).toBe(422)
  })

  test('de geplande verzender vraagt het geheim', async ({ request }) => {
    expect((await request.post('/api/motor/dagritme-mail')).status()).toBe(401)
  })
})
