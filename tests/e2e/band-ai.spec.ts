// Kwalificatie: BAND zelf invullen of "Vul in met AI" (soort bandInvulling, mock-provider). De AI leest de
// gespreksverslagen van de prospect en doet per onderdeel een voorstel met citaat en bron; de gebruiker bevestigt,
// bewerkt of verwerpt per onderdeel. Zonder verslagen staat de knop uit. Zoeken via Datacollectief staat hier niet meer.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ timeout: 180_000 })

for (const breedte of [1280, 390]) {
  test(`${breedte}: BAND met AI-voorstel per onderdeel bevestigen, bewerken en verwerpen`, async ({ page }) => {
    await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
    await login(page, 'u-07')
    const a = await (await page.request.post('/api/accounts', { data: { naam: `${crypto.randomUUID().slice(0, 10)} Bandai` } })).json()

    // Zonder verslagen: de knop staat uit met uitleg, de prijs staat op de knop.
    await ga(page, `/accounts/${a.id}?meer=kwalificatie`)
    const kw = page.getByTestId('kwalificatie-flyout')
    const knop = kw.getByTestId('band-ai-knop')
    await expect(knop).toBeDisabled()
    await expect(kw.getByTestId('band-ai-uit')).toHaveText('Nog geen gespreksverslagen')
    await expect(kw.getByTestId('band-ai-prijs')).toHaveText(/^\d+ credits?$/)
    // Buying committee zonder Datacollectief-zoekactie.
    await expect(kw.getByTestId('buying-committee')).toBeVisible()
    for (const id of ['dc-zoek', 'dc-zoek-blok']) await expect(kw.getByTestId(id)).toHaveCount(0)

    // Een belverslag (zonder analyse van de Notulist): nu kan de AI het lezen.
    const taak = await (await page.request.post('/api/tasks', { data: { title: 'Bel over de levering', actionType: 'bellen', accountId: a.id } })).json()
    await page.request.put(`/api/tasks/${taak.id}/verslag`, { data: { tekst: 'De directeur beslist zelf over de keuze. Ze hebben budget vrijgemaakt. Ze willen starten voor de zomer.' } })
    await ga(page, `/accounts/${a.id}?meer=kwalificatie`)
    await expect(knop).toBeEnabled()
    if (breedte === 390) expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await knop.click()

    const blok = kw.getByTestId('band-voorstellen')
    await expect(blok).toBeVisible({ timeout: 30_000 })
    const draagvlak = blok.getByTestId('band-voorstel-draagvlak')
    await expect(draagvlak.getByTestId('band-voorstel-ai')).toBeVisible()
    await expect(draagvlak).toContainText('budget vrijgemaakt')
    await expect(draagvlak.getByTestId('band-voorstel-bron')).toContainText(/Gebaseerd op Belverslag \d{1,2} \w+ \d{4} · Bel over de levering/)
    // Niets is vanzelf ingevuld.
    for (const l of ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak']) await expect(kw.getByTestId(`band-${l}`)).not.toBeChecked()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // Bevestigen per onderdeel.
    await draagvlak.getByTestId('band-voorstel-bevestig').click()
    await expect(kw.getByTestId('band-draagvlak')).toBeChecked()
    await expect(kw.getByTestId('band-herkomst-draagvlak')).toContainText('Gebaseerd op Belverslag')
    await expect(blok.getByTestId('band-voorstel-draagvlak')).toHaveCount(0)
    // Verwerpen: weg, en de letter blijft leeg.
    await blok.getByTestId('band-voorstel-autoriteit').getByTestId('band-voorstel-verwerp').click()
    await expect(blok.getByTestId('band-voorstel-autoriteit')).toHaveCount(0)
    await expect(kw.getByTestId('band-autoriteit')).not.toBeChecked()
    // Aanpassen: nee met een eigen toelichting.
    const noodzaak = blok.getByTestId('band-voorstel-noodzaak')
    await noodzaak.getByTestId('band-voorstel-bewerk-knop').click()
    await noodzaak.getByTestId('band-voorstel-nee').check()
    await noodzaak.getByTestId('band-voorstel-toelichting').fill('Starten pas na de zomer')
    await noodzaak.getByTestId('band-voorstel-bewaar').click()
    await expect(kw.getByTestId('band-herkomst-noodzaak')).toContainText('Starten pas na de zomer')
    await expect(kw.getByTestId('band-noodzaak')).not.toBeChecked()

    const kaart = await (await page.request.get(`/api/accounts/${a.id}`)).json()
    expect(kaart.band.draagvlak).toMatchObject({ ja: true, herkomst: { soort: 'taak', id: taak.id, ai: true } })
    expect(kaart.band.noodzaak).toMatchObject({ ja: false, toelichting: 'Starten pas na de zomer' })
    expect(kaart.band.autoriteit).toBeUndefined()
    // Behoefte wacht nog op een besluit; zelf aanvinken blijft kan.
    const stand = await (await page.request.get(`/api/accounts/${a.id}/band-voorstel`)).json()
    expect(stand.voorstellen.map((v: any) => v.letter)).toEqual(['behoefte'])
    expect(stand.ai.verslagen).toBeGreaterThanOrEqual(1)
  })
}

test('API: zonder verslagen 422, alle onderdelen ingevuld 409', async ({ page }) => {
  await login(page, 'u-07')
  const a = await (await page.request.post('/api/accounts', { data: { naam: `${crypto.randomUUID().slice(0, 10)} Bandapi` } })).json()
  expect((await page.request.post(`/api/accounts/${a.id}/band-ai`)).status()).toBe(422)
  for (const letter of ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak']) await page.request.put(`/api/accounts/${a.id}/band`, { data: { letter, ja: true } })
  expect((await page.request.post(`/api/accounts/${a.id}/band-ai`)).status()).toBe(409)
})

// Voorbij status nieuw: BAND blijft in te vullen en bij te werken door de eigenaar, ook via "Vul in met AI". Een
// bevestigd voorstel verandert de status niet en schrijft geen gebeurtenis in de reis; Kwalificeer staat er niet meer.
test('voorbij status nieuw: AI-voorstel bevestigen zonder statuswissel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page, 'u-07')
  const a = await (await page.request.post('/api/accounts', { data: { naam: `${crypto.randomUUID().slice(0, 10)} Bandreis` } })).json()
  const instap = await page.request.post('/api/reis/gebeurtenis', { data: { accountId: a.id, gebeurtenis: 'gekwalificeerd' } })
  expect(instap.ok()).toBe(true)
  const taak = await (await page.request.post('/api/tasks', { data: { title: 'Bel na de kwalificatie', actionType: 'bellen', accountId: a.id } })).json()
  await page.request.put(`/api/tasks/${taak.id}/verslag`, { data: { tekst: 'De directeur beslist zelf over de keuze. Ze hebben budget vrijgemaakt. Ze willen starten voor de zomer.' } })
  const voor = await (await page.request.get(`/api/accounts/${a.id}`)).json()
  expect(voor.status).not.toBe('nieuw')
  expect(voor.kan).toMatchObject({ band: true, kwalificeer: false })
  const geschiedenisVoor = (await (await page.request.get(`/api/accounts/${a.id}/reisgeschiedenis`)).json()).regels.length
  await ga(page, `/accounts/${a.id}?meer=kwalificatie`)
  const kw = page.getByTestId('kwalificatie-flyout')
  const knop = kw.getByTestId('band-ai-knop')
  await expect(knop).toBeVisible()
  await expect(knop).toBeEnabled()
  await expect(kw.getByTestId('kwalificeer')).toHaveCount(0)
  await knop.click()
  const draagvlak = kw.getByTestId('band-voorstellen').getByTestId('band-voorstel-draagvlak')
  await expect(draagvlak).toBeVisible({ timeout: 30_000 })
  await draagvlak.getByTestId('band-voorstel-bevestig').click()
  await expect(kw.getByTestId('band-draagvlak')).toBeChecked()
  // Zelf aanvinken kan ook: nu 3 van 4, en toch geen statuswissel.
  await kw.getByTestId('band-behoefte').check()
  await kw.getByTestId('band-autoriteit').check()
  await expect(kw.getByText('Kwalificatie BAND 3/4')).toBeVisible()

  const na = await (await page.request.get(`/api/accounts/${a.id}`)).json()
  expect(na.status).toBe(voor.status)
  expect(na.reis?.fase?.id).toBe(voor.reis?.fase?.id)
  expect(na.band.draagvlak).toMatchObject({ ja: true, herkomst: { id: taak.id, ai: true } })
  expect((await (await page.request.get(`/api/accounts/${a.id}/reisgeschiedenis`)).json()).regels.length).toBe(geschiedenisVoor)

  // Een collega die niet de eigenaar is, werkt BAND niet bij (server-side).
  await apiLogin(page.request, 'u-02')
  const kaart = await (await page.request.get(`/api/accounts/${a.id}`)).json()
  expect(kaart.kan?.band ?? false).toBe(false)
  expect((await page.request.put(`/api/accounts/${a.id}/band`, { data: { letter: 'noodzaak', ja: true } })).status()).toBe(403)
  expect((await page.request.post(`/api/accounts/${a.id}/band-ai`)).status()).toBe(403)
  expect((await page.request.post(`/api/accounts/${a.id}/band-voorstel`, { data: { letter: 'noodzaak', besluit: 'bevestig' } })).status()).toBe(403)
})
