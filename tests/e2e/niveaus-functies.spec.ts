// Wens opdrachtgever: op Instellingen, Niveaus zet de beheerder functies per niveau aan en uit, met de
// standaard van Dealtrace als beginstand en Terug naar de standaard. De beheerder (u-06) zet Signaalradar
// uit voor Expert: Eva (u-07, expert) ziet hem niet meer in het menu en een directe link toont Nog niet
// aangezet. Terug naar de standaard herstelt het. Rechten: alleen de beheerder (403 voor anderen).
// De database staat na de test weer in de standaardstand. Op 1280 en 390 px.
import { expect, test, type Page } from '@playwright/test'
import { apiLogin, ga, login } from './hulp'

test.describe.configure({ mode: 'serial', timeout: 240_000 })

const geenScroll = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

async function menuHeeftSignaalradar(page: Page) {
  const me = await (await page.request.get('/api/me')).json()
  return (me.zijbalk.groepen as { items: { route: string }[] }[]).some((g) => g.items.some((i) => i.route === '/signaalradar'))
}

test.afterAll(async ({ request }) => {
  await apiLogin(request, 'u-06')
  await request.post('/api/instellingen/niveaus/standaard')
})

test.beforeAll(async ({ request }) => {
  await apiLogin(request, 'u-06')
  expect((await request.post('/api/instellingen/niveaus/standaard')).status()).toBe(200)
})

test('alleen de beheerder zet functies aan of uit', async ({ request }) => {
  for (const id of ['u-07', 'u-01']) {
    await apiLogin(request, id)
    expect((await request.put('/api/instellingen/niveaus/functie', { data: { functie: 'nav.signaalradar', niveau: 'expert', aan: false } })).status()).toBe(403)
    expect((await request.post('/api/instellingen/niveaus/standaard')).status()).toBe(403)
    expect((await request.get('/api/instellingen/niveaus')).status()).toBe(403)
  }
  await apiLogin(request, 'u-06')
  // Een rolfunctie hangt niet af van het niveau.
  expect((await request.put('/api/instellingen/niveaus/functie', { data: { functie: 'nav.team', niveau: 'beginner', aan: true } })).status()).toBe(422)
})

for (const breedte of [1280, 390]) {
  test(`Signaalradar uit voor Expert en terug naar de standaard (${breedte} px)`, async ({ browser }) => {
    const beheer = await browser.newPage({ viewport: { width: breedte, height: 900 } })
    await login(beheer, 'u-06')
    await ga(beheer, '/instellingen/niveaus')
    await expect(beheer.getByTestId('niveau-keuzes')).toHaveText(/standaard van Dealtrace/)
    await beheer.getByTestId('niveau-zoek').fill('Signaalradar')
    const rij = beheer.locator('[data-test="niveau-functie"][data-sleutel="nav.signaalradar"]')
    await expect(rij).toBeVisible()
    const expert = rij.locator('[data-niveau="expert"]')
    await expect(expert).toHaveAttribute('data-aan', 'ja')
    await expect(rij.locator('[data-niveau="beginner"]')).toHaveAttribute('data-aan', 'nee')
    await expert.getByRole('switch').click()
    await expect(beheer.getByTestId('bewaar-functie')).toHaveAttribute('data-stand', 'klaar')
    await expect(expert).toHaveAttribute('data-aan', 'nee')
    await expect(expert).toHaveAttribute('data-afwijkend', 'ja')
    await expect(beheer.getByTestId('niveau-keuzes')).toHaveText(/1 keuze wijkt af/)
    // Filter Alleen afwijkend in de link.
    await beheer.getByTestId('niveau-zoek').fill('')
    if (!(await beheer.getByTestId('inst-filterpaneel').isVisible())) await beheer.getByTestId('inst-filters').click()
    await beheer.getByTestId('niveau-filter-afwijkend').click()
    await expect(beheer).toHaveURL(/afwijkend=1/)
    await expect(beheer.locator('[data-test="niveau-functie"]')).toHaveCount(1)
    await geenScroll(beheer)

    // Eva (expert) ziet hem nergens en een directe link toont Nog niet aangezet.
    const eva = await browser.newPage({ viewport: { width: breedte, height: 900 } })
    await login(eva, 'u-07')
    expect(await menuHeeftSignaalradar(eva)).toBe(false)
    await ga(eva, '/')
    await expect(eva.locator('a[href="/signaalradar"], a[href^="/signaalradar?"]')).toHaveCount(0)
    await ga(eva, '/signaalradar')
    await expect(eva.getByTestId('niet-aangezet-pagina')).toBeVisible()
    await expect(eva.getByTestId('niet-aangezet-reden')).toHaveText('Deze functie staat voor je organisatie nog niet aan.')
    expect((await eva.request.get('/api/signaalradar')).status()).toBe(403)

    // Terug naar de standaard, met bevestiging in de pagina.
    await beheer.getByTestId('niveau-naar-standaard').click()
    await expect(beheer.getByTestId('niveau-standaard-bevestig')).toBeVisible()
    await beheer.getByTestId('niveau-standaard-ja').click()
    await expect(beheer.getByTestId('niveau-keuzes')).toHaveText(/standaard van Dealtrace/)
    await expect(beheer.getByTestId('niveau-standaard-bevestig')).toHaveCount(0)

    expect(await menuHeeftSignaalradar(eva)).toBe(true)
    await ga(eva, '/signaalradar')
    await expect(eva.getByTestId('niet-aangezet-pagina')).toHaveCount(0)

    // Audit: de wijziging en het terugzetten staan erin.
    const audit = await (await beheer.request.get('/api/instellingen/audit?soort=instellingen')).json()
    const acties = audit.regels.map((r: any) => r.actie)
    expect(acties).toContain('instelling.functieUit')
    expect(acties).toContain('instelling.functiesStandaard')
    await beheer.close()
    await eva.close()
  })
}
