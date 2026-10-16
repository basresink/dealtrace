// P07: Vandaag, Acties (taken en inzichten), één afrondpad en het hercontactritme.
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
    await expect(page.getByTestId('werkblok')).toContainText('BEZOEKDAG')
  })

  test('binnendienst ziet het belblokvak; salesmanager ziet Team vandaag; Beginner geen agents-blok', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/')
    await expect(page.getByTestId('werkblok')).toContainText('BELBLOK')
    await expect(page.getByTestId('agents')).toBeVisible()
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
    await ga(page, `/acties?taak=${a.taakId}`)
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
    await ga(page, '/acties?tab=inzichten&gelezen=alle')
    const kaart = page.locator('.inzicht-kaart[data-test^=inzicht-]').first()
    await expect(kaart).toBeVisible()
    const id = (await kaart.getAttribute('data-test'))!.replace('inzicht-', '')
    expect((await page.request.post(`/api/signals/${id}/afwijzen`, { data: {} })).status()).toBe(422)
    await kaart.getByRole('button', { name: '+ Maak taak' }).click()
    await expect(page.locator('.toast').last()).toContainText('Taak gemaakt uit het inzicht')
    const taken = (await (await page.request.get('/api/tasks?eigenaar=mij')).json()).groepen.flatMap((g: any) => g.taken)
    expect(taken.some((t: any) => t.herkomst === 'inzicht')).toBe(true)
    await ga(page, '/acties?herkomst=inzicht')
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
    // Kopbalk met accountnaam en soort, scoretegel, AI-context en de voet.
    const eerste = kaarten.first()
    await expect(eerste.locator('.ik-balk')).toBeVisible()
    await expect(eerste.locator('.ik-score')).toHaveText(/^\d+$/)
    await expect(eerste.locator('.ik-tag')).toHaveText(/^(Intern|Extern|Agenda)$/)
    await expect(eerste.getByRole('button', { name: '+ Maak taak' })).toBeVisible()
    // Drie per rij op een breed scherm.
    if ((await kaarten.count()) >= 3) {
      const y = await Promise.all([0, 1, 2].map(async (n) => (await kaarten.nth(n).boundingBox())!.y))
      expect(new Set(y.map(Math.round)).size).toBe(1)
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
    // Een link met ?inzicht= opent dat inzicht, ook als het gelezen is; dezelfde feed staat bij Acties.
    await ga(page, `/acties?tab=inzichten&inzicht=${id.replace('inzicht-', '')}`)
    await expect(page.getByTestId('inzicht-flyout')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  })
})

test.describe('niveaus', () => {
  test('Beginner: lijst zonder horizon of bulk, minimale velden, /inzichten en /planning nog niet aangezet', async ({ page }) => {
    await login(page, 'u-02')
    await ga(page, '/acties')
    await expect(page.getByTestId('weergave')).toHaveCount(0)
    await expect(page.locator('.taak-kaart input[type=checkbox]')).toHaveCount(0)
    await page.getByTestId('taak-nieuw').click()
    await expect(page.getByTestId('nieuwe-taak')).not.toContainText('Herhaling')
    await page.keyboard.press('Escape')
    await ga(page, '/inzichten')
    await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
    await ga(page, '/planning?tab=ritme')
    await expect(page.getByTestId('niet-aangezet-pagina')).toBeVisible()
  })
  test('Gevorderd: horizon met achterstallig bovenaan in Vandaag, bulk uitstellen, en het tabblad Hercontactritme', async ({ page }) => {
    await apiLogin(page.request, 'u-03')
    await page.request.post('/api/tasks', { data: { title: `Oud ${uniek()}`, actionType: 'taak', dueDate: new Date(Date.now() - 3 * 864e5).toISOString() } })
    await login(page, 'u-03')
    await ga(page, '/acties?weergave=horizon')
    await expect(page.getByTestId('horizon-vandaag').locator('.hz-item').first()).toContainText('Over tijd')
    await ga(page, '/acties')
    await page.locator('.taak-kaart input[type=checkbox]').first().check()
    await page.getByTestId('bulk-week').click()
    await expect(page.locator('.toast').last()).toContainText('1 taak bijgewerkt')
    await ga(page, '/planning?tab=ritme')
    await expect(page.getByTestId('ritme-Koud')).toContainText('dag 21')
    await expect(page.getByTestId('ritme-Koud')).toContainText('180 dagen')
  })
})
