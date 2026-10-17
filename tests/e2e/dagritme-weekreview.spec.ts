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

  test('dagstart deelt de dag in volgens je werkplek, zonder keuzeknop, met alleen je eigen cijfers', async ({ page }) => {
    await login(page, 'u-07')
    const dag = volgendeWerkdag()
    await ga(page, `/dagstart?dag=${dag}`)
    await expect(page.getByTestId('ds-titel')).toHaveText('Je dag staat klaar.')
    await expect(page.getByTestId('ds-bereik')).toContainText('Wanneer neemt jouw doelgroep op?')
    await expect(page.getByTestId('ds-bereik-meta')).toContainText('eigen belpoging')
    await expect(page.getByTestId('ds-bel-uitleg')).not.toBeEmpty()
    await expect(page.getByTestId('ds-schoof')).toContainText('Wat schoof')
    // Geen keuzeknop binnendienst of buitendienst: de werkplek (Eva: binnendienst) bepaalt het.
    await expect(page.getByTestId('ds-modus-buiten')).toHaveCount(0)
    await expect(page.getByTestId('ds-modus-binnen')).toHaveCount(0)
    await expect(page.getByTestId('ds-werkplek')).toHaveText('Binnendienst · je werkplek')
    const api = await (await page.request.get(`/api/dagstart?dag=${dag}`)).json()
    expect(api.modus).toBe('binnen')
    expect(api.plan.blokken.length).toBeGreaterThan(0)
    // De bereikbaarheid telt alleen Eva's eigen belpogingen: over alle branches is het aantal elke dag gelijk.
    const alle = async (q: string) => (await (await page.request.get(`/api/dagstart?${q}branche=alle`)).json()).bereik.pogingen
    expect(await alle(`dag=${dag}&`)).toBe(await alle(''))
    expect((await page.request.get('/api/dagstart?dag=morgen')).status()).toBe(400)
  })

  for (const [pad, moment] of [['/dagstart', 'dagstart'], ['/weekstart', 'weekstart'], ['/weekreview', 'weekreview']] as const) {
    test(`${pad}: Tips en tricks en drie artikelen uit de academie, ook op de telefoon`, async ({ page }) => {
      await login(page, 'u-07')
      const api = await (await page.request.get(`/api${pad}`)).json()
      expect(api.steun.artikelen).toHaveLength(3)
      expect(api.steun.tips.length).toBeGreaterThan(0)
      for (const a of api.steun.artikelen) {
        expect(a.href).toBe(`/helpcenter/${a.slug}`)
        expect(`${a.titel} ${a.reden}`).not.toMatch(/[\u2013\u2014]/)
      }
      await ga(page, pad)
      const blok = page.getByTestId(`steun-${moment}`)
      await expect(blok.getByTestId('steun-tips')).toContainText('Tips en tricks')
      const artikelen = blok.getByTestId('steun-artikelen').locator('[data-test^="steun-artikel-"]')
      await expect(artikelen).toHaveCount(3)
      const eerste = api.steun.artikelen[0]
      await expect(blok.getByTestId(`steun-artikel-${eerste.slug}`)).toHaveAttribute('href', `/helpcenter/${eerste.slug}`)
      await expect(blok.getByTestId(`steun-artikel-${eerste.slug}`)).toContainText(eerste.reden)
      // Op de telefoon onder elkaar, zonder horizontale scroll en met tikdoelen van minstens 44 px.
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(artikelen.first()).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      expect((await artikelen.first().boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await blok.getByTestId(`steun-artikel-${eerste.slug}`).click()
      await expect(page).toHaveURL(new RegExp(`/helpcenter/${eerste.slug}$`))
    })
  }

  test('Vandaag en de Dagstart leiden naar het ritme; Mijn dashboard heeft geen Meer', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/')
    // Vandaag heeft geen dagritmeblok meer; de knop Dagstart in de kop leidt naar de dagstart.
    await expect(page.getByTestId('dagritme-strook')).toHaveCount(0)
    await expect(page.getByTestId('vandaag-dagstart')).toHaveAttribute('href', '/dagstart')
    // Mijn dashboard heeft geen Meer meer (met Weekreview en Weekstart); die open je via de Dagstart.
    await ga(page, '/mijn-dashboard')
    await expect(page.getByTestId('kop-meer')).toHaveCount(0)
    await expect(page.getByTestId('knop-weekreview')).toHaveCount(0)
    await ga(page, '/dagstart')
    const ritme = page.getByRole('navigation', { name: 'Meer van je ritme' })
    await expect(ritme.locator('a[href="/weekreview"]')).toBeVisible()
    await expect(ritme.locator('a[href="/weekstart"]')).toBeVisible()
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

// Blokken op Dagstart en Weekstart (shared/ritmeBlokken.ts): belblokken om te vullen, belprioriteit naast je
// afspraken, kansen langs de route, lopende campagnes en accountplannen. Eva (u-07, Expert) heeft ze allemaal.
const BLOKKEN = ['belblokken', 'belprioriteit', 'kansen', 'campagnes', 'accountplannen'] as const
test.describe('Blokken op Dagstart en Weekstart', () => {
  for (const breedte of [1280, 390]) {
    test(`weekstart en dagstart tonen vijf blokken met uitleg, ${breedte} px`, async ({ page }) => {
      await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
      await login(page, 'u-07')
      const dag = volgendeWerkdag()
      for (const pad of ['/weekstart', `/dagstart?dag=${dag}`]) {
        const api = await (await page.request.get(`/api${pad}`)).json()
        for (const b of BLOKKEN) expect(api.blokken[b]).not.toBeNull()
        await ga(page, pad)
        for (const b of BLOKKEN) {
          const kaart = page.getByTestId(`rb-${b}`)
          await expect(kaart).toBeVisible()
          await expect(kaart.getByTestId('rb-waarom')).not.toBeEmpty()
          expect(await kaart.textContent()).not.toMatch(/[–—]/)
        }
        // Lopende campagnes en accountplannen linken naar hun pagina.
        for (const c of api.blokken.campagnes.lopend) await expect(page.getByTestId(`rb-campagne-${c.id}`).locator(`a[href="/campagnes/${c.id}"]`).first()).toBeVisible()
        for (const p of api.blokken.accountplannen.lopend) await expect(page.getByTestId(`rb-plan-${p.id}`).locator(`a[href="/accountplannen/${p.id}"]`).first()).toBeVisible()
        if (!api.blokken.campagnes.lopend.length) await expect(page.getByTestId('rb-campagnes-leeg')).toBeVisible()
        if (!api.blokken.kansen.dagen.length) await expect(page.getByTestId('rb-kansen-leeg')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
        if (breedte < 500) {
          for (const knop of await page.locator('[data-test^="rb-"] .dd-act').all()) {
            if (await knop.isVisible()) expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
          }
        }
      }
    })
  }

  test('een taak opent de taakflyout, een afspraak de afspraakflyout', async ({ page }) => {
    await login(page, 'u-07')
    const dag = volgendeWerkdag()
    const api = await (await page.request.get(`/api/dagstart?dag=${dag}`)).json()
    await ga(page, `/dagstart?dag=${dag}`)
    const afspraak = api.blokken.belprioriteit.afspraken[0]
    if (afspraak) {
      await page.getByTestId(`rb-afspraak-${afspraak.id}`).click()
      await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('afspraak-flyout')).toHaveCount(0)
    }
    const taak = api.blokken.belprioriteit.lijst.find((b: any) => b.taskId)
    test.skip(!taak, 'Geen beltaak in de belprioriteit')
    await page.getByTestId(`rb-bel-taak-${taak.taskId}`).click()
    await expect(page.getByTestId('taak-flyout')).toBeVisible()
    await expect(page).toHaveURL(/\/dagstart/)
  })

  test('Vul belblok hangt het voorstel aan het blok; de API weigert wat niet klopt', async ({ page }) => {
    await login(page, 'u-07')
    expect((await page.request.post('/api/belblokken/bestaat-niet/vul', { data: { accountIds: ['x'] } })).status()).toBe(404)
    const api = await (await page.request.get('/api/weekstart')).json()
    const blok = [...api.blokken.belblokken.blokken].reverse().find((b: any) => b.kanVullen)
    test.skip(!blok, 'Geen belblok meer om te vullen')
    expect((await page.request.post(`/api/belblokken/${blok.id}/vul`, { data: { accountIds: [] } })).status()).toBe(422)
    await ga(page, '/weekstart')
    const rij = page.getByTestId(`rb-blok-${blok.id}`)
    await expect(rij.getByTestId('rb-voorstel')).toContainText(blok.voorstel[0].accountNaam)
    await expect(rij.getByTestId(`rb-open-${blok.id}`)).toHaveAttribute('href', `/belblokken/${blok.id}`)
    await rij.getByTestId(`rb-vul-${blok.id}`).click()
    await expect(page.getByText(/in je belblok van/)).toBeVisible()
    const na = await (await page.request.get('/api/weekstart')).json()
    const lijst = await (await page.request.get('/api/belblokken')).json()
    expect(lijst.gepland.find((s: any) => s.id === blok.id)?.gesprekken).toBe(blok.gesprekken + blok.voorstel.length)
    expect(na.blokken.belblokken.blokken.find((b: any) => b.id === blok.id)?.gesprekken ?? Infinity).toBeGreaterThan(blok.gesprekken)
    // Nog een keer met dezelfde accounts: die staan al in een blok.
    expect((await page.request.post(`/api/belblokken/${blok.id}/vul`, { data: { accountIds: blok.voorstel.map((v: any) => v.accountId) } })).status()).toBe(409)
  })

  test('een blok staat er alleen als de functie voor je niveau aanstaat (Beginner)', async ({ page }) => {
    await login(page, 'u-02')
    const api = await (await page.request.get('/api/weekstart')).json()
    await ga(page, '/weekstart')
    for (const b of BLOKKEN) {
      if (api.blokken[b] === null) await expect(page.getByTestId(`rb-${b}`)).toHaveCount(0)
      else await expect(page.getByTestId(`rb-${b}`)).toBeVisible()
    }
    // Belprioriteit (Gevorderd) en Accountplannen (Expert) staan voor een beginner uit.
    expect(api.blokken.belprioriteit).toBeNull()
    expect(api.blokken.accountplannen).toBeNull()
  })
})
