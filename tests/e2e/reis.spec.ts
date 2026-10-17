// P05: reis, fase en status op de kaart, per niveau en rol; Zet nee, Fase corrigeren,
// reisgeschiedenis, doelgroep met teller, accenten en Standaard terugzetten.
import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

/** Een vers account (fase Gevonden, status nieuw) voor deze gebruiker. */
async function nieuwAccount(request: APIRequestContext, gebruiker: string): Promise<string> {
  await apiLogin(request, gebruiker)
  const r = await request.post('/api/accounts', { data: { naam: `Testreis ${gebruiker} ${Date.now()}${Math.floor(Math.random() * 1000)}` } })
  expect(r.ok()).toBeTruthy()
  return (await r.json()).id
}

test.describe('prospectreis', () => {
  test('Beginner: fasepil, status en Zet nee met bevestiging; geen Prospectreizen en geen Fase corrigeren', async ({ page }) => {
    const id = await nieuwAccount(page.request, 'u-02')
    await login(page, 'u-02')
    await expect(page.locator('.sb-groep:not(.sb-slotgroep) [href="/reizen"]')).toHaveCount(0)
    // Kwalificeren in het venster Kwalificatie onder Meer (?meer= opent het direct).
    await ga(page, `/accounts/${id}?meer=kwalificatie`)
    await expect(page.getByTestId('fasepil')).toHaveText('Gevonden')
    await expect(page.getByTestId('statuspil')).toHaveText('Nieuw')
    await expect(page.getByTestId('fase-corrigeren-knop')).toHaveCount(0)
    await page.getByTestId('kwalificeer').click()
    await expect(page.getByTestId('fasepil')).toHaveText('Gekwalificeerd')
    await expect(page.getByTestId('statuspil')).toHaveText('In reis')
    await page.getByTestId('kwalificatie-flyout-sluit').click()
    // Zet nee staat in het venster Reis (het venster Ritme is weg).
    await page.getByTestId('kop-meer').click()
    await page.getByTestId('meer-reis').click()
    await page.getByTestId('zet-nee-knop').click()
    await expect(page.getByTestId('zet-op-nee')).toBeDisabled()
    await page.locator('.nee-reden', { hasText: 'Anders' }).click()
    await expect(page.getByTestId('zet-op-nee')).toBeDisabled()
    await page.locator('.nee-reden', { hasText: 'Verkeerd moment' }).click()
    await expect(page.getByTestId('nee-terug-op')).not.toHaveValue('')
    await page.getByTestId('zet-op-nee').click()
    await expect(page.locator('.toast').last()).toContainText(/staat op nee tot \d+ \w+ 20\d\d/)
    await expect(page.getByTestId('statuspil')).toHaveText('Nee')
    await expect(page.getByTestId('terug-op')).toContainText('Beslissing uitgesteld')
  })

  test('Gevorderd: Fase corrigeren met reden staat in de reisgeschiedenis; reis alleen lezen', async ({ page }) => {
    const id = await nieuwAccount(page.request, 'u-03')
    await login(page, 'u-03')
    await expect(page.locator('.sb-groep:not(.sb-slotgroep) [href="/reizen"]')).toHaveCount(0)
    await ga(page, `/accounts/${id}?meer=ritme`)
    await page.getByTestId('fase-corrigeren-knop').click()
    await page.getByTestId('fase-keuze').selectOption({ label: 'Benaderd' })
    await expect(page.getByTestId('reis-bewaar')).toBeDisabled()
    await page.getByTestId('reis-reden').fill('Gesprek was via de beurs, niet gelogd')
    await page.getByTestId('reis-bewaar').click()
    await expect(page.getByTestId('fasepil')).toHaveText('Benaderd')
    await expect(page.getByTestId('statuspil')).toHaveText('In reis')
    await page.getByTestId('fasepil').click()
    await expect(page.getByTestId('reisgeschiedenis')).toContainText('Gesprek was via de beurs, niet gelogd')
    await expect(page.getByTestId('reisgeschiedenis')).toContainText('Gevonden → Benaderd')
    await page.locator('.fo-sluit').first().click()
    await page.getByTestId('reis-link').click()
    await expect(page.getByRole('heading', { name: 'Standaardreis' })).toBeVisible()
    await expect(page.getByTestId('standaard-terug')).toHaveCount(0)
    await expect(page.locator('[data-test^=accent-]')).toHaveCount(0)
  })

  test('Expert-accountmanager ziet Prospectreizen; salesmanager maakt een doelgroep met teller en stelt een accent bij', async ({ page }) => {
    await login(page, 'u-07')
    // Prospectreizen staat onder het uitklapmenu Planning.
    await page.getByTestId('sb-planning').click()
    await expect(page.locator('.sb-groep:not(.sb-slotgroep) [href="/reizen"]')).toHaveCount(1)
    await ga(page, '/reizen')
    await expect(page.getByTestId('doelgroep-nieuw')).toHaveCount(0)
    await login(page, 'u-04')
    await ga(page, '/reizen')
    await page.getByTestId('doelgroep-nieuw').click()
    await page.getByTestId('dg-naam').fill(`Installatiebedrijven woningbouw ${Date.now() % 10000}`)
    await page.getByTestId('dg-branche-br-01').check()
    await expect(page.getByTestId('doelgroep-teller')).toContainText(/\d+ accounts vallen in deze doelgroep, waarvan \d+ al in een andere reis/)
    await page.getByTestId('dg-bewaar').click()
    await expect(page.getByTestId('doelgroepen')).toContainText('Installatiebedrijven woningbouw')
    await page.getByTestId('reis-standaard').click()
    const accent = page.getByTestId('accent-gekwalificeerd')
    await accent.fill(`Kennismaken met één vraag over het lopende project (${Date.now() % 10000}).`)
    await page.getByTestId('accenten-bewaar').click()
    await expect(page.locator('.toast').last()).toContainText('Accenten bewaard')
    await expect(page.getByTestId('standaard-terug')).toBeVisible()
  })

  test('Beheerder: Standaard terugzetten zet het accent terug', async ({ page }) => {
    await login(page, 'u-06')
    await ga(page, '/reizen')
    await page.getByTestId('reis-standaard').click()
    await page.getByTestId('accent-gevonden').fill(`Tijdelijk accent ${Date.now() % 10000}`)
    await page.getByTestId('accenten-bewaar').click()
    await expect(page.locator('.toast').last()).toContainText('Accenten bewaard')
    await page.getByTestId('standaard-terug').click()
    await expect(page.locator('.venster, [role=alertdialog], [role=dialog]').last()).toContainText('Jullie aangepaste accenten gaan verloren.')
    await page.getByRole('button', { name: 'Terugzetten', exact: true }).click()
    await expect(page.getByTestId('accent-gevonden')).toHaveValue('Alleen feiten uit het dossier; geen aannames over behoefte.')
  })

  test('lijst: filter Reis en fase met tellers (Gevorderd)', async ({ page }) => {
    await login(page, 'u-03')
    await ga(page, '/prospects/alle?eigenaar=iedereen')
    await page.getByTestId('filters-knop').click()
    const pil = page.getByTestId('filter-fase-verloren')
    const teller = Number(await pil.locator('.pil-teller').textContent())
    expect(teller).toBeGreaterThan(0)
    await pil.click()
    await expect(page).toHaveURL(/fase=verloren/)
    await expect(page.getByTestId('aantal')).toHaveText(`${teller} ${teller === 1 ? 'resultaat' : 'resultaten'}`)
  })
})

test.describe('meldpunt via de API', () => {
  test('rechtstreeks fase zetten wordt geweigerd; handmatig zonder reden 422; tweede eerste afspraak verandert niets', async ({ request }) => {
    const id = await nieuwAccount(request, 'u-03')
    expect((await request.put(`/api/accounts/${id}`, { data: { faseId: 'benaderd' } })).status()).toBe(400)
    expect((await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'handmatig', faseId: 'benaderd' } })).status()).toBe(422)
    expect((await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'bestaat-niet' } })).status()).toBe(422)
    await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'gekwalificeerd' } })
    const eerste = await (await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'eerste-afspraak-gepland' } })).json()
    expect(eerste).toMatchObject({ fase: 'afspraak-gepland', status: 'gescoord', gewisseld: true })
    await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'afspraak-niet-verschenen' } })
    const tweede = await (await request.post('/api/reis/gebeurtenis', { data: { accountId: id, gebeurtenis: 'eerste-afspraak-gepland' } })).json()
    expect(tweede).toMatchObject({ fase: 'in-gesprek', status: 'in reis', gewisseld: false })
  })
})
