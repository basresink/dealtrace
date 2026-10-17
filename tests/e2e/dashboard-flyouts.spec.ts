// W8: klikbare resultaten op /funnel (Doorlooptijd per fase) en /mijn-dashboard (reis, uitkomsten, dekking en
// status prospect) met de prospects of pogingen in een venster; de weg terug van /funnel naar Mijn dashboard;
// de weggehaalde blokken; Status prospect invullen in Info en als label op de accountkaart en in de lijst.
// Eva Ervaren (u-07) heeft vier weken mockdata en een status op een deel van haar prospects.
import { expect, test, type Page } from '@playwright/test'
import { ga, login } from './hulp'

test.describe.configure({ timeout: 120_000 })

const geenScroll = async (page: Page, breedte: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
async function tikdoel(page: Page, loc: ReturnType<Page['locator']>, breedte: number) {
  if (breedte >= 500) return
  const b = (await loc.boundingBox())!
  expect(b.height).toBeGreaterThanOrEqual(44)
}

for (const breedte of [1280, 390]) {
  test.describe(`op ${breedte} px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 }) })

    test('funnel: doorlooptijd per fase opent de prospects met fase, dagen en eigenaar; terug naar Mijn dashboard', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/funnel?periode=kwartaal')
      const api = await (await page.request.get('/api/funnel?periode=kwartaal')).json()
      const fase = api.fases.find((f: any) => f.aantal > 0 && f.doorlooptijd != null) ?? api.fases.find((f: any) => f.aantal > 0)
      expect(fase).toBeTruthy()
      const rij = page.getByTestId(`doorloop-${fase.faseId}`)
      await expect(rij).toBeEnabled()
      await tikdoel(page, rij, breedte)
      await rij.click()
      const fly = page.getByTestId('funnel-lijst')
      await expect(fly).toContainText(`Doorlooptijd ${fase.label}`)
      await expect(fly.getByTestId('doorloop-rij')).toHaveCount(fase.aantal)
      const eerste = fly.getByTestId('doorloop-rij').first()
      await expect(eerste.locator('a')).toHaveAttribute('href', /^\/accounts\/[^/]+$/)
      await expect(eerste).toContainText(/\d+ dagen?|onbekend/)
      await expect(eerste).toContainText('Testgebruiker Eva Ervaren')
      await geenScroll(page, breedte)
      await page.keyboard.press('Escape')
      await expect(fly).toHaveCount(0)
      const terug = page.getByTestId('funnel-terug')
      await expect(terug).toHaveAttribute('href', '/mijn-dashboard')
      await tikdoel(page, terug, breedte)
      await terug.click()
      await expect(page).toHaveURL(/\/mijn-dashboard$/)
    })

    test('Mijn dashboard: reis, uitkomsten en dekking openen de lijst erachter; de oude blokken zijn weg', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/mijn-dashboard')
      for (const weg of ['mijn-afspraken', 'zelfanalyse', 'grafiek-pogingen']) await expect(page.getByTestId(weg)).toHaveCount(0)
      const api = await (await page.request.get('/api/resultaten/dashboard')).json()
      const fly = page.getByTestId('dashboard-lijst')

      // Reis per fase: Afspraak gepland toont ook bij welke poging de eerste afspraak kwam.
      const fase = api.funnel.fases.find((f: any) => f.faseId === 'afspraak-gepland' && f.aantal > 0) ?? api.funnel.fases.find((f: any) => f.aantal > 0)
      await page.getByTestId(`reis-${fase.faseId}`).click()
      await expect(fly).toContainText(fase.label)
      await expect(fly.getByTestId('dashboard-lijst-rij')).toHaveCount(fase.aantal)
      await expect(fly.getByTestId('dashboard-lijst-rij').first().locator('a').first()).toHaveAttribute('href', /^\/accounts\//)
      if (fase.faseId === 'afspraak-gepland') await expect(fly.getByTestId('lijst-eerste-afspraak')).toContainText('bij poging')
      await geenScroll(page, breedte)
      await page.keyboard.press('Escape')
      await expect(fly).toHaveCount(0)

      // Uitkomsten: de pogingen met die uitkomst, met de taak erachter waar die er is.
      const uit = api.uitkomsten.find((u: any) => u.sleutel === 'afspraak') ?? api.uitkomsten[0]
      const balk = page.getByTestId(`uitkomst-${uit.sleutel}`)
      await tikdoel(page, balk, breedte)
      await balk.click()
      await expect(fly.getByTestId('dashboard-lijst-rij')).toHaveCount(uit.aantal)
      if (uit.sleutel === 'afspraak') await expect(fly.getByTestId('dashboard-lijst-taak').first()).toHaveAttribute('href', /^\/taken\?taak=/)
      await page.keyboard.press('Escape')

      // Prospectdekking: een cel en een getal.
      const bak = api.prospects.dekking.bakken.find((b: any) => b.aantal > 0)
      const cel = page.getByTestId(`dekking-${bak.sleutel}`)
      await tikdoel(page, cel, breedte)
      await cel.click()
      await expect(fly.getByTestId('dashboard-lijst-rij')).toHaveCount(bak.aantal)
      await page.keyboard.press('Escape')
      if (api.prospects.dekking.zonderContact) {
        await page.getByTestId('dekking-stat-zonder').click()
        await expect(fly).toContainText('Nog geen contactmoment')
        await expect(fly.getByTestId('dashboard-lijst-rij')).toHaveCount(api.prospects.dekking.zonderContact)
        await page.keyboard.press('Escape')
      }
      await geenScroll(page, breedte)
    })

    test('Status prospect: blok met vier kolommen na Prospectdekking; een kolom toont de prospects', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/mijn-dashboard')
      const blok = page.getByTestId('grafiek-status')
      await expect(blok).toContainText('Status prospect')
      // Het blok staat direct na Prospectdekking.
      const volgorde = await page.locator('[data-test^="grafiek-"], [data-test="mijn-trend"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
      expect(volgorde.indexOf('grafiek-status')).toBe(volgorde.indexOf('grafiek-dekking') + 1)
      const api = await (await page.request.get('/api/resultaten/dashboard')).json()
      for (const k of api.statusProspects.kolommen) await expect(blok.getByTestId(`status-${k.sleutel}`)).toContainText(String(k.aantal))
      const k = api.statusProspects.kolommen.find((x: any) => x.sleutel === 'heet' && x.aantal) ?? api.statusProspects.kolommen.find((x: any) => x.aantal)
      expect(k).toBeTruthy()
      const kol = blok.getByTestId(`status-${k.sleutel}`)
      await tikdoel(page, kol, breedte)
      await kol.click()
      const fly = page.getByTestId('dashboard-lijst')
      await expect(fly).toContainText(k.label)
      await expect(fly.getByTestId('dashboard-lijst-rij')).toHaveCount(k.aantal)
      await expect(fly.getByTestId('dashboard-lijst-rij').first()).toContainText(k.label)
      await geenScroll(page, breedte)
    })

    test('Status prospect invullen in Info: label op de accountkaart, audit en terugzetten', async ({ page }) => {
      await login(page, 'u-07')
      const id = 'eva-p52'
      const oud = (await (await page.request.get(`/api/accounts/${id}`)).json()).prospectStatus
      await page.request.put(`/api/accounts/${id}/prospect-status`, { data: { status: null } })
      await ga(page, `/accounts/${id}`)
      await expect(page.getByTestId('prospect-status-pil')).toHaveCount(0)
      await page.getByTestId('info-knop').click()
      const fly = page.getByTestId('info-flyout')
      const veld = fly.getByTestId('if-prospect-status')
      await veld.getByTestId('if-prospect-status-leeg').click()
      await veld.getByLabel('Status prospect').selectOption('heet')
      await veld.getByTestId('if-prospect-status-bewaar').click()
      await expect(veld.getByTestId('if-prospect-status-waarde')).toHaveText('Heet')
      await expect.poll(async () => (await (await page.request.get(`/api/accounts/${id}`)).json()).prospectStatus).toBe('heet')
      await fly.getByTestId('if-klaar').click()
      await expect(page.getByTestId('prospect-status-pil')).toContainText('Heet')
      await geenScroll(page, breedte)
      await page.request.put(`/api/accounts/${id}/prospect-status`, { data: { status: oud ?? null } })
    })

    test('de lijst van prospects toont de status als label', async ({ page }) => {
      await login(page, 'u-07')
      await ga(page, '/prospects/alle')
      await expect(page.getByTestId('rij-labels').filter({ hasText: /Koud|Lauw|Warm|Heet/ }).first()).toBeVisible()
      await geenScroll(page, breedte)
    })
  })
}
