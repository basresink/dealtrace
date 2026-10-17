// Terug in beeld: tellers, filters en groepen; Start hercontact met de drie keuzes en de datums vooraf, daarna staat de
// taak in Taken en op de prospect en de rij op Gestart; Pas datum aan; de lege staat bij filters; de zijbalk onder
// Planning; de telefoon (390 px) zonder horizontale scroll en met tikdoelen van 44 px.
import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, ga } from './hulp'

test.describe.configure({ mode: 'serial' })

const dag = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const AFKOELING_NUL = { bellen: 0, mail: 0, linkedin: 0, whatsapp: 0, bezoek: 0, kaart: 0 }

/** Een eigen prospect op nee: met afkoeling 0 en terug over twee dagen is hij klaar om te starten. */
async function verloren(request: APIRequestContext, naam: string, klaar: boolean) {
  const { id } = await (await request.post('/api/accounts', { data: { naam, plaats: 'Testdorp' } })).json()
  const r = await request.post(`/api/accounts/${id}/nee`, { data: klaar ? { reden: 'Geen budget', afkoeling: AFKOELING_NUL, terugOp: dag(2) } : { reden: 'Geen budget' } })
  expect(r.ok()).toBe(true)
  return id as string
}

/** Testprospects niet laten staan in de lijst van Eva: deactiveren (verwijderen kan niet). */
async function opruimen(request: APIRequestContext, ids: string[]) {
  for (const id of ids) await request.post(`/api/accounts/${id}/deactiveren`, { data: { reden: 'overig', toelichting: 'Testprospect van Terug in beeld' } })
}

for (const breedte of [1280, 390]) {
  test.describe(`Terug in beeld op ${breedte} px`, () => {
    test.use({ viewport: { width: breedte, height: breedte < 500 ? 844 : 900 } })

    test('starten met één taak: de taak staat in Taken en op de prospect, de rij op Gestart', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const naam = `Testterug ${breedte} ${Date.now()}`
      const id = await verloren(page.request, naam, true)
      await ga(page, '/terug-in-beeld')
      await expect(page.getByTestId('kop-tekst').getByRole('heading', { name: 'Terug in beeld' })).toBeVisible()
      await expect(page.getByTestId('tib-tel-week')).toBeVisible()
      const rij = page.locator(`[data-test="tib-rij"][data-id="${id}"]`)
      await expect(rij).toBeVisible()
      await expect(page.getByTestId('tib-groep-week').locator(`[data-id="${id}"]`)).toBeVisible()
      await expect(rij).toContainText('Klaar om te starten')
      await expect(rij).toContainText('Nee gezet op')
      await expect(rij).toContainText('Geen regel: afkoeling bellen')

      await rij.getByTestId('tib-start').click()
      const fly = page.getByTestId('tib-start-flyout')
      await expect(fly).toBeVisible()
      await expect(fly.getByTestId('tib-keuze-reeks')).toContainText('Opvolgreeks')
      await expect(fly.getByTestId('tib-reeks-stappen')).toContainText('Geen reactie: geparkeerd voor')
      await expect(fly.getByTestId('tib-keuze-belblok')).toBeVisible()
      await fly.getByTestId('tib-keuze-taak').click()
      await fly.getByTestId('tib-start-bevestig').click()
      await expect(page.locator('.toast-tekst').last()).toContainText(`Taak gezet voor ${naam}.`)
      await expect(rij).toContainText('Gestart')
      await expect(rij.getByTestId('tib-open')).toBeVisible()

      const taken = await (await page.request.get(`/api/tasks?q=${encodeURIComponent(naam)}`)).text()
      expect(taken).toContain(`Terug in beeld: ${naam}`)
      await ga(page, `/accounts/${id}`)
      await expect(page.getByText(`Terug in beeld: ${naam}`).first()).toBeVisible()

      if (breedte < 500) {
        await ga(page, '/terug-in-beeld')
        const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
        expect(sw).toBeLessThanOrEqual(w)
        const h = await page.locator(`[data-test="tib-rij"][data-id="${id}"]`).getByTestId('tib-open').boundingBox()
        expect(h!.height).toBeGreaterThanOrEqual(44)
      }
      await opruimen(page.request, [id])
    })

    test('opvolgreeks start poging 1 van het ritme; Pas datum aan; filters en lege staat', async ({ page }) => {
      await apiLogin(page.request, 'u-07')
      const naam = `Testreeks ${breedte} ${Date.now()}`
      const id = await verloren(page.request, naam, true)
      const later = await verloren(page.request, `Testlater ${breedte} ${Date.now()}`, false)
      await ga(page, '/terug-in-beeld')
      const rij = page.locator(`[data-test="tib-rij"][data-id="${id}"]`)
      await rij.getByTestId('tib-start').click()
      const fly = page.getByTestId('tib-start-flyout')
      await expect(fly.getByTestId('tib-keuze-reeks').locator('input')).toBeChecked()
      await fly.getByTestId('tib-start-bevestig').click()
      await expect(page.locator('.toast-tekst').last()).toContainText(`Reeks gestart voor ${naam}. Stap 1 staat in Taken.`)
      await expect(rij.getByTestId('tib-uitleg')).toContainText('loopt, stap 1 op')
      expect(await (await page.request.get(`/api/tasks?q=${encodeURIComponent(naam)}`)).text()).toContain(`Poging 1: ${naam}`)

      // Gepland: Pas datum aan, nooit binnen de afkoeling.
      const lr = page.locator(`[data-test="tib-rij"][data-id="${later}"]`)
      await expect(lr).toContainText('Gepland')
      await lr.getByTestId('tib-pas-datum').click()
      const df = page.getByTestId('tib-datum-flyout')
      await df.getByTestId('tib-datum').fill(dag(10))
      await expect(df.getByTestId('tib-datum-melding')).toContainText('Valt binnen de afkoeling')
      await df.getByTestId('tib-datum').fill(dag(150))
      await df.getByTestId('tib-datum-reden').fill('Contactpersoon is weg')
      await df.getByTestId('tib-datum-bewaar').click()
      await expect(page.locator('.toast-tekst').last()).toContainText('komt terug op')
      await expect(lr).toContainText('met de hand aangepast')

      // Filters (knop Filters rechtsboven opent het paneel): status Gestart en een zoekterm zonder treffers.
      await page.getByTestId('tib-filterknop').click()
      await page.getByTestId('tib-status-gestart').click()
      await expect(page).toHaveURL(/status=gestart/)
      await expect(rij).toBeVisible()
      await expect(lr).toBeHidden()
      await page.getByTestId('tib-zoek').fill('zzzgeentreffer')
      await expect(page.getByTestId('tib-geen-treffers')).toBeVisible()
      await page.getByTestId('tib-wis').click()
      await expect(lr).toBeVisible()
      await opruimen(page.request, [id, later])
    })
  })
}

test('zijbalk: Terug in beeld staat onder Planning na Prospectplanning', async ({ page }) => {
  await apiLogin(page.request, 'u-07')
  const me = await (await page.request.get('/api/me')).json()
  const planning = me.zijbalk.groepen.find((g: any) => g.naam === 'Planning').items.map((i: any) => i.sleutel)
  expect(planning.indexOf('nav.terugInBeeld')).toBe(planning.indexOf('nav.planning') + 1)
})
