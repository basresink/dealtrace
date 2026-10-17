import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

// Meetings in de opzet van DealDrive: kop, filterstrook in de URL, lijst per week en dag of de
// lege staat, en de Meetinglijst. Sinds W2: dagkaarten, dagblok met datumlink en belprioriteit zoals op Bezoeken. met uitleg, advies en een planknop die het afspraakvenster opent.
const nl = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
/** De dag van de eerstvolgende geplande meeting (geen bezoek) van de ingelogde gebruiker. */
async function eersteMeetingDag(page: Page) {
  const van = nl(new Date())
  const r: any = await (await page.request.get(`/api/agenda?van=${van}&tot=${plus(van, 30)}`)).json()
  const m = r.afspraken.filter((a: any) => a.status === 'gepland' && a.vorm !== 'bezoek' && Date.parse(a.start) > Date.now()).sort((a: any, b: any) => a.start.localeCompare(b.start))[0]
  expect(m, 'Eva heeft een meeting in de komende 30 dagen').toBeTruthy()
  return nl(new Date(m.start))
}

test.describe('meetings', () => {
  test('kop, lijst per dag en filters in de URL', async ({ page }) => {
    await login(page, 'u-07')
    // Sinds W2 toont de pagina één dag (of de week); open de dag van de eerstvolgende meeting.
    const dag = await eersteMeetingDag(page)
    await ga(page, `/meetings?datum=${dag}`)
    await expect(page.getByTestId('meetings-kicker')).toContainText('30 dagen')
    await expect(page.locator('h1.title')).toHaveText('Elk gesprek op het juiste moment.')
    await expect(page.getByTestId('meetings-bezoeken')).toHaveAttribute('href', '/bezoeken')
    await expect(page.locator('[data-test^="meeting-"]').first()).toBeVisible()
    await expect(page.getByTestId('meetings-filters')).toHaveCount(0)
    await page.getByTestId('meetings-filterknop').click()
    await page.getByTestId('meetings-vorm-intern').click()
    await expect(page).toHaveURL(/vorm=intern/)
    await expect(page.locator('.mt-vorm--online')).toHaveCount(0)
    await page.locator('[data-test^="meeting-"]').first().click()
    await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
  })

  test('Meetinglijst: uitleg, advies en planknop met account en vorm', async ({ page }) => {
    await login(page, 'u-07')
    await ga(page, '/meetings')
    const lijst = page.getByTestId('aan-de-beurt')
    await expect(lijst).toContainText('Wie is er aan de beurt?')
    // De knop Meeting-analyse staat nu rechtsboven als Analyse (analyse.spec.ts).
    await expect(lijst.getByTestId('meeting-analyse')).toHaveCount(0)
    const rij = lijst.locator('[data-test^="beurt-"]').filter({ has: page.locator('button') }).first()
    await expect(rij.locator('.pil')).toHaveText(/vandaag|deze week|Fysiek/i)
    const knop = (await rij.locator('button').textContent())!.trim()
    await rij.locator('button').click()
    const naam = (await rij.locator('.mt-plan-naam').textContent())!.split(' · ')[0]!
    if (knop === '+ Plan belafspraak') {
      // Een belafspraak is een beltaak: de flyout + Taak met type Bellen en de prospect ingevuld.
      const taak = page.getByTestId('nieuwe-taak')
      await expect(taak).toBeVisible()
      await expect(page.getByTestId('nt-type-bellen')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('nt-klant-keuze')).toContainText(naam)
    } else {
      const flyout = page.getByTestId('plan-afspraak')
      await expect(flyout).toBeVisible()
      await expect(flyout).toContainText(naam)
    }
  })

  test('een meeting van vandaag die al voorbij is: Afgelopen en Verslag maken (B18)', async ({ page }) => {
    const start = new Date(Date.now() - 20 * 60_000)
    const dag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
    test.skip(dag(start) !== dag(new Date()), 'net na middernacht is er nog geen eerder vandaag')
    await apiLogin(page.request, 'u-07')
    const soorten: any = await (await page.request.get('/api/meetingsoorten')).json()
    const kennis = soorten.soorten.find((s: any) => s.slug === 'kennismaking')
    const r = await page.request.post('/api/afspraken', { data: { accountId: 'eva-a08', contactId: 'eva-a08-c1', meetingsoortId: kennis.id, vorm: 'online', start: start.toISOString(), duurMin: 15, titel: `Afgelopen ${Date.now().toString(36)}` } })
    expect(r.ok()).toBe(true)
    const { id } = await r.json()
    await login(page, 'u-07')
    await ga(page, '/meetings')
    const kaart = page.getByTestId(`meeting-${id}`)
    await expect(kaart).toHaveClass(/mt-kaart--voorbij/)
    await expect(kaart.getByTestId('mt-afgelopen')).toHaveText('Afgelopen')
    await kaart.getByTestId('mt-verslag').click()
    await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
    await page.request.post(`/api/afspraken/${id}/status`, { data: { status: 'geannuleerd' } })
  })

  test('lege staat met Eerste meeting', async ({ page }) => {
    await login(page, 'u-01')
    await ga(page, '/meetings?vorm=intern')
    // u-01 heeft geen intern overleg: dan wel de filter-lege staat of de lege staat.
    const leeg = page.locator('[data-test="meetings-leeg"], [data-test="meetings-leeg-filter"]')
    await expect(leeg).toBeVisible()
  })

  test('dagkaarten ma tot vr met Hele week en pijlen, dagblok met datumlink naar de agenda', async ({ page }) => {
    await login(page, 'u-07')
    const dag = await eersteMeetingDag(page)
    const maandag = plus(dag, -((new Date(`${dag}T12:00:00Z`).getUTCDay() + 6) % 7))
    await ga(page, `/meetings?datum=${dag}`)
    const rij = page.getByTestId('bz-week')
    await expect(rij.locator('[data-test^="week-dag-"]')).toHaveCount(5)
    await expect(rij.getByTestId(`week-dag-${maandag}`)).toBeVisible()
    await expect(page.getByTestId('weergave-week')).toContainText('Hele week')
    if (new Date(`${dag}T12:00:00Z`).getUTCDay() % 6) await expect(rij.getByTestId(`week-dag-${dag}`)).toHaveClass(/bz-dag--aan/)
    const blok = page.getByTestId(`meetings-dag-${dag}`)
    await expect(blok.locator('[data-test^="meeting-"]').first()).toBeVisible()
    const link = blok.getByTestId('dagblok-datum')
    await expect(link).toHaveAttribute('href', `/agenda?weergave=dag&datum=${dag}`)
    // Een meetingkaart opent het afspraakvenster met een link naar de prospect.
    await blok.locator('.dp-kaart-titel').first().click()
    await expect(page.getByTestId('afspraak-flyout')).toBeVisible()
    await page.keyboard.press('Escape')
    // Volgende en vorige week, en de hele week.
    await page.getByTestId('week-volgende').click()
    await expect(page).toHaveURL(new RegExp(`datum=${plus(maandag, 7)}`))
    await page.getByTestId('week-vorige').click()
    await expect(page).toHaveURL(new RegExp(`datum=${maandag}`))
    await page.getByTestId('weergave-week').click()
    await expect(page).toHaveURL(/weergave=week/)
    await expect(page.getByTestId('weergave-week')).toHaveClass(/bz-dag--aan/)
    await page.getByTestId('meetings-dag').getByTestId('dagblok-datum').first().click()
    await expect(page).toHaveURL(/\/agenda\?weergave=dag&datum=\d{4}-\d{2}-\d{2}/)
  })

  test('belprioriteit als kaarten onder de meetings; een klik opent de beltaak (1280 en 390)', async ({ page }) => {
    for (const breedte of [1280, 390]) {
      await page.setViewportSize({ width: breedte, height: breedte < 500 ? 844 : 900 })
      await login(page, 'u-07')
      await ga(page, '/meetings')
      const bel = page.getByTestId('meetings-bellijst')
      await expect(bel).toContainText('Bel-prioriteit bij je meetings')
      const kaarten = bel.locator('[data-test^="bel-kaart-"]')
      expect(await kaarten.count()).toBeLessThanOrEqual(5)
      await expect(bel.locator('a', { hasText: /^Bel$/ })).toHaveCount(0)
      const kaart = kaarten.filter({ has: page.locator('button.dp-kaart-titel') }).first()
      await kaart.locator('button.dp-kaart-titel').click()
      const fo = page.getByTestId('taak-flyout')
      await expect(fo).toBeVisible()
      await expect(fo.getByTestId('tf-account')).toHaveAttribute('href', /\/accounts\//)
      await page.keyboard.press('Escape')
      await expect(fo).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breedte)
      if (breedte < 500) {
        for (const t of ['week-vorige', 'week-volgende', 'bel-top-5', 'dagblok-datum']) {
          const b = (await page.getByTestId(t).first().boundingBox())!
          expect(b.height, t).toBeGreaterThanOrEqual(44)
        }
      }
    }
  })
})
