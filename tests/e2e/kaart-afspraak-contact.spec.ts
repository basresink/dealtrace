// Wensen W8 op 1280 en 390 px: (1) het actielabel op de account- en contactkaart is hetzelfde Label als in Taken,
// (2) de afspraakflyout heeft geen keuze Online of Telefoon meer en een gemaakte afspraak is te wijzigen,
// (3) bij + Taak en + Afspraak maak je direct een contact aan, (4) "+ Plan belafspraak" op Meetings opent + Taak
// met type Bellen, (5) Terug in beeld heeft rechtsboven de knop Filters met het filterpaneel. Alle data is fictief.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { apiLogin, ga } from './hulp'

test.describe.configure({ timeout: 120_000 })
const nr = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
const dagOver = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

async function maakAccount(request: APIRequestContext, naam: string) {
  const r = await request.post('/api/accounts', { data: { naam, plaats: 'Testdorp' } })
  expect(r.ok()).toBe(true)
  return (await r.json()) as { id: string; naam: string }
}
async function soortId(request: APIRequestContext, slug: string) {
  const m: any = await (await request.get('/api/meetingsoorten')).json()
  return m.soorten.find((s: any) => s.slug === slug).id as string
}
async function opruimen(request: APIRequestContext, id: string) {
  await request.post(`/api/accounts/${id}/deactiveren`, { data: { reden: 'overig', toelichting: 'Testaccount van de kaart-afspraak-contact-spec' } })
}
async function geenHorizontaleScroll(page: Page) {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(sw).toBeLessThanOrEqual(w)
}

for (const breedte of [1280, 390]) {
  test.describe(`W8 op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('1. actielabels op de accountkaart zijn hetzelfde Label als in Taken', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const a = await maakAccount(page.request, `Testlabelkaart ${breedte} ${nr()}`)
      const taak = await page.request.post('/api/tasks', { data: { title: `Bel de inkoper ${nr()}`, actionType: 'bellen', accountId: a.id, dueDate: new Date(Date.now() + 2 * 864e5).toISOString() } })
      expect(taak.ok()).toBe(true)
      const af = await page.request.post('/api/afspraken', { data: { accountId: a.id, meetingsoortId: await soortId(page.request, 'online-meeting'), start: `${dagOver(9)}T09:00:00.000Z` } })
      expect(af.ok()).toBe(true)
      const losTitel = `Stuur de offerte ${nr()}`
      expect((await page.request.post('/api/tasks', { data: { title: losTitel, actionType: 'taak', accountId: a.id, dueDate: new Date(Date.now() + 3 * 864e5).toISOString() } })).ok()).toBe(true)

      await ga(page, `/accounts/${a.id}`)
      const tl = page.getByTestId('tijdlijn')
      // Een gewone taak: één label Taak (soort actie, zoals in Taken), nooit "TAAK TAAK" en geen los soortlabel.
      const los = tl.locator('.tl-item', { hasText: losTitel })
      await expect(los.locator('[data-test=tl-actie][data-waarde=taak]')).toHaveCount(1)
      await expect(los.locator('.tl-soort, .tl-type')).toHaveCount(0)
      await expect(tl.locator('.tl-item').filter({ has: page.locator('[data-test=tl-actie][data-waarde=online]') }).first().locator('.tl-soort')).toHaveCount(0)
      const bel = tl.locator('[data-test=tl-actie][data-waarde=bellen]').first()
      await expect(bel).toBeVisible()
      await expect(bel).toHaveClass(/lbl lbl--zacht lbl--blauw/)
      await expect(bel.locator('svg')).toHaveCount(1)
      await expect(tl.locator('[data-test=tl-actie][data-waarde=online]').first()).toHaveText(/Online/)
      // Geen losse typepil meer voor taken en afspraken.
      await expect(tl.locator('.tl-type', { hasText: 'Bellen' })).toHaveCount(0)

      await page.getByTestId('tab-afspraken').click()
      await expect(page.locator('[data-test=tl-actie][data-waarde=online]').first()).toHaveClass(/lbl--zacht/)
      await page.getByTestId('tab-taken').click()
      const tabLabel = page.locator('[data-test=tl-actie][data-waarde=bellen]').first()
      const kaartKlasse = await tabLabel.getAttribute('class')

      // Hetzelfde label in de takenlijst op /taken.
      await ga(page, '/taken?weergave=lijst&q=' + encodeURIComponent('Bel de inkoper'))
      const takenLabel = page.locator('[data-test=taak-soort][data-waarde=bellen]').first()
      await expect(takenLabel).toBeVisible()
      expect(await takenLabel.getAttribute('class')).toBe(kaartKlasse)
      if (breedte < 500) await geenHorizontaleScroll(page)
      await opruimen(page.request, a.id)
    })

    test('2. afspraak zonder vormkeuze plannen en daarna wijzigen met opslaan-status', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const a = await maakAccount(page.request, `Testafspraakwijzig ${breedte} ${nr()}`)
      await page.request.post('/api/contacten', { data: { accountId: a.id, voornaam: 'Iris', achternaam: 'Testwijzig', functie: 'Inkoper' } })
      const titel = `Leverplan ${nr()}`
      await ga(page, `/accounts/${a.id}?tab=afspraken`)
      await page.getByTestId('afspraken-nieuw').click()
      const pa = page.getByTestId('plan-afspraak')
      await expect(pa).toBeVisible()
      // Geen keuze Online of Telefoon: de vorm volgt uit het type.
      await expect(pa.locator('[role=radio]')).toHaveCount(0)
      await page.getByTestId('pa-soort').selectOption({ label: 'Belafspraak' })
      await expect(page.getByTestId('pa-soort')).toHaveAttribute('data-vorm', 'telefoon')
      await page.getByTestId('pa-soort').selectOption({ label: 'Online meeting' })
      await expect(page.getByTestId('pa-soort')).toHaveAttribute('data-vorm', 'online')
      await page.getByTestId('pa-titel').fill(titel)
      await page.getByTestId('pa-datum').fill(dagOver(80))
      await page.getByTestId('pa-start').fill('10:00')
      await page.getByTestId('pa-plan').click()
      await expect(pa).toHaveCount(0)

      await page.locator('[data-test^="ak-afspraak-"]', { hasText: titel }).click()
      const fly = page.getByTestId('afspraak-flyout')
      await expect(fly).toBeVisible()
      await page.getByTestId('af-verplaats').click()
      await expect(page.getByTestId('af-verplaats-blok')).toBeVisible()
      await page.getByTestId('af-vp-soort').selectOption({ label: 'Belafspraak' })
      await expect(page.getByTestId('af-vp-soort')).toHaveAttribute('data-vorm', 'telefoon')
      await page.getByTestId('af-vp-datum').fill(dagOver(81))
      await page.getByTestId('af-vp-start').fill('13:45')
      await page.getByTestId('af-vp-duur').selectOption('45')
      await page.getByTestId('af-vp-contact').selectOption({ label: 'Iris Testwijzig · Inkoper' })
      await page.getByTestId('af-vp-locatie').fill('Belt zelf in')
      await page.getByTestId('af-vp-notitie').fill('Leverplan en volumes doornemen.')
      await expect(fly.getByTestId('fs-status')).toContainText('Gewijzigd')
      await page.getByTestId('af-verplaats-bewaar').click()
      await expect(page.getByTestId('af-verplaats-blok')).toHaveCount(0)
      await expect(fly.getByTestId('fs-status')).toContainText('Opgeslagen')
      await expect(page.getByTestId('af-defs')).toContainText('13:45 tot 14:30')
      await expect(page.getByTestId('af-defs')).toContainText('Leverplan en volumes doornemen.')
      await expect(page.getByTestId('af-contact')).toContainText('Iris Testwijzig')
      await expect(page.getByTestId('af-kicker')).toContainText('BELAFSPRAAK')

      // De agenda geeft de nieuwe stand: telefonisch, nieuw moment.
      const ag: any = await (await page.request.get(`/api/agenda?van=${dagOver(80)}&tot=${dagOver(82)}`)).json()
      const x = ag.afspraken.find((y: any) => y.titel === titel)
      expect(x.vorm).toBe('telefoon')
      expect(x.soort.slug).toBe('belafspraak')
      expect(new Date(x.start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })).toBe(dagOver(81))
      if (breedte < 500) {
        const h = await page.getByTestId('af-verplaats').boundingBox()
        expect(h!.height).toBeGreaterThanOrEqual(44)
      }
      await opruimen(page.request, a.id)
    })

    test('2b. PUT /api/afspraken/:id: rechten en een contact van een andere prospect', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const a = await maakAccount(page.request, `Testputrecht ${breedte} ${nr()}`)
      const b = await maakAccount(page.request, `Testputander ${breedte} ${nr()}`)
      const c: any = await (await page.request.post('/api/contacten', { data: { accountId: b.id, achternaam: 'Testvreemd' } })).json()
      const { id } = await (await page.request.post('/api/afspraken', { data: { accountId: a.id, meetingsoortId: await soortId(page.request, 'belafspraak'), start: `${dagOver(84)}T09:00:00.000Z` } })).json()
      const fout = await page.request.put(`/api/afspraken/${id}`, { data: { contactId: c.id } })
      expect(fout.status()).toBe(422)
      // Een andere accountmanager mag andermans afspraak niet wijzigen.
      await apiLogin(page.request, 'u-02')
      const ander = await page.request.put(`/api/afspraken/${id}`, { data: { titel: 'Niet van mij' } })
      expect([403, 404]).toContain(ander.status())
      await apiLogin(page.request, 'u-07')
      await opruimen(page.request, a.id)
      await opruimen(page.request, b.id)
    })

    test('3. + Taak en + Afspraak: direct een contact maken dat daarna gekozen is', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const a = await maakAccount(page.request, `Testsnelcontact ${breedte} ${nr()}`)
      await ga(page, `/accounts/${a.id}`)
      await page.getByTestId('tl-taak').click()
      await expect(page.getByTestId('nieuwe-taak')).toBeVisible()
      const open = page.getByTestId('nt-nc-open')
      await expect(open).toContainText('Maak een contactpersoon')
      await open.click()
      await page.getByTestId('nt-nc-voornaam').fill('Noor')
      await page.getByTestId('nt-nc-achternaam').fill('Testsnel')
      await page.getByTestId('nt-nc-functie').fill('Facilitair manager')
      await page.getByTestId('nt-nc-telefoon').fill('0612345678')
      await page.getByTestId('nt-nc-email').fill(`noor.${nr()}@voorbeeld.test`)
      await page.getByTestId('nt-nc-bewaar').click()
      await expect(page.getByTestId('nt-contact-keuze')).toContainText('Noor Testsnel')
      if (breedte < 500) await geenHorizontaleScroll(page)
      const taakTitel = `Bel Noor terug ${nr()}`
      await page.getByTestId('nt-titel').fill(taakTitel)
      await page.getByTestId('nt-maak').click()
      await expect(page.getByTestId('nieuwe-taak')).toHaveCount(0)
      const tab: any = await (await page.request.get(`/api/accounts/${a.id}/tabbladen`)).json()
      const t = tab.taken.find((x: any) => x.title === taakTitel)
      expect(t.contactNaam).toContain('Testsnel')

      // + Afspraak: nog een nieuw contact, dat daarna gekozen is.
      await page.getByTestId('tl-afspraak').click()
      await expect(page.getByTestId('plan-afspraak')).toBeVisible()
      await page.getByTestId('pa-nc-open').click()
      await page.getByTestId('pa-nc-voornaam').fill('Bram')
      await page.getByTestId('pa-nc-achternaam').fill('Testplan')
      await page.getByTestId('pa-nc-bewaar').click()
      await expect(page.getByTestId('pa-contact-gekozen')).toContainText('Bram Testplan')
      if (breedte < 500) {
        const h = await page.getByTestId('pa-contact-wis').boundingBox()
        expect(h!.height).toBeGreaterThanOrEqual(44)
      }
      await opruimen(page.request, a.id)
    })

    test('4. Meetings: + Plan belafspraak opent + Taak met type Bellen en de prospect', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const beurt: any = await (await page.request.get('/api/meetings/aan-de-beurt')).json()
      const v = (beurt?.voorstellen ?? []).find((x: any) => x.advies === 'belafspraak')
      test.skip(!v, 'Geen voorstel met advies belafspraak in de Meetinglijst')
      await ga(page, '/meetings')
      const knop = page.getByTestId(`beurt-plan-${v.accountId}`)
      await expect(knop).toHaveText('+ Plan belafspraak')
      await knop.click()
      await expect(page.getByTestId('nieuwe-taak')).toBeVisible()
      await expect(page.getByTestId('plan-afspraak')).toHaveCount(0)
      await expect(page.getByTestId('nt-type-bellen')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('nt-klant-keuze')).toContainText(v.naam)
      const contacten: any[] = await (await page.request.get(`/api/contacten/kies?accountId=${v.accountId}`)).json()
      if (contacten.length) await expect(page.getByTestId('nt-contact-keuze')).toContainText(contacten[0].naam)
      await expect(page.getByTestId('nt-titel')).toHaveValue(/^Bel /)
      if (breedte < 500) await geenHorizontaleScroll(page)
    })

    test('5. Terug in beeld: knop Filters rechtsboven met het filterpaneel', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      await ga(page, '/terug-in-beeld')
      const knop = page.getByTestId('tib-filterknop')
      await expect(knop).toBeVisible()
      await expect(knop).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByTestId('tib-filters')).toHaveCount(0)
      // De knop staat in de kop, naast Terugkomregels.
      await expect(page.getByTestId('kop-knoppen').getByTestId('tib-filterknop')).toBeVisible()
      await knop.click()
      const paneel = page.getByTestId('tib-filters')
      await expect(paneel).toBeVisible()
      await expect(paneel.getByTestId('tib-zoek')).toBeVisible()
      await expect(paneel.locator('.filter-pil').first()).toBeVisible()
      await paneel.getByTestId('tib-status-klaar').click()
      await expect(page).toHaveURL(/status=klaar/)
      await expect(page.getByTestId('tib-filter-aantal')).toHaveText('1')
      // Met een filter in de URL staat het paneel meteen open.
      await ga(page, '/terug-in-beeld?kanaal=bellen')
      await expect(page.getByTestId('tib-filters')).toBeVisible()
      if (breedte < 500) {
        await geenHorizontaleScroll(page)
        const h = await page.getByTestId('tib-filterknop').boundingBox()
        expect(h!.height).toBeGreaterThanOrEqual(44)
      }
    })
  })
}
