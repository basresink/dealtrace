import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// De machine is soms zwaar belast: UI-verwachtingen krijgen wat meer tijd.
const verwacht = expect.configure({ timeout: 20000 })

// Pakket B, gebruikers en teams: wijzigen in de flyout, archiveren met overdracht, heractiveren, teams
// hernoemen, koppelen en verwijderen, en rechten per rol. Elke test maakt zijn eigen testgebruiker of
// testteam aan en ruimt die op (archiveren of verwijderen), zodat de seats van Voltvast vrij blijven.

async function nieuweGebruiker(page: Page, naam: string) {
  await apiLogin(page.request, 'u-06')
  const email = `e2e-gb-${Date.now()}-${Math.floor(Math.random() * 1e4)}@voltvast.test`
  const r = await page.request.post('/api/gebruikers', { data: { naam, email, rol: 'accountmanager', werkplek: 'binnendienst', teamId: 'team-noord' } })
  expect(r.status(), await r.text()).toBe(200)
  return { ...(await r.json()), email } as { id: string; naam: string; email: string }
}
async function opruimen(page: Page, id: string) {
  await apiLogin(page.request, 'u-06')
  const lijst = await (await page.request.get('/api/gebruikers')).json()
  if (lijst.find((g: any) => g.id === id)?.status !== 'gearchiveerd') await page.request.post(`/api/gebruikers/${id}/archiveer`, { data: { naar: 'u-04' } })
}
async function geenHorizontaleScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

for (const breedte of [1280, 390]) {
  test.describe(`gebruikers op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('wijzigen, archiveren met overdracht en heractiveren', async ({ page }) => {
      const g = await nieuweGebruiker(page, `Testgebruiker E2E ${breedte}`)
      // Werk op zijn naam: een open taak die bij archiveren moet meeverhuizen.
      const taak = await page.request.post('/api/tasks', { data: { title: 'E2E overdrachtstaak', ownerId: g.id } })
      expect(taak.status(), await taak.text()).toBe(200)
      const taakId = (await taak.json()).id as string
      try {
        await login(page, 'u-06')
        await ga(page, '/instellingen/gebruikers')
        const rij = page.locator(`tr[data-gebruiker="${g.id}"]`)
        await verwacht(rij).toBeVisible()
        await verwacht(page.getByTestId(`status-${g.id}`)).toHaveText(/Uitgenodigd/)
        await verwacht(page.getByTestId(`inlog-${g.id}`)).toHaveText(/Nog niet/)
        await geenHorizontaleScroll(page)

        // Wijzigen: een bestaand e-mailadres geeft een melding, een nieuwe naam wordt bewaard.
        await page.getByTestId(`wijzig-${g.id}`).click()
        const flyout = page.getByTestId('gebruiker-flyout')
        await verwacht(flyout).toBeVisible()
        await flyout.getByTestId('gf-email').fill('anouk@voltvast.test')
        await flyout.getByTestId('gf-bewaar').click()
        await verwacht(flyout.getByTestId('gf-fout')).toContainText('al in gebruik')
        await flyout.getByTestId('gf-email').fill(g.email)
        await flyout.getByTestId('gf-naam').fill(`Testgebruiker E2E ${breedte} Gewijzigd`)
        await flyout.getByTestId('gf-bewaar').click()
        await verwacht(flyout).toBeHidden()
        await verwacht(rij).toContainText('Gewijzigd')

        // Archiveren: vooraf zien wat er verhuist, standaard naar de manager van het team.
        const knop = page.getByTestId(`archiveer-${g.id}`)
        if (breedte < 500) expect((await knop.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        await knop.click()
        const venster = page.getByTestId('archiveer-venster')
        await verwacht(venster.getByTestId('archiveer-telling')).toContainText('1 open taak')
        await verwacht(venster.getByTestId('archiveer-naar')).toHaveValue('u-04')
        await geenHorizontaleScroll(page)
        await venster.getByTestId('archiveer-bevestig').click()
        await verwacht(venster).toBeHidden()
        await verwacht(rij).toHaveCount(0)
        const stand = await (await page.request.get(`/api/gebruikers/${g.id}/overdracht`)).json()
        expect(stand.taken).toBe(0)
        const t = await (await page.request.get(`/api/tasks/${taakId}`)).json()
        expect(t.ownerId ?? t.owner_id ?? t.taak?.ownerId).toBe('u-04')

        // Heractiveren vanaf het tabblad Gearchiveerd.
        await page.getByTestId('tab-gearchiveerd').click()
        const archiefRij = page.getByTestId('gearchiveerd-lijst').locator(`[data-gebruiker="${g.id}"]`)
        await verwacht(archiefRij).toBeVisible()
        await geenHorizontaleScroll(page)
        await page.getByTestId(`heractiveer-${g.id}`).click()
        await verwacht(archiefRij).toHaveCount(0)
        await page.getByTestId('tab-gebruikers').click()
        await verwacht(page.locator(`tr[data-gebruiker="${g.id}"]`)).toBeVisible()
      } finally {
        await opruimen(page, g.id)
        await page.request.delete(`/api/tasks/${taakId}`)
      }
    })

    test('teams: toevoegen, hernoemen, koppelen en verwijderen; een team met leden niet', async ({ page }) => {
      await login(page, 'u-06')
      await ga(page, '/instellingen/gebruikers?tab=teams')
      const naam = `E2E Team ${breedte} ${Date.now()}`
      await page.getByTestId('nieuw-team').fill(naam)
      await page.getByTestId('team-toevoegen').click()
      // Andere kaarten noemen het nieuwe team bij Gekoppelde teams: zoek op de titel en daarna op het id.
      const titel = page.getByTestId('team-kaart').filter({ has: page.locator('.kaart-titel', { hasText: naam }) })
      try {
        await verwacht(titel).toHaveCount(1)
        const kaart = page.locator(`[data-team="${await titel.getAttribute('data-team')}"]`)
        await kaart.getByTestId('team-hernoem').click()
        await kaart.getByTestId('team-naam-invoer').fill(`${naam} Hernoemd`)
        await kaart.getByTestId('team-naam-bewaar').click()
        await verwacht(kaart.locator('.kaart-titel')).toHaveText(`${naam} Hernoemd`)

        await kaart.getByTestId('team-manager-u-04').click()
        await verwacht(kaart.getByTestId('team-manager-u-04')).toHaveAttribute('aria-pressed', 'true')
        await verwacht(kaart).toContainText('Salesmanager: Testgebruiker Joost Stuurman')
        await kaart.getByTestId('team-koppel-team-zuid').click()
        await verwacht(kaart).toContainText('Werkt samen met: Team Zuid')
        if (breedte < 500) expect((await kaart.getByTestId('team-verwijder').boundingBox())!.height).toBeGreaterThanOrEqual(44)
        await geenHorizontaleScroll(page)

        // Een team met leden: de server legt uit wat er eerst moet.
        const noord = page.locator('[data-team="team-noord"]')
        await noord.getByTestId('team-verwijder').click()
        await page.getByTestId('bevestig').click()
        await verwacht(noord.getByTestId('team-fout')).toContainText('ander team')

        await kaart.getByTestId('team-verwijder').click()
        await page.getByTestId('bevestig').click()
        await verwacht(kaart).toHaveCount(0)
      } finally {
        const teams = await (await page.request.get('/api/teams')).json()
        for (const t of teams.filter((x: any) => x.naam.startsWith(naam))) await page.request.delete(`/api/teams/${t.id}`)
      }
    })
  })
}

test('rechten: accountmanager 403, salesmanager alleen lezen en zijn eigen teams', async ({ request }) => {
  await apiLogin(request, 'u-01')
  expect((await request.get('/api/gebruikers')).status()).toBe(403)
  expect((await request.get('/api/gebruikers/u-02/overdracht')).status()).toBe(403)
  expect((await request.post('/api/gebruikers/u-02/archiveer', { data: { naar: 'u-04' } })).status()).toBe(403)
  expect((await request.post('/api/gebruikers/u-02/heractiveer')).status()).toBe(403)
  expect((await request.put('/api/gebruikers/u-02', { data: { naam: 'X' } })).status()).toBe(403)
  expect((await request.put('/api/teams/team-noord', { data: { naam: 'X' } })).status()).toBe(403)
  expect((await request.delete('/api/teams/team-noord')).status()).toBe(403)
  expect((await (await request.get('/api/teams')).json()).map((t: any) => t.id)).toEqual(['team-noord'])

  await apiLogin(request, 'u-04')
  expect((await request.post('/api/gebruikers/u-02/archiveer', { data: { naar: 'u-04' } })).status()).toBe(403)
  expect((await request.post('/api/gebruikers/u-02/heractiveer')).status()).toBe(403)
  expect((await request.put('/api/gebruikers/u-02', { data: { email: 'x@voltvast.test' } })).status()).toBe(403)
  expect((await request.delete('/api/teams/team-noord')).status()).toBe(403)
  const teams = (await (await request.get('/api/teams')).json()).map((t: any) => t.id)
  expect(teams).toEqual(expect.arrayContaining(['team-noord', 'team-zuid', 'team-binnendienst']))
  expect(teams).not.toContain('team-tweede')
  const gebruikers = await (await request.get('/api/gebruikers')).json()
  expect(gebruikers.every((g: any) => g.id === 'u-04' || ['team-noord', 'team-zuid', 'team-binnendienst'].includes(g.teamId))).toBe(true)

  // Beheerder: de laatste beheerder archiveert zichzelf niet; e-mail moet geldig zijn.
  await apiLogin(request, 'u-06')
  expect((await request.post('/api/gebruikers/u-06/archiveer', { data: {} })).status()).toBe(409)
  expect((await request.put('/api/gebruikers/u-02', { data: { email: 'geen-adres' } })).status()).toBe(400)
  expect((await request.put('/api/gebruikers/u-02', { data: { eigenPortefeuille: true } })).status()).toBe(400)
})
