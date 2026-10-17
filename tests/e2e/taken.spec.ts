// P07: Vandaag, Taken (voorheen Acties), inzichten, één afrondpad en het hercontactritme.
import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

/** Een naam die niet op andere testnamen lijkt (de dubbelcheck kijkt naar gelijkenis). */
const naam = () => Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => 'bcdfghjklmnprstvwz'[Math.floor(Math.random() * 18)] + 'aeiou'[Math.floor(Math.random() * 5)]).join('').slice(0, 7)).join(' ')

const uniek = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`

/** Een vers account in Gekwalificeerd met een lopend ritme en poging 1 als taak, voor deze gebruiker. */
async function inRitme(request: APIRequestContext, gebruiker: string): Promise<{ accountId: string; taakId: string }> {
  await apiLogin(request, gebruiker)
  const { id } = await (await request.post('/api/accounts', { data: { naam: naam() } })).json()
  await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'gekwalificeerd' } })
  const taken = await (await request.get('/api/tasks?eigenaar=mij')).json()
  const taak = taken.groepen.flatMap((g: any) => g.taken).find((t: any) => t.account?.id === id && t.poging?.n === 1)
  expect(taak, 'poging 1 klaargezet door de motor').toBeTruthy()
  return { accountId: id, taakId: taak.id }
}

test.describe('Vandaag', () => {
  test('met 30 open taken toont Vandaag er 8 en "nog 22 meer"; een achterstallige taak staat bovenaan', async ({ page }) => {
    await apiLogin(page.request, 'u-05')
    const bestaand = (await (await page.request.get('/api/vandaag')).json()).taken.totaal
    const gisteren = new Date(Date.now() - 2 * 864e5).toISOString()
    await page.request.post('/api/tasks', { data: { title: `Achterstallig ${uniek()}`, actionType: 'taak', dueDate: gisteren } })
    for (let i = 0; i < 29 - bestaand; i++) await page.request.post('/api/tasks', { data: { title: `Vandaagtaak ${i} ${uniek()}`, actionType: 'taak', dueDate: new Date().toISOString() } })
    await login(page, 'u-05')
    await ga(page, '/')
    const rijen = page.locator('[data-test^=vandaag-taak-]')
    await expect(rijen).toHaveCount(8)
    const totaal = Number(await page.getByTestId('kolom-taken').locator('.vp-num').first().textContent())
    await expect(page.getByTestId('nog-meer')).toHaveText(`nog ${totaal - 8} meer →`)
    await expect(rijen.first()).toHaveClass(/taak-kaart--achter/)
    // Het belblokvak (werkblok) onderaan is weg.
    await expect(page.getByTestId('werkblok')).toHaveCount(0)
  })

  test('binnendienst ziet geen belblokvak meer; salesmanager ziet Team vandaag; Beginner geen agents-blok', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/')
    await expect(page.getByTestId('werkblok')).toHaveCount(0)
    // Door AI agents gedaan is vervangen door het blok Belscript.
    await expect(page.getByTestId('agents')).toHaveCount(0)
    await expect(page.getByTestId('belscript')).toBeVisible()
    await expect(page.getByTestId('week')).toHaveCount(0)
    await expect(page.getByTestId('datakwaliteit')).toHaveCount(0)
    await expect(page.getByTestId('team-vandaag')).toHaveCount(0)
    await login(page, 'u-04')
    await ga(page, '/')
    await expect(page.getByTestId('team-vandaag')).toContainText('over tijd')
    await login(page, 'u-02')
    await ga(page, '/')
    await expect(page.getByTestId('kolom-taken')).toBeVisible()
    await expect(page.getByTestId('week')).toHaveCount(0)
    await expect(page.getByTestId('agents')).toHaveCount(0)
  })
})

test.describe('afronden (gat 11)', () => {
  test('flyout, wachtrij en bulk geven dezelfde volgende poging en dezelfde activiteit', async ({ request }) => {
    const a = await inRitme(request, 'u-03')
    const b = await inRitme(request, 'u-03')
    const c = await inRitme(request, 'u-03')
    const via = {
      flyout: await (await request.post(`/api/tasks/${a.taakId}/afronden`, { data: { uitkomst: 'geen_reactie', idempotentieSleutel: uniek() } })).json(),
      sync: (await (await request.post('/api/sync/mutations', { data: { mutaties: [{ idempotentieSleutel: `s-${uniek()}`, tabel: 'tasks', op: 'patch', recordId: b.taakId, patch: { soort: 'taak.afronden', uitkomst: 'geen_reactie' } }] } })).json()).resultaten[0],
      bulk: await (await request.post('/api/tasks/bulk', { data: { ids: [c.taakId], actie: 'afronden', uitkomst: 'geen_reactie' } })).json(),
    }
    expect(via.flyout.volgende).toMatchObject({ stap: 2, van: 5, kanaal: 'bellen' })
    expect(via.sync.status).toBe('ok')
    expect(via.bulk.aantal).toBe(1)
    const taken = (await (await request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken)
    for (const x of [a, b, c]) {
      const vervolg = taken.filter((t: any) => t.account?.id === x.accountId && t.poging)
      expect(vervolg.map((t: any) => ({ n: t.poging?.n, van: t.poging?.van, actie: t.actionType, herkomst: t.herkomst }))).toEqual([{ n: 2, van: 5, actie: 'bellen', herkomst: 'ritme' }])
      const kaart = await (await request.get(`/api/accounts/${x.accountId}`)).json()
      expect(kaart.tijdlijn.filter((t: any) => t.soort === 'gebeld' && t.uitkomst === 'geen_reactie')).toHaveLength(1)
    }
  })

  test('een contacttaak zonder uitkomst: 422; dezelfde sleutel twee keer: één afronding', async ({ request }) => {
    const a = await inRitme(request, 'u-03')
    expect((await request.post(`/api/tasks/${a.taakId}/afronden`, { data: {} })).status()).toBe(422)
    const sleutel = uniek()
    const een = await (await request.post(`/api/tasks/${a.taakId}/afronden`, { data: { uitkomst: 'voicemail', idempotentieSleutel: sleutel } })).json()
    const twee = await (await request.post(`/api/tasks/${a.taakId}/afronden`, { data: { uitkomst: 'voicemail', idempotentieSleutel: sleutel } })).json()
    expect(twee.alAfgerond).toBe(true)
    expect(twee.vervolgId).toBe(een.vervolgId)
    expect(een.volgende.kanaal).toBe('mail')
  })

  test('in de flyout: "Geen reactie" geeft de toast met de volgende poging', async ({ page }) => {
    const a = await inRitme(page.request, 'u-03')
    await login(page, 'u-03')
    await ga(page, `/taken?taak=${a.taakId}`)
    await expect(page.getByTestId('pogingregel')).toContainText('poging 1 van 5')
    await expect(page.getByTestId('afronden')).toBeDisabled()
    await page.getByTestId('uitkomst-geen_reactie').click()
    await page.getByTestId('afronden').click()
    await expect(page.locator('.toast').last()).toContainText(/Afgerond\. Volgende poging \w+ \d+ \w+, bellen\./)
  })

  test('laatste poging zonder reactie: geparkeerd met terugkomdatum', async ({ request }) => {
    const a = await inRitme(request, 'u-03')
    let taakId = a.taakId
    let laatste: any
    for (let i = 0; i < 5; i++) {
      laatste = await (await request.post(`/api/tasks/${taakId}/afronden`, { data: { uitkomst: 'geen_reactie', idempotentieSleutel: uniek() } })).json()
      taakId = laatste.vervolgId
    }
    expect(laatste.tekst).toMatch(/^Afgerond\. Geparkeerd tot \d{4}-\d{2}-\d{2}\.$/)
    const kaart = await (await request.get(`/api/accounts/${a.accountId}`)).json()
    expect(kaart.status).toBe('wachtend')
    expect(kaart.reis.fase.label).toBe('Geparkeerd')
    expect(kaart.terugkom.datum).toBeTruthy()
  })
})

test.describe('inzichten', () => {
  test('"Maak taak" geeft het label "Uit inzicht"; afwijzen zonder reden 422', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    await page.request.post('/api/motor/run', { data: {} })
    await login(page, 'u-03')
    await ga(page, '/inzichten?gelezen=alle')
    const kaart = page.locator('.inzicht-kaart[data-test^=inzicht-]').first()
    await expect(kaart).toBeVisible()
    const id = (await kaart.getAttribute('data-test'))!.replace('inzicht-', '')
    expect((await page.request.post(`/api/signals/${id}/afwijzen`, { data: {} })).status()).toBe(422)
    await kaart.getByRole('button', { name: '+ Maak taak' }).click()
    await expect(page.locator('.toast').last()).toContainText('Taak gemaakt uit het inzicht')
    const taken = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken)
    const uitInzicht = taken.find((t: any) => t.herkomst === 'inzicht')
    expect(uitInzicht).toBeTruthy()
    // De filtergroep Herkomst is weg; het label staat nog op de rij.
    await ga(page, `/taken?weergave=lijst&q=${encodeURIComponent(uitInzicht.title)}`)
    await expect(page.locator('.taak-kaart').first()).toContainText('Uit inzicht')
  })

  test('/inzichten in de opzet van DealDrive: kopregel, 3 kaarten per rij, flyout, filters in de URL en gelezen', async ({ page }) => {
    await apiLogin(page.request, 'u-06')
    await page.request.post('/api/motor/run', { data: {} })
    await login(page, 'u-03')
    await ga(page, '/inzichten?gelezen=alle')
    await expect(page.getByTestId('inzichten-titel')).toHaveText('Wat speelt er bij je accounts?')
    await expect(page.getByTestId('inzichten-aantal')).toHaveText(/^\d+ inzicht(en)?$/)
    await expect(page.getByText('Klik op een kaart voor de volledige context')).toBeVisible()
    const kaarten = page.locator('[data-test=inzichten] .inzicht-kaart')
    await expect(kaarten.first()).toBeVisible()
    // Kopbalk met accountnaam en soort, scorelabel (rand), bronlabel (rand met icoon) en de voet.
    const eerste = kaarten.first()
    await expect(eerste.locator('.ik-balk')).toBeVisible()
    await expect(eerste.getByTestId('ik-score')).toHaveText(/^\d+$/)
    await expect(eerste.getByTestId('ik-score')).toHaveClass(/lbl-score/)
    await expect(eerste.getByTestId('ik-bron')).toHaveText(/^(Intern|Extern|Agenda)$/)
    await expect(eerste.getByTestId('ik-bron')).toHaveClass(/lbl--rand/)
    await expect(eerste.getByRole('button', { name: '+ Maak taak' })).toBeVisible()
    // Drie per rij op een breed scherm.
    if ((await kaarten.count()) >= 3) {
      const y = await Promise.all([0, 1, 2].map(async (n) => (await kaarten.nth(n).boundingBox())!.y))
      expect(Math.max(...y) - Math.min(...y)).toBeLessThan(4)
      if ((await kaarten.count()) >= 4) expect(Math.round((await kaarten.nth(3).boundingBox())!.y)).toBeGreaterThan(Math.round(y[0]!))
    }
    // Klik op de kaart opent de flyout.
    await eerste.locator('.ik-tekst, .ik-titel').first().click()
    await expect(page.getByTestId('inzicht-flyout')).toBeVisible()
    await page.getByTestId('inzicht-flyout').getByRole('button', { name: 'Sluiten' }).click()
    // Filters staan in de URL; teller en periode.
    await page.getByTestId('inzicht-filters').click()
    await page.getByTestId('sinds-week').click()
    await expect(page).toHaveURL(/sinds=week/)
    await page.getByTestId('inzicht-stat-hot').click()
    await expect(page).toHaveURL(/teller=hot/)
    await page.getByTestId('reset-filters').click()
    await expect(page).not.toHaveURL(/sinds=/)
    // Markeer als gelezen vanaf de kaart: de kaart verdwijnt uit Ongelezen.
    await ga(page, '/inzichten')
    const kaart = page.locator('[data-test=inzichten] .inzicht-kaart').first()
    const id = (await kaart.getAttribute('data-test'))!
    await kaart.getByTestId('kaart-gelezen').click()
    await expect(page.locator(`[data-test="${id}"]`)).toHaveCount(0)
    // Een link met ?inzicht= opent dat inzicht, ook als het gelezen is; een oude link naar Acties komt hier ook uit.
    await ga(page, `/acties?tab=inzichten&inzicht=${id.replace('inzicht-', '')}`)
    await expect(page).toHaveURL(/\/inzichten\?inzicht=/)
    await expect(page.getByTestId('inzicht-flyout')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  })
})

test.describe('niveaus', () => {
  test('Beginner: lijst zonder horizon of bulk, minimale velden, /inzichten nog niet aangezet en /planning wel', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/taken')
    // Zonder de functie horizon blijft de lijst de standaard.
    await expect(page.getByTestId('horizon')).toHaveCount(0)
    await page.getByTestId('filters-knop').click()
    await expect(page.getByTestId('taak-filters')).toBeVisible()
    await expect(page.getByTestId('weergave')).toHaveCount(0)
    await page.getByTestId('filters-knop').click()
    await expect(page.locator('.taak-kaart input[type=checkbox]')).toHaveCount(0)
    await page.getByTestId('taak-nieuw').click()
    await expect(page.getByTestId('nieuwe-taak')).not.toContainText('Herhaling')
    // Beginner: klant, contactpersoon, titel, type en vervaldatum; geen prioriteit, aanleiding of herhalen.
    await expect(page.getByTestId('nt-contact')).toBeVisible()
    await expect(page.getByTestId('nt-type-bellen')).toBeVisible()
    await expect(page.getByTestId('nt-prio-urgent')).toHaveCount(0)
    await expect(page.getByTestId('nt-herhalen')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await ga(page, '/inzichten')
    await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
    // /planning staat sinds 0064 (de motor voor iedereen) ook voor een beginner aan.
    await ga(page, '/planning?tab=ritme')
    await expect(page.getByTestId('niet-aangezet-pagina')).toHaveCount(0)
  })
  test('Gevorderd: horizon als standaard met achterstallig bovenaan in Vandaag, rijen zonder vinkje of afrondknop, en het tabblad Hercontactritme', async ({ page }) => {
    await apiLogin(page.request, 'u-03')
    await page.request.post('/api/tasks', { data: { title: `Oud ${uniek()}`, actionType: 'taak', dueDate: new Date(Date.now() - 3 * 864e5).toISOString() } })
    await login(page, 'u-03')
    await ga(page, '/taken?weergave=horizon')
    await expect(page.getByTestId('horizon-vandaag').locator('.hz-item').first()).toContainText('Over tijd')
    await ga(page, '/taken')
    await expect(page.getByTestId('horizon-vandaag').locator('.hz-item').first()).toContainText('Over tijd')
    await ga(page, '/taken?weergave=lijst')
    await expect(page.locator('.taak-kaart').first()).toBeVisible()
    await expect(page.locator('.taak-kaart input[type=checkbox]')).toHaveCount(0)
    await expect(page.locator('.taak-kaart [data-test=vink]')).toHaveCount(0)
    await expect(page.getByTestId('bulkbalk')).toHaveCount(0)
    // Afronden gaat via het taakvenster.
    await page.locator('.taak-kaart').first().getByTestId('taak-titel').click()
    await expect(page.getByTestId('taak-flyout')).toBeVisible()
    await expect(page.getByTestId('afronden')).toBeVisible()
    await ga(page, '/planning?tab=ritme')
    await expect(page.getByTestId('ritme-Koud')).toContainText('dag 21')
    await expect(page.getByTestId('ritme-Koud')).toContainText('180 dagen')
  })
})

/** Een vers account met een beslisser en een tweede contact. */
async function metContacten(request: APIRequestContext, gebruiker: string) {
  await apiLogin(request, gebruiker)
  const accountNaam = naam()
  const { id: accountId } = await (await request.post('/api/accounts', { data: { naam: accountNaam } })).json()
  const beslisserAchternaam = `Testbeek ${uniek()}`
  const beslisser = await (await request.post('/api/contacten', { data: { accountId, voornaam: 'Petra', achternaam: beslisserAchternaam, rol: 'beslisser', functie: 'Directeur' } })).json()
  const tweede = await (await request.post('/api/contacten', { data: { accountId, voornaam: 'Bram', achternaam: `Proefveld ${uniek()}`, rol: 'beinvloeder', functie: 'Inkoper' } })).json()
  return { accountId, accountNaam, beslisser, beslisserAchternaam, tweede }
}

test.describe('nieuwe taak en taakvenster in de opzet van DealDrive', () => {
  test('klant en contactpersoon zoeken, prioriteit Urgent, type Bellen; de taak staat op de account- en contactkaart', async ({ page }) => {
    test.setTimeout(90_000)
    const x = await metContacten(page.request, 'u-03')
    await login(page, 'u-03')
    await ga(page, '/taken')
    await page.getByTestId('taak-nieuw').click()
    const venster = page.getByTestId('nieuwe-taak')
    await expect(venster.getByRole('heading', { name: 'Wat moet er gebeuren?' })).toBeVisible()
    await expect(page.getByTestId('nt-kicker')).toHaveText(/Nieuwe taak · Middel/i)
    await expect(page.getByTestId('nt-maak')).toBeDisabled()
    await expect(page.getByTestId('nt-maak')).toHaveText('✓ Maak taak')
    // Klant zoeken en kiezen; het contactveld toont daarna alleen de contacten van die klant, beslisser eerst.
    await page.getByTestId('nt-klant').fill(x.accountNaam.slice(0, 12))
    await page.getByTestId('nt-klant-optie').filter({ hasText: x.accountNaam }).click()
    await expect(page.getByTestId('nt-klant-keuze')).toContainText(x.accountNaam)
    await page.getByTestId('nt-contact').click()
    await expect(page.getByTestId('nt-contact-optie')).toHaveCount(2)
    await expect(page.getByTestId('nt-contact-optie').first()).toContainText('Petra')
    await page.getByTestId('nt-contact-optie').filter({ hasText: 'Petra' }).click()
    await expect(page.getByTestId('nt-contact-keuze')).toContainText('Directeur')
    const titel = `Bel Petra terug ${uniek()}`
    await page.getByTestId('nt-titel').fill(titel)
    await expect(page.getByTestId('nt-maak')).toBeEnabled()
    await page.getByTestId('nt-prio-urgent').click()
    await expect(page.getByTestId('nt-prio-urgent')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('nt-kicker')).toHaveText(/Nieuwe taak · Urgent/i)
    await page.getByTestId('nt-type-bellen').click()
    await expect(page.getByTestId('nt-type-bellen')).toHaveAttribute('aria-pressed', 'true')
    for (const t of ['taak', 'mailen', 'bericht', 'bezoek', 'linkedin']) await expect(page.getByTestId(`nt-type-${t}`)).toBeVisible()
    await page.getByTestId('nt-herhalen').check()
    await expect(page.getByTestId('nt-herhaal-telling')).toContainText('in totaal')
    await page.getByTestId('nt-herhalen').uncheck()
    await page.getByTestId('nt-maak').click()
    await expect(page.locator('.toast').last()).toContainText('Taak gemaakt.')
    const taak = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken).find((t: any) => t.title === titel)
    expect(taak).toMatchObject({ priority: 'urgent', actionType: 'bellen', account: { id: x.accountId }, contact: { id: x.beslisser.id } })
    // Filter op Urgent en de rij met de contactpersoon.
    await ga(page, '/taken?weergave=lijst&prioriteit=urgent')
    await expect(page.getByTestId(`taak-${taak.id}`)).toContainText('Urgent')
    await expect(page.getByTestId(`taak-${taak.id}`).getByTestId('taak-contact')).toHaveAttribute('href', `/contacten/${x.beslisser.id}`)
    // Het taakvenster toont klant en contact met links.
    await ga(page, `/taken?taak=${taak.id}`)
    await expect(page.getByTestId('tf-kicker')).toHaveText(/Urgent · Open/i)
    await expect(page.getByTestId('tf-account')).toHaveAttribute('href', `/accounts/${x.accountId}`)
    await expect(page.getByTestId('tf-contact')).toHaveAttribute('href', `/contacten/${x.beslisser.id}`)
    await expect(page.getByTestId('tf-volgende-stap')).toContainText('Pak deze nu op')
    // Op de contactkaart en de accountkaart.
    await ga(page, `/contacten/${x.beslisser.id}?tab=taken`)
    await expect(page.getByTestId(`ak-taak-${taak.id}`)).toBeVisible()
    await ga(page, `/contacten/${x.tweede.id}?tab=taken`)
    await expect(page.getByTestId(`ak-taak-${taak.id}`)).toHaveCount(0)
    await ga(page, `/accounts/${x.accountId}?tab=taken`)
    await expect(page.getByTestId(`ak-taak-${taak.id}`)).toBeVisible()
  })

  test('taakvenster bewerken: ander contact en prioriteit Hoog; behoudt uitkomst, uitstellen en afronden', async ({ page }) => {
    test.setTimeout(60_000)
    const x = await metContacten(page.request, 'u-03')
    const t = await (await page.request.post('/api/tasks', { data: { title: `Bel ${uniek()}`, actionType: 'bellen', accountId: x.accountId, contactId: x.beslisser.id, priority: 'middel' } })).json()
    await login(page, 'u-03')
    await ga(page, `/taken?taak=${t.id}`)
    await expect(page.getByTestId('tf-gegevens')).toContainText('Bellen')
    await expect(page.getByTestId('uitkomst')).toBeVisible()
    await expect(page.getByTestId('uitstellen')).toBeVisible()
    await expect(page.getByTestId('afronden')).toBeDisabled()
    await page.getByTestId('tf-bewerk').click()
    await expect(page.getByTestId('tf-contact-keuze')).toContainText('Petra')
    await page.getByTestId('tf-bewerken').getByRole('button', { name: 'Wis gekozen contactpersoon' }).click()
    await page.getByTestId('tf-contact').click()
    await page.getByTestId('tf-contact-optie').filter({ hasText: 'Bram' }).click()
    await page.getByTestId('tf-prio-hoog').click()
    await page.getByTestId('tf-opslaan').click()
    await expect(page.locator('.toast').last()).toContainText('Taak bijgewerkt.')
    await expect(page.getByTestId('tf-kicker')).toHaveText(/Hoog · Open/i)
    await expect(page.getByTestId('tf-contact')).toHaveAttribute('href', `/contacten/${x.tweede.id}`)
    const na = await (await page.request.get(`/api/tasks/${t.id}`)).json()
    expect(na).toMatchObject({ priority: 'hoog', contactId: x.tweede.id })
  })

  test('API: een contact zonder klant neemt de klant mee, een contact van een ander account geeft 422, urgent mag bij bewerken', async ({ request }) => {
    const x = await metContacten(request, 'u-03')
    const ander = await metContacten(request, 'u-03')
    const t = await (await request.post('/api/tasks', { data: { title: `Mail ${uniek()}`, actionType: 'mailen', contactId: x.tweede.id } })).json()
    expect(t).toMatchObject({ accountId: x.accountId, contactId: x.tweede.id })
    expect((await request.post('/api/tasks', { data: { title: `Fout ${uniek()}`, accountId: x.accountId, contactId: ander.beslisser.id } })).status()).toBe(422)
    expect((await request.put(`/api/tasks/${t.id}`, { data: { contactId: ander.beslisser.id } })).status()).toBe(422)
    expect((await (await request.put(`/api/tasks/${t.id}`, { data: { priority: 'urgent' } })).json()).priority).toBe('urgent')
    const kies = await (await request.get(`/api/contacten/kies?accountId=${x.accountId}`)).json()
    expect(kies.map((c: any) => c.id)).toEqual([x.beslisser.id, x.tweede.id])
  })

  test('de motor geeft de beslisser als contact mee aan poging 1', async ({ request }) => {
    const x = await metContacten(request, 'u-03')
    await request.post('/api/reis/gebeurtenis', { data: { accountId: x.accountId, gebeurtenis: 'gekwalificeerd' } })
    const taak = (await (await request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken).find((t: any) => t.account?.id === x.accountId && t.poging?.n === 1)
    expect(taak?.contact?.id).toBe(x.beslisser.id)
  })
})

test.describe('Taken: portie per groep, titel en kop (B09, B14, B17)', () => {
  test('met per krijgt elke groep een portie en het totaal; toon vraagt per groep meer; titel = statkaart Vandaag', async ({ request }) => {
    await apiLogin(request, 'u-07')
    const alles = await (await request.get('/api/tasks')).json()
    const groot = alles.groepen.find((g: any) => g.taken.length > 3)
    expect(groot, 'een groep met meer dan drie taken').toBeTruthy()
    const deel = await (await request.get('/api/tasks?per=2')).json()
    const g = deel.groepen.find((x: any) => x.naam === groot.naam)
    expect(g.taken).toHaveLength(2)
    expect(g.totaal).toBe(groot.taken.length)
    const meer = await (await request.get(`/api/tasks?per=2&toon=${encodeURIComponent(`${groot.naam}:3`)}`)).json()
    expect(meer.groepen.find((x: any) => x.naam === groot.naam).taken).toHaveLength(3)
    // Zonder per alles (API en andere schermen), en de horizon alleen bij weergave=horizon.
    expect(alles.horizon).toBeNull()
    // Eén definitie: het getal in de titel is de statkaart Vandaag.
    if (alles.tellers.vandaag) expect(alles.titel).toBe(`${alles.tellers.vandaag} ${alles.tellers.vandaag === 1 ? 'taak' : 'taken'} vandaag.`)
  })

  test('/taken: standaard paginakop met zoeken, AI en hulp; Toon meer haalt de volgende portie op', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/taken?weergave=lijst')
    const knoppen = page.getByTestId('kop-knoppen')
    await expect(knoppen.getByTestId('kop-zoeken')).toBeVisible()
    await expect(knoppen.getByTestId('hulp-knop')).toBeVisible()
    await expect(knoppen.locator('button', { hasText: /^Hulp$/ })).toHaveCount(0)
    const statVandaag = await page.getByTestId('stat-vandaag').locator('.stat-num').textContent()
    if (Number(statVandaag)) await expect(page.getByTestId('acties-titel')).toHaveText(new RegExp(`^${statVandaag} (taak|taken) vandaag\\.$`))
    const meer = page.locator('[data-test^="toon-meer-"]').first()
    if (await meer.count()) {
      const groep = page.locator('.taak-groep').filter({ has: meer })
      const voor = await groep.locator('.taak-kaart').count()
      await meer.click()
      await expect.poll(() => groep.locator('.taak-kaart').count()).toBeGreaterThan(voor)
    }
  })
})

test.describe('Taken: nieuwe URL, horizon in het filter en Briefings', () => {
  test('/acties stuurt door naar /taken met de query; ?tab=inzichten gaat naar /inzichten; geen tabblad Inzichten', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/acties?prioriteit=urgent')
    await expect(page).toHaveURL(/\/taken\?prioriteit=urgent$/)
    await expect(page.locator('.kicker').first()).toHaveText('Taken')
    await expect(page.getByTestId('tab-inzichten')).toHaveCount(0)
    await ga(page, '/acties?tab=inzichten&gelezen=alle')
    await expect(page).toHaveURL(/\/inzichten\?gelezen=alle$/)
    // Het menu en de links wijzen naar /taken.
    await ga(page, '/')
    await expect(page.locator('a[href="/acties"]')).toHaveCount(0)
    await expect(page.locator('a[href="/taken"]').first()).toBeVisible()
  })

  test('horizon is de standaard; Lijst is een keuze onder Filters, Weergave; de kop heeft Filters zonder teller en geen Briefings', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/taken')
    await expect(page.getByTestId('horizon-vandaag')).toBeVisible()
    await expect(page.getByTestId('weergave')).toHaveCount(0)
    await expect(page.getByTestId('briefings-knop')).toHaveCount(0)
    await expect(page.getByTestId('filters-knop')).toHaveText('Filters')
    await page.getByTestId('filters-knop').click()
    await expect(page.getByTestId('weergave-horizon')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('weergave-lijst').click()
    await expect(page).toHaveURL(/weergave=lijst/)
    await expect(page.getByTestId('horizon-vandaag')).toHaveCount(0)
    await expect(page.getByTestId('filters-teller')).toHaveCount(0)
    // Met een keuze in de URL staat het paneel open; Horizon haalt de keuze weer weg.
    await ga(page, '/taken?weergave=lijst')
    await expect(page.getByTestId('weergave-lijst')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('weergave-horizon').click()
    await expect(page).not.toHaveURL(/weergave=/)
    await expect(page.getByTestId('horizon-vandaag')).toBeVisible()
    // Een oude link met weergave=horizon werkt nog.
    await ga(page, '/taken?weergave=horizon')
    await expect(page.getByTestId('horizon-vandaag')).toBeVisible()
  })

  test('filtergroep Periode: Morgen en een eigen periode in het verleden met afgeronde taken; geen Herkomst', async ({ page }) => {
    test.setTimeout(150_000)
    await apiLogin(page.request, 'u-03')
    const dag = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
    const morgen = await (await page.request.post('/api/tasks', { data: { title: `Morgen ${uniek()}`, actionType: 'taak', dueDate: `${dag(1)}T10:00:00.000Z` } })).json()
    const oud = await (await page.request.post('/api/tasks', { data: { title: `Terugkijken ${uniek()}`, actionType: 'taak', dueDate: `${dag(-20)}T10:00:00.000Z` } })).json()
    expect((await page.request.post(`/api/tasks/${oud.id}/afronden`, { data: { uitkomst: 'gedaan', idempotentieSleutel: uniek() } })).ok()).toBe(true)
    // API: zonder eigen periode geen afgeronde taken, met eigen periode wel (en niet als achterstallig).
    const zonder = (await (await page.request.get('/api/tasks')).json()).groepen.flatMap((g: any) => g.taken)
    expect(zonder.some((t: any) => t.id === oud.id)).toBe(false)
    const met = await (await page.request.get(`/api/tasks?van=${dag(-25)}&tot=${dag(-15)}`)).json()
    expect(met.periode).toMatchObject({ van: dag(-25), tot: dag(-15), eigen: true })
    const afgerond = met.groepen.find((g: any) => g.naam === 'Afgerond')
    expect(afgerond.taken.map((t: any) => t.id)).toContain(oud.id)
    expect(met.groepen.flatMap((g: any) => g.taken).every((t: any) => t.dag >= dag(-25) && t.dag <= dag(-15))).toBe(true)
    const viaMorgen = (await (await page.request.get('/api/tasks?periode=morgen')).json()).groepen.flatMap((g: any) => g.taken)
    expect(viaMorgen.map((t: any) => t.id)).toContain(morgen.id)
    expect(viaMorgen.every((t: any) => t.dag === dag(1))).toBe(true)

    await login(page, 'u-03')
    // Met een keuze in de URL staat het filterpaneel al open.
    await ga(page, '/taken?weergave=lijst')
    const paneel = page.getByTestId('taak-filters')
    await expect(paneel.getByRole('combobox', { name: 'Herkomst' })).toHaveCount(0)
    await page.getByTestId('periode-morgen').click()
    await expect(page).toHaveURL(/periode=morgen/)
    await expect(page.getByTestId('periode-morgen')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId(`taak-${morgen.id}`)).toBeVisible()
    // Eigen periode in het verleden: de vaste keuze gaat uit, de afgeronde taak staat erbij als lijst.
    await page.getByTestId('periode-van').fill(dag(-25))
    await page.getByTestId('periode-van').dispatchEvent('change')
    await expect(page).toHaveURL(new RegExp(`van=${dag(-25)}`))
    await expect(page).not.toHaveURL(/periode=/)
    await page.getByTestId('periode-tot').fill(dag(-15))
    await page.getByTestId('periode-tot').dispatchEvent('change')
    await expect(page).toHaveURL(new RegExp(`tot=${dag(-15)}`))
    await expect(page.getByTestId('periode-uitleg')).toContainText('ook afgerond en verlopen')
    await expect(page.getByTestId(`taak-${oud.id}`).getByTestId('taak-afgerond')).toHaveText('Afgerond')
    await expect(page.getByTestId('groep-Afgerond')).toBeVisible()
    // Ook zonder weergave=lijst is een eigen periode een lijst.
    await ga(page, `/taken?van=${dag(-25)}&tot=${dag(-15)}`)
    await expect(page.getByTestId('horizon')).toHaveCount(0)
    await expect(page.getByTestId(`taak-${oud.id}`)).toBeVisible()
  })

  test('Briefings in het menu onder Taken opent /briefings; daar zoek je een prospect of een contactpersoon in één veld', async ({ page }) => {
    test.setTimeout(60_000)
    const x = await metContacten(page.request, 'u-03')
    await login(page, 'u-03')
    await ga(page, '/taken')
    await page.locator('.sb-link[data-sleutel="briefing.bewerken"]').click()
    await expect(page).toHaveURL(/\/briefings$/)
    await expect(page.getByTestId('briefing-zoeken')).toBeVisible()
    // Het overzicht van komende gesprekken blijft.
    await expect(page.getByTestId('briefings').or(page.getByText('Geen briefings in dit filter.'))).toBeVisible()
    // Zes treffers in beeld, de rest scrolt (ZoekKiezer).
    await page.getByTestId('bf-zoek').fill('te')
    await expect(page.getByTestId('bf-zoek-optie').first()).toBeVisible()
    const lijstHoogte = await page.getByTestId('zoekkiezer-lijst').evaluate((e) => e.clientHeight)
    const rijHoogte = await page.getByTestId('bf-zoek-optie').first().evaluate((e) => e.getBoundingClientRect().height)
    expect(Math.round(lijstHoogte / rijHoogte)).toBeLessThanOrEqual(6)
    // Een prospect kiezen: zijn briefing opent in de flyout, de keuze staat in de link.
    await page.getByTestId('bf-zoek').fill(x.accountNaam.slice(0, 12))
    await page.getByTestId('bf-zoek-optie').filter({ hasText: x.accountNaam }).first().click()
    await expect(page).toHaveURL(new RegExp(`account=${x.accountId}`))
    const gekozen = page.getByTestId('briefing-gekozen')
    await expect(gekozen.getByTestId('briefing')).toBeVisible()
    await expect(gekozen.getByTestId('briefing-contact')).toHaveCount(0)
    await expect(gekozen.getByTestId('briefing-open-account')).toHaveAttribute('href', `/accounts/${x.accountId}`)
    await gekozen.getByRole('button', { name: 'Sluiten' }).click()
    await expect(page).not.toHaveURL(/account=/)
    // In hetzelfde veld een contactpersoon zoeken: dan staan zijn gegevens bij de briefing van zijn account.
    await page.getByTestId('bf-zoek').fill(`Petra ${x.beslisserAchternaam}`)
    await page.getByTestId('bf-zoek-optie').filter({ hasText: x.accountNaam }).first().click()
    await expect(page).toHaveURL(new RegExp(`account=${x.accountId}`))
    await expect(page).toHaveURL(new RegExp(`contact=${x.beslisser.id}`))
    await expect(gekozen.getByTestId('briefing-contact')).toContainText('Petra')
    await expect(gekozen.getByTestId('briefing-contact')).toContainText('Directeur')
    await expect(gekozen.getByTestId('briefing-contact-naam')).toHaveAttribute('href', `/contacten/${x.beslisser.id}`)
    // Herladen houdt de keuze.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('briefing-contact')).toContainText('Petra')
    await expect(page.locator('#bfd-titel')).toContainText(x.accountNaam)
    // Contact wissen: weer de briefing van het account.
    await page.getByTestId('briefing-wis-contact').click()
    await expect(page).not.toHaveURL(/contact=/)
    await expect(page.getByTestId('briefing-contact')).toHaveCount(0)
    await expect(page.getByTestId('briefing-gekozen')).toBeVisible()
  })

  test('API: een contact van een ander account geeft 404; zonder contact de account-briefing', async ({ request }) => {
    const a = await metContacten(request, 'u-03')
    const b = await metContacten(request, 'u-03')
    const goed = await request.get('/api/briefing', { params: { account: a.accountId, contact: a.tweede.id } })
    expect(goed.status()).toBe(200)
    expect((await goed.json()).contact).toMatchObject({ id: a.tweede.id, functie: 'Inkoper', rol: 'beinvloeder' })
    expect((await request.get('/api/briefing', { params: { account: a.accountId, contact: b.beslisser.id } })).status()).toBe(404)
    expect((await (await request.get('/api/briefing', { params: { account: a.accountId } })).json()).contact).toBeNull()
  })
})
