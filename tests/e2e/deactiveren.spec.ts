// Deactiveren in plaats van verwijderen (0064): onderaan het Info-venster (niet meer onder Meer), met een verplichte
// reden, de balk op de accountkaart met Heractiveren (ook onderaan Info), de historie blijft leesbaar, het filter Status in Alle prospects, het label in de zoekfunctie en
// nergens meer een verwijderknop.
import { expect, test } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ timeout: 120_000 })
const uniekeNaam = () => `Testdeactief ${Array.from(Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).map((c) => String.fromCharCode(97 + (parseInt(c, 36) % 26))).join('')}`

test.describe('prospect deactiveren', () => {
  test('deactiveren met reden, balk en historie op de kaart, filter, zoeken en heractiveren', async ({ page }) => {
    await login(page, 'u-01')
    const naam = uniekeNaam()
    const a = await (await page.request.post('/api/accounts', { data: { naam, plaats: 'Zwolle' } })).json()
    expect(a.id).toBeTruthy()
    await page.request.post(`/api/accounts/${a.id}/notities`, { data: { tekst: 'Eerste gesprek gevoerd met de inkoper' } })
    const taak = await (await page.request.post('/api/tasks', { data: { title: `Terugbellen ${naam}`, actionType: 'bellen', accountId: a.id } })).json()

    // Geen verwijderknop meer, ook niet in Info.
    await ga(page, `/accounts/${a.id}`)
    await expect(page.getByTestId('gedeactiveerd-balk')).toHaveCount(0)
    // Meer heeft geen Deactiveren meer, en ook geen Klaarzetten of Belscript.
    await page.getByTestId('kop-meer').click()
    const meer = page.getByTestId('meer-flyout')
    await expect(meer.getByTestId('meer-dossier')).toBeVisible()
    for (const id of ['deactiveer-knop', 'klaarzetten-knop', 'meer-belscript']) await expect(meer.getByTestId(id)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(meer).toHaveCount(0)

    // Deactiveren onderaan Info: zonder reden kan het niet, bij Overig is een toelichting verplicht.
    await page.getByTestId('info-knop').click()
    const info = page.getByTestId('info-flyout')
    await expect(page.getByTestId('verwijder')).toHaveCount(0)
    await expect(page.getByText('Verwijder account')).toHaveCount(0)
    const sectie = info.getByTestId('if-deactiveer-sectie')
    await sectie.scrollIntoViewIfNeeded()
    await expect(sectie).toContainText('Deactiveren')
    await sectie.getByTestId('if-deactiveer').click()
    const venster = page.getByTestId('deactiveer-venster')
    await expect(venster).toBeVisible()
    await expect(page.getByTestId('deactiveer-bevestig')).toBeDisabled()
    await venster.locator('label', { hasText: 'Overig' }).click()
    await expect(page.getByTestId('deactiveer-bevestig')).toBeDisabled()
    await venster.locator('label', { hasText: 'Dubbel account' }).click()
    await page.getByTestId('deactiveer-toelichting').fill('Staat er al onder een andere naam')
    await page.getByTestId('deactiveer-bevestig').click()

    // De balk: wanneer, door wie en waarom; de tijdlijn houdt de notitie en krijgt het moment.
    const balk = page.getByTestId('gedeactiveerd-balk')
    await expect(balk).toBeVisible()
    await expect(balk).toContainText('Gedeactiveerd op')
    await expect(balk).toContainText('reden Dubbel account: Staat er al onder een andere naam')
    await expect(page.getByTestId('heractiveer-knop')).toBeVisible()
    await expect(page.getByTestId('tijdlijn')).toContainText('Gedeactiveerd')
    await expect(page.getByTestId('tijdlijn')).toContainText('Geannuleerd')
    await page.getByTestId('tab-notities').click()
    await expect(page.getByText('Eerste gesprek gevoerd met de inkoper')).toBeVisible()
    await page.getByTestId('tab-tijdlijn').click()
    // De open taak is gestopt met de reden, niet verwijderd.
    const tabs = await (await page.request.get(`/api/accounts/${a.id}/tabbladen`)).json()
    const t = tabs.taken.find((x: any) => x.id === taak.id)
    expect(t?.status).toBe('geannuleerd')
    // Info biedt nu Heractiveren in plaats van Deactiveren.
    await page.getByTestId('info-knop').click()
    await expect(page.getByTestId('info-flyout').getByTestId('if-heractiveer')).toBeVisible()
    await expect(page.getByTestId('info-flyout').getByTestId('if-deactiveer')).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Alle prospects: standaard weg, terug met het filter Status.
    await ga(page, `/prospects/alle?q=${encodeURIComponent(naam)}`)
    await expect(page.getByTestId('aantal')).toHaveText('0 resultaten')
    await expect(page.getByTestId('filterpaneel')).toBeVisible()
    await expect(page.getByTestId('filter-actief-gedeactiveerd')).toContainText('1')
    await page.getByTestId('filter-actief-gedeactiveerd').click()
    await expect(page).toHaveURL(/actief=gedeactiveerd/)
    await expect(page.getByTestId('aantal')).toHaveText('1 resultaat')
    await expect(page.locator(`[data-account="${a.id}"]`).getByTestId('rij-gedeactiveerd')).toBeVisible()
    await page.getByTestId('filter-actief-alle').click()
    await expect(page.getByTestId('aantal')).toHaveText('1 resultaat')

    // Zoeken: vindbaar met het label Gedeactiveerd.
    const z = await (await page.request.get('/api/zoeken', { params: { q: naam } })).json()
    const rij = z.groepen.find((g: any) => g.soort === 'accounts')?.rijen.find((r: any) => r.link === `/accounts/${a.id}`)
    expect(rij?.label).toBe('Gedeactiveerd')
    await page.getByTestId('kop-zoeken').click()
    await expect(page.locator('.zoek-invoer')).toBeFocused()
    await page.locator('.zoek-invoer').fill(naam)
    await expect(page.locator('.zoek-rij', { hasText: naam }).getByTestId('zoek-label')).toHaveText('Gedeactiveerd', { timeout: 15_000 })
    await page.keyboard.press('Escape')

    // Heractiveren: de balk verdwijnt en de prospect staat weer in de lijst.
    await ga(page, `/accounts/${a.id}`)
    await page.getByTestId('heractiveer-knop').click()
    await expect(page.getByText('is weer actief')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('gedeactiveerd-balk')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByTestId('tijdlijn')).toContainText('Heractiveerd')
    await ga(page, `/prospects/alle?q=${encodeURIComponent(naam)}`)
    await expect(page.getByTestId('aantal')).toHaveText('1 resultaat')

    // Opruimen: weer deactiveren (verwijderen bestaat niet).
    expect((await page.request.delete(`/api/accounts/${a.id}`)).status()).toBe(405)
    expect((await page.request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'overig', toelichting: 'Opruimen na de test' } })).ok()).toBe(true)
  })

  test('heractiveren onderaan Info; een collega zonder recht ziet geen sectie Deactiveren', async ({ page }) => {
    await login(page, 'u-01')
    const a = await (await page.request.post('/api/accounts', { data: { naam: uniekeNaam() } })).json()
    expect((await page.request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'failliet' } })).ok()).toBe(true)
    await ga(page, `/accounts/${a.id}?meer=info`)
    const info = page.getByTestId('info-flyout')
    await expect(info.getByTestId('if-deactiveer-sectie')).toContainText('Gedeactiveerd')
    await info.getByTestId('if-heractiveer').click()
    await expect(page.getByText('is weer actief')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('gedeactiveerd-balk')).toHaveCount(0, { timeout: 15_000 })
    await expect(info.getByTestId('if-deactiveer')).toBeVisible()
    // u-02 is niet de eigenaar en geen salesmanager: geen sectie (de server weigert ook, zie de API-test).
    await login(page, 'u-02')
    const r = await page.request.get(`/api/accounts/${a.id}`)
    if (r.ok()) {
      await ga(page, `/accounts/${a.id}?meer=info`)
      await expect(page.getByTestId('info-flyout')).toBeVisible()
      await expect(page.getByTestId('if-deactiveer-sectie')).toHaveCount(0)
    }
    await login(page, 'u-01')
    expect((await page.request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'overig', toelichting: 'Opruimen na de test' } })).ok()).toBe(true)
  })

  test('API: reden verplicht, alleen eigenaar, salesmanager of beheerder, dubbel deactiveren geeft 409', async ({ request }) => {
    await apiLogin(request, 'u-01')
    const a = await (await request.post('/api/accounts', { data: { naam: uniekeNaam() } })).json()
    expect((await request.post(`/api/accounts/${a.id}/deactiveren`, { data: {} })).status()).toBe(422)
    expect((await request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'overig' } })).status()).toBe(422)
    await apiLogin(request, 'u-02')
    expect((await request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'failliet' } })).status()).toBe(403)
    await apiLogin(request, 'u-06')
    expect((await request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'failliet' } })).status()).toBe(200)
    expect((await request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'failliet' } })).status()).toBe(409)
    // De beheerder kijkt terug: de kaart en de audit blijven leesbaar.
    const kaart = await (await request.get(`/api/accounts/${a.id}`)).json()
    expect(kaart.gedeactiveerd).toMatchObject({ reden: 'failliet', redenLabel: 'Failliet of opgeheven' })
    expect(kaart.kan.heractiveren).toBe(true)
    await apiLogin(request, 'u-02')
    expect((await request.post(`/api/accounts/${a.id}/heractiveren`)).status()).toBe(403)
  })

  test('de balk op de telefoon: tikdoel Heractiveren minstens 44 px, geen horizontale scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'u-01')
    const a = await (await page.request.post('/api/accounts', { data: { naam: uniekeNaam() } })).json()
    await page.request.post(`/api/accounts/${a.id}/deactiveren`, { data: { reden: 'buiten-doelgroep' } })
    await ga(page, `/accounts/${a.id}`)
    await expect(page.getByTestId('gedeactiveerd-balk')).toBeVisible()
    const knop = (await page.getByTestId('heractiveer-knop').boundingBox())!
    expect(knop.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
